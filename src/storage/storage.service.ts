import { Inject, Injectable, Logger } from '@nestjs/common';
import { extname, isAbsolute, join, normalize, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { LocalUploadService } from '../uploads/local-upload.service.js';
import { LocalImageStorageService } from './local-image-storage.service.js';
import { STORAGE_FILESYSTEM, type StorageFilesystem } from './storage-filesystem.js';
import type { MediaDirectoryStatsDto, StorageCategory, StorageStatsDto, StorageWarningDto } from './storage-stats.dto.js';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov']);
const POSTER_EXTENSIONS = new Set([...IMAGE_EXTENSIONS, '.avif']);
const CACHE_TTL_MS = 5000;

class UnsafeStoragePath extends Error {}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private cached?: { value: StorageStatsDto; expiresAt: number };
  private inFlight?: Promise<StorageStatsDto>;

  constructor(
    private readonly galleryStorage: LocalUploadService,
    private readonly posterStorage: LocalImageStorageService,
    @Inject(STORAGE_FILESYSTEM) private readonly fs: StorageFilesystem,
  ) {}

  async getStats(): Promise<StorageStatsDto> {
    if (this.cached && performance.now() < this.cached.expiresAt) return structuredClone(this.cached.value);
    if (!this.inFlight) {
      this.inFlight = this.measure().then(value => {
        // Failed/incomplete scans are not cached, so administrators can retry.
        if (value.status === 'ok') this.cached = { value, expiresAt: performance.now() + CACHE_TTL_MS };
        return value;
      }).finally(() => { this.inFlight = undefined; });
    }
    return structuredClone(await this.inFlight);
  }

  private async measure(): Promise<StorageStatsDto> {
    const scanStartedAt = new Date().toISOString();
    const warnings: StorageWarningDto[] = [];
    // These roots are captured by the actual uploaders. Never infer an app root
    // from this service's source/build location or a later process.cwd().
    const images = await this.scan(this.galleryStorage.getUploadsRoot(), ['gallery', 'images'], IMAGE_EXTENSIONS, 'gallery.images', warnings);
    const videos = await this.scan(this.galleryStorage.getUploadsRoot(), ['gallery', 'videos'], VIDEO_EXTENSIONS, 'gallery.videos', warnings);
    const posters = await this.scan(this.posterStorage.getUploadsRoot(), ['events'], POSTER_EXTENSIONS, 'events.posters', warnings);
    const categories = [images, videos, posters];
    const complete = categories.every(category => category.status === 'ok');
    const observed = {
      files: categories.reduce((sum, category) => sum + (category.count ?? 0), 0),
      bytes: categories.reduce((sum, category) => sum + (category.totalBytes ?? 0), 0),
    };
    const percentage = (bytes: number | null) => !complete ? null : observed.bytes ? (bytes ?? 0) / observed.bytes * 100 : 0;
    return {
      measuredAt: new Date().toISOString(), scanStartedAt, cacheTtlMs: CACHE_TTL_MS,
      status: complete ? 'ok' : categories.some(category => category.count !== null) ? 'partial' : 'unavailable',
      gallery: { images, videos }, events: { posters }, observed,
      total: complete ? { ...observed } : { files: null, bytes: null },
      percentages: { images: percentage(images.totalBytes), videos: percentage(videos.totalBytes), posters: percentage(posters.totalBytes) },
      warnings,
    };
  }

  private async scan(root: string, segments: string[], extensions: Set<string>, category: StorageCategory, warnings: StorageWarningDto[]): Promise<MediaDirectoryStatsDto> {
    let count = 0;
    let totalBytes = 0;
    let largestBytes = 0;
    let incomplete = false;
    const warn = (code: string, error?: unknown) => {
      if (!warnings.some(warning => warning.category === category && warning.code === code)) {
        warnings.push({ category, code });
        this.logger.warn(`${category}: ${code}`, error instanceof Error ? error.stack : undefined);
      }
    };
    try {
      if (!isAbsolute(root) || root.includes('\0')) throw new UnsafeStoragePath();
      const directory = join(root, ...segments);
      await this.validateDirectory(root, segments);
      const entries = await this.fs.opendir(directory);
      // Stream directory entries and inspect one at a time. Uploaders write flat
      // directories, so never recurse into nested or unrelated folders.
      for await (const entry of entries) {
        if (!extensions.has(extname(entry.name).toLowerCase())) continue;
        try {
          await this.validateDirectory(root, segments);
          const metadata = await this.fs.lstat(join(directory, entry.name));
          if (metadata.isSymbolicLink()) { warn('symlink_skipped'); continue; }
          if (!metadata.isFile()) continue;
          if (!Number.isSafeInteger(metadata.size) || metadata.size < 0 || !Number.isSafeInteger(totalBytes + metadata.size)) {
            incomplete = true; warn('invalid_file_size'); continue;
          }
          count++;
          totalBytes += metadata.size;
          largestBytes = Math.max(largestBytes, metadata.size);
        } catch (error: unknown) {
          if (error instanceof UnsafeStoragePath) throw error;
          incomplete = true;
          warn(this.errorCode(error) === 'ENOENT' ? 'file_disappeared' : 'metadata_unavailable', error);
        }
      }
      await this.validateDirectory(root, segments);
      return { status: incomplete ? 'partial' : 'ok', count, totalBytes, averageBytes: count ? totalBytes / count : 0, largestBytes };
    } catch (error: unknown) {
      const status = error instanceof UnsafeStoragePath ? 'unsafe' : this.errorCode(error) === 'ENOENT' ? 'missing' : 'unavailable';
      warn(status === 'unsafe' ? 'unsafe_directory' : status === 'missing' ? 'directory_missing' : 'directory_unavailable', error);
      // Never present an unreadable, missing, or unsafe directory as empty.
      return { status, count: null, totalBytes: null, averageBytes: null, largestBytes: null };
    }
  }

  private async validateDirectory(root: string, segments: string[]) {
    let current = normalize(root);
    for (const segment of ['', ...segments]) {
      if (segment) current = join(current, segment);
      const metadata = await this.fs.lstat(current);
      if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new UnsafeStoragePath();
      const canonical = await this.fs.realpath(current);
      const expected = resolve(current);
      const matches = process.platform === 'win32' ? canonical.toLowerCase() === expected.toLowerCase() : canonical === expected;
      if (!matches) throw new UnsafeStoragePath();
    }
  }

  private errorCode(error: unknown): string | undefined {
    return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code : undefined;
  }
}
