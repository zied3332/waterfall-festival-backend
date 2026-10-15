/* Async database and storage mocks intentionally return resolved promises. */
/* eslint-disable @typescript-eslint/require-await */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { GalleryDeletionService } from './gallery-deletion.service.js';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { LocalUploadService } from '../uploads/local-upload.service.js';

type RecordRow = { id: number; mediaType: string; publicId: string | null; imageUrl: string; thumbnailUrl: string | null };
type Task = { id: string; publicId: string; operationId: string; status: string; attempts: number; lastError: string | null };
type Operation = { id: string; requestedIds: number[]; deletedIds: number[]; notFoundIds: number[]; preservedIds: number[] };

describe('Durable gallery deletion', () => {
  let rows: RecordRow[];
  let operation: Operation | null;
  let tasks: Task[];
  let references: { source: string; id: number; value: string }[];
  let committed: boolean;
  const storage = { validateDeletionPath: jest.fn<(id: string) => Promise<void>>(async () => undefined), deleteFile: jest.fn<(id: string) => Promise<void>>(async () => undefined) };
  const tx = {
    $executeRaw: jest.fn(async () => 0),
    $queryRaw: jest.fn(async () => references),
    galleryImage: {
      findMany: jest.fn(async ({ where }: { where: { id: { in: number[] } } }) => rows.filter(row => where.id.in.includes(row.id))),
      deleteMany: jest.fn(async () => { rows = []; return { count: 2 }; }),
    },
    galleryDeletionOperation: {
      create: jest.fn(async ({ data }: { data: Operation & { tasks: { create: { id: string; publicId: string }[] } } }) => {
        operation = data;
        tasks = data.tasks.create.map(task => ({ ...task, operationId: data.id, status: 'pending', attempts: 0, lastError: null }));
        return data;
      }),
      findUnique: jest.fn(async () => operation && { ...operation, tasks }),
      findMany: jest.fn(async () => operation && tasks.some(task => task.status !== 'succeeded') ? [{ ...operation, tasks }] : []),
    },
    galleryCleanupTask: {
      findUnique: jest.fn(async ({ where }: { where: { id?: string; publicId?: string } }) => tasks.find(task => where.id ? task.id === where.id : task.publicId === where.publicId) ?? null),
      findMany: jest.fn(async () => tasks.filter(task => task.status !== 'succeeded')),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: { status: string; lastError: string | null } }) => {
        const task = tasks.find(task => task.id === where.id)!;
        task.status = data.status; task.lastError = data.lastError; task.attempts++; return task;
      }),
    },
  };
  const prisma = { ...tx, $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => { const result = await callback(tx); committed = true; return result; }) };
  const service = new GalleryDeletionService(prisma as unknown as PrismaService, storage as unknown as LocalUploadService);
  beforeEach(() => {
    jest.clearAllMocks();
    rows = [1, 2].map(id => ({ id, mediaType: 'IMAGE', publicId: `gallery/images/${id}.jpg`, imageUrl: `/uploads/gallery/images/${id}.jpg`, thumbnailUrl: null }));
    tasks = []; operation = null; references = []; committed = false;
    prisma.$transaction.mockImplementation(async callback => { const result = await callback(tx); committed = true; return result; });
    storage.validateDeletionPath.mockImplementation(async () => undefined);
    storage.deleteFile.mockImplementation(async () => { expect(committed).toBe(true); });
  });
  it('deletes multiple images, reports missing IDs and cleans only after commit', async () => {
    const { result } = await service.delete([1, 2, 3]);
    expect(result).toMatchObject({ requestedCount: 3, deletedIds: [1, 2], notFoundIds: [3], status: 'completed', cleanup: { pending: 0, succeeded: 2, failed: 0 } });
    expect(storage.deleteFile).toHaveBeenCalledTimes(2);
  });
  it('reports all missing IDs and safely handles a repeated request', async () => {
    await service.delete([1, 2]);
    const { result } = await service.delete([1, 2]);
    expect(result.deletedIds).toEqual([]);
    expect(result.notFoundIds).toEqual([1, 2]);
    expect(storage.deleteFile).toHaveBeenCalledTimes(2);
  });
  it('rejects an entire mixed image/video batch', async () => {
    rows[1].mediaType = 'VIDEO';
    await expect(service.delete([1, 2])).rejects.toThrow('images only');
    expect(tx.galleryImage.deleteMany).not.toHaveBeenCalled();
    expect(storage.deleteFile).not.toHaveBeenCalled();
  });
  it('does not touch files when a database transaction fails', async () => {
    prisma.$transaction.mockRejectedValueOnce(new Error('database failure'));
    await expect(service.delete([1])).rejects.toThrow('database failure');
    expect(storage.deleteFile).not.toHaveBeenCalled();
  });
  it('does not touch files when the transaction fails to commit after its callback', async () => {
    prisma.$transaction.mockImplementationOnce(async callback => {
      await callback(tx);
      throw new Error('commit failed');
    });
    await expect(service.delete([1])).rejects.toThrow('commit failed');
    expect(storage.deleteFile).not.toHaveBeenCalled();
  });
  it('retains discoverable pending work when cleanup is interrupted and retries after restart', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    prisma.$transaction.mockImplementationOnce(async callback => { const result = await callback(tx); committed = true; return result; });
    prisma.$transaction.mockRejectedValueOnce(new Error('cleanup database unavailable'));
    const { result } = await service.delete([1]);
    expect(result.status).toBe('cleanup_pending');
    expect(await service.listPending()).toEqual([result]);
    const restarted = new GalleryDeletionService(prisma as unknown as PrismaService, storage as unknown as LocalUploadService);
    expect((await restarted.retry(result.operationId)).status).toBe('completed');
    expect(await restarted.listPending()).toEqual([]);
    warn.mockRestore();
  });
  it('records cleanup failure, retries successfully, and skips completed tasks', async () => {
    storage.deleteFile.mockRejectedValueOnce(new Error('permission denied'));
    const { result } = await service.delete([1]);
    expect(result.status).toBe('cleanup_failed');
    expect(result.cleanup.failed).toBe(1);
    expect((await service.retry(result.operationId)).status).toBe('completed');
    await service.retry(result.operationId);
    expect(storage.deleteFile).toHaveBeenCalledTimes(2);
    expect(tasks[0].attempts).toBe(2);
  });
  it('rejects unsafe paths before deleting records', async () => {
    storage.validateDeletionPath.mockRejectedValueOnce(new Error('unsafe path'));
    await expect(service.delete([1])).rejects.toThrow('unsafe path');
    expect(tx.galleryImage.deleteMany).not.toHaveBeenCalled();
  });
  it.each(['https://example.org/uploads/gallery/images/1.jpg', '/uploads/gallery/images/1.jpg', 'gallery/images/1.jpg'])('rejects shared reference %s', async value => {
    references = [{ source: 'experience', id: 99, value }];
    await expect(service.delete([1])).rejects.toThrow('shared');
    expect(tx.galleryImage.deleteMany).not.toHaveBeenCalled();
  });
  it('rechecks shared references on retry', async () => {
    storage.deleteFile.mockRejectedValueOnce(new Error('busy'));
    const { result } = await service.delete([1]);
    references = [{ source: 'ticket', id: 99, value: '/uploads/gallery/images/1.jpg' }];
    expect((await service.retry(result.operationId)).cleanup.failed).toBe(1);
    expect(storage.deleteFile).toHaveBeenCalledTimes(1);
  });
  it('preserves legacy Cloudinary files explicitly', async () => {
    rows[0].imageUrl = 'https://res.cloudinary.com/legacy/image/upload/asset.jpg';
    rows[0].publicId = 'legacy/asset';
    const { result } = await service.delete([1]);
    expect(result.preservedAssetIds).toEqual([1]);
    expect(storage.deleteFile).not.toHaveBeenCalled();
  });
  it('reports preserved remote thumbnails alongside successful local cleanup', async () => {
    rows[0].thumbnailUrl = 'https://res.cloudinary.com/legacy/image/upload/poster.jpg';
    const { result } = await service.delete([1]);
    expect(result.preservedAssetIds).toEqual([1]);
    expect(result.cleanup.succeeded).toBe(1);
  });
  it('rejects separate local thumbnails with unverified ownership', async () => {
    rows[0].thumbnailUrl = '/uploads/gallery/images/poster.jpg';
    await expect(service.delete([1])).rejects.toThrow('thumbnail ownership');
    expect(tx.galleryImage.deleteMany).not.toHaveBeenCalled();
  });
  it('rejects references shared even between selected images', async () => {
    references = [{ source: 'gallery', id: 2, value: '/uploads/gallery/images/1.jpg' }];
    await expect(service.delete([1, 2])).rejects.toThrow('shared');
    expect(tx.galleryImage.deleteMany).not.toHaveBeenCalled();
  });
  it('rejects assets already reserved by cleanup tasks', async () => {
    tasks = [{ id: 'existing', publicId: 'gallery/images/1.jpg', operationId: 'existing-operation', status: 'failed', attempts: 1, lastError: 'busy' }];
    await expect(service.delete([1])).rejects.toThrow('already belongs');
    expect(tx.galleryImage.deleteMany).not.toHaveBeenCalled();
  });
  it('rejects ambiguous providers', async () => {
    rows[0].imageUrl = 'https://other.org/asset.jpg';
    await expect(service.delete([1])).rejects.toThrow('Ambiguous');
  });
  it('supports individual video deletion and missing single IDs', async () => {
    rows[0].mediaType = 'VIDEO'; rows[0].publicId = 'gallery/videos/1.mp4'; rows[0].imageUrl = '/uploads/gallery/videos/1.mp4';
    expect((await service.delete([1], false)).records[0].mediaType).toBe('VIDEO');
    await expect(service.delete([99], false)).rejects.toThrow('not found');
  });
  it('reports unknown operation IDs', async () => {
    await expect(service.status('unknown')).rejects.toThrow('not found');
  });
});
