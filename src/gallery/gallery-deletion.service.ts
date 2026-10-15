import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { posix } from 'node:path';
import { PrismaService } from '../prisma/prisma.service.js';
import { LocalUploadService } from '../uploads/local-upload.service.js';
import type { Prisma } from '../generated/prisma/client.js';

type Reference = { source: string; id: number; value: string };

@Injectable()
export class GalleryDeletionService {
  private readonly logger = new Logger(GalleryDeletionService.name);
  constructor(private readonly prisma: PrismaService, private readonly storage: LocalUploadService) {}

  async delete(ids: number[], imagesOnly = true) {
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 100 || new Set(ids).size !== ids.length || ids.some(id => !Number.isInteger(id) || id < 1 || id > 2147483647)) {
      throw new BadRequestException('Supply 1–100 unique positive PostgreSQL integer IDs.');
    }
    const operationId = randomUUID();
    const records = await this.prisma.$transaction(async tx => {
      await this.lockReferences(tx);
      const records = await tx.galleryImage.findMany({ where: { id: { in: ids } } });
      if (!imagesOnly && !records.length) throw new NotFoundException('Gallery media item was not found.');
      if (imagesOnly && records.some(record => record.mediaType !== 'IMAGE')) {
        throw new BadRequestException('Batch deletion accepts images only. No records were deleted.');
      }
      const references = await this.references(tx);
      const tasks: { id: string; publicId: string }[] = [];
      const preservedIds: number[] = [];
      for (const record of records) {
        const publicId = record.publicId;
        // Only the exact relative URL emitted by our local uploader verifies
        // local ownership. Cloudinary records are removed without remote cleanup.
        if (publicId?.startsWith('gallery/')) {
          if (record.imageUrl !== `/uploads/${publicId}` || !publicId.startsWith(`gallery/${record.mediaType === 'IMAGE' ? 'images' : 'videos'}/`)) {
            throw new BadRequestException('Ambiguous gallery storage ownership.');
          }
          await this.storage.validateDeletionPath(publicId);
          this.assertUnshared(references, publicId, record.id);
          if (await tx.galleryCleanupTask.findUnique({ where: { publicId } })) {
            throw new ConflictException('This storage asset already belongs to a cleanup operation.');
          }
          tasks.push({ id: randomUUID(), publicId });
        } else {
          let url: URL;
          try { url = new URL(record.imageUrl); } catch { throw new BadRequestException('Unverified storage provider.'); }
          if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || publicId?.includes('\\')) {
            throw new BadRequestException('Unverified storage provider.');
          }
          preservedIds.push(record.id);
        }
        if (record.thumbnailUrl && record.thumbnailUrl !== record.imageUrl && !record.thumbnailUrl.startsWith('https://res.cloudinary.com/')) {
          throw new BadRequestException('Separate thumbnail ownership is unverified.');
        }
        if (record.thumbnailUrl?.startsWith('https://res.cloudinary.com/') && record.thumbnailUrl !== record.imageUrl && !preservedIds.includes(record.id)) {
          preservedIds.push(record.id);
        }
      }
      const deletedIds = ids.filter(id => records.some(record => record.id === id));
      await tx.galleryDeletionOperation.create({ data: {
        id: operationId, requestedIds: ids, deletedIds,
        notFoundIds: ids.filter(id => !deletedIds.includes(id)), preservedIds,
        tasks: { create: tasks },
      } });
      await tx.galleryImage.deleteMany({ where: { id: { in: deletedIds } } });
      return records;
    }, { timeout: 30000 });
    // No physical deletion occurs until the database transaction has committed.
    try {
      await this.retry(operationId);
    } catch {
      this.logger.warn(`Cleanup interrupted for operation ${operationId}; durable tasks remain retryable.`);
    }
    return { result: await this.status(operationId), records };
  }

  async status(operationId: string) {
    const operation = await this.prisma.galleryDeletionOperation.findUnique({ where: { id: operationId }, include: { tasks: true } });
    if (!operation) throw new NotFoundException('Deletion operation was not found.');
    return this.summarize(operation);
  }

  async listPending() {
    const operations = await this.prisma.galleryDeletionOperation.findMany({
      where: { tasks: { some: { status: { not: 'succeeded' } } } },
      include: { tasks: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 100,
    });
    return operations.map(operation => this.summarize(operation));
  }

  private summarize(operation: Prisma.GalleryDeletionOperationGetPayload<{ include: { tasks: true } }>) {
    const cleanup = {
      pending: operation.tasks.filter(task => task.status === 'pending').length,
      succeeded: operation.tasks.filter(task => task.status === 'succeeded').length,
      failed: operation.tasks.filter(task => task.status === 'failed').length,
    };
    return {
      operationId: operation.id, status: cleanup.failed ? 'cleanup_failed' : cleanup.pending ? 'cleanup_pending' : 'completed',
      requestedCount: operation.requestedIds.length, deletedIds: operation.deletedIds,
      notFoundIds: operation.notFoundIds, preservedAssetIds: operation.preservedIds, cleanup,
    };
  }

  async retry(operationId: string) {
    await this.status(operationId);
    const tasks = await this.prisma.galleryCleanupTask.findMany({ where: { operationId, status: { not: 'succeeded' } } });
    for (const task of tasks) {
      // A table lock serializes retries across processes and blocks media writers
      // while checking references and unlinking. A crash leaves a retryable task;
      // ENOENT handles a file unlinked before its success was committed.
      await this.prisma.$transaction(async tx => {
        await this.lockReferences(tx);
        const current = await tx.galleryCleanupTask.findUnique({ where: { id: task.id } });
        if (!current || current.status === 'succeeded') return;
        let status = 'succeeded';
        let lastError: string | null = null;
        try {
          this.assertUnshared(await this.references(tx), current.publicId);
          await this.storage.deleteFile(current.publicId);
        } catch {
          status = 'failed';
          lastError = 'Storage cleanup failed or an unsafe/shared reference was detected.';
        }
        await tx.galleryCleanupTask.update({ where: { id: current.id }, data: { status, lastError, attempts: { increment: 1 } } });
      }, { timeout: 30000 });
    }
    return this.status(operationId);
  }

  private async lockReferences(tx: Prisma.TransactionClient) {
    // Fixed SQL; no client input is interpolated. Include every media-bearing
    // table so concurrent metadata writes cannot race the reference checks.
    await tx.$executeRaw`LOCK TABLE "GalleryImage", "Event", "TicketPreview", "ExperienceImage", "WebsiteSettings", "GalleryCleanupTask" IN SHARE ROW EXCLUSIVE MODE`;
  }

  private async references(tx: Prisma.TransactionClient): Promise<Reference[]> {
    return tx.$queryRaw<Reference[]>`
      SELECT 'gallery' AS source, id, value FROM "GalleryImage", LATERAL unnest(ARRAY["imageUrl", "thumbnailUrl", "publicId"]) AS value WHERE value IS NOT NULL
      UNION ALL SELECT 'event', id, value FROM "Event", LATERAL unnest(ARRAY["heroImageUrl", "heroImagePublicId"]) AS value WHERE value IS NOT NULL
      UNION ALL SELECT 'ticket', id, "imageUrl" FROM "TicketPreview" WHERE "imageUrl" IS NOT NULL
      UNION ALL SELECT 'experience', id, "imageUrl" FROM "ExperienceImage"
      UNION ALL SELECT 'settings', id, value FROM "WebsiteSettings", LATERAL unnest(ARRAY["logoUrl", "compactLogoUrl", "faviconUrl", "socialImageUrl"]) AS value
    `;
  }

  private assertUnshared(references: Reference[], publicId: string, ownerId?: number) {
    const target = publicId.toLowerCase();
    if (references.some(reference => {
      if (reference.source === 'gallery' && reference.id === ownerId) return false;
      let value = reference.value.replaceAll('\\', '/');
      try { value = new URL(value, 'https://local.invalid').pathname; } catch { /* inspect raw malformed references conservatively */ }
      try { value = decodeURIComponent(value); } catch { /* retain undecodable input */ }
      value = posix.normalize(value).replace(/^\/uploads\//, '').replace(/^\//, '').toLowerCase();
      return value === target;
    })) throw new ConflictException('Gallery storage asset is shared by another record.');
  }
}
