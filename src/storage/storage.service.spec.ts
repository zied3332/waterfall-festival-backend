import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalUploadService } from '../uploads/local-upload.service.js';
import { LocalImageStorageService } from './local-image-storage.service.js';
import { storageFilesystem, type StorageFilesystem } from './storage-filesystem.js';
import { StorageService } from './storage.service.js';

describe('Filesystem media monitoring', () => {
  let root: string;
  let uploads: LocalUploadService;
  let posters: LocalImageStorageService;
  let service: StorageService;
  let directories: { images: string; videos: string; posters: string };

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'waterfall-storage-'));
    const cwd = jest.spyOn(process, 'cwd').mockReturnValue(root);
    uploads = new LocalUploadService(); posters = new LocalImageStorageService();
    cwd.mockRestore();
    directories = {
      images: join(root, 'uploads/gallery/images'), videos: join(root, 'uploads/gallery/videos'), posters: join(root, 'uploads/events'),
    };
    await Promise.all(Object.values(directories).map(directory => mkdir(directory, { recursive: true })));
    service = new StorageService(uploads, posters, storageFilesystem);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  });

  async function fixture(directory: keyof typeof directories, name: string, bytes: number) {
    await writeFile(join(directories[directory], name), Buffer.alloc(bytes));
  }

  function withFilesystem(overrides: Partial<StorageFilesystem>) {
    service = new StorageService(uploads, posters, { ...storageFilesystem, ...overrides });
  }

  it('measures empty directories successfully without dividing by zero', async () => {
    const result = await service.getStats();
    expect(result).toMatchObject({ status: 'ok', total: { files: 0, bytes: 0 }, percentages: { images: 0, videos: 0, posters: 0 }, warnings: [] });
    expect(result.gallery.images).toEqual({ status: 'ok', count: 0, totalBytes: 0, averageBytes: 0, largestBytes: 0 });
    expect(Number.isNaN(Date.parse(result.measuredAt))).toBe(false);
  });

  it('calculates image/video/poster sizes, averages, largest files, totals and percentages', async () => {
    await fixture('images', 'one.JPG', 100); await fixture('images', 'two.webp', 300);
    await fixture('videos', 'one.mp4', 500); await fixture('videos', 'two.mov', 100);
    await fixture('posters', 'event.avif', 200); await fixture('posters', 'event.jpeg', 800);
    const result = await service.getStats();
    expect(result.gallery.images).toEqual({ status: 'ok', count: 2, totalBytes: 400, averageBytes: 200, largestBytes: 300 });
    expect(result.gallery.videos).toEqual({ status: 'ok', count: 2, totalBytes: 600, averageBytes: 300, largestBytes: 500 });
    expect(result.events.posters.totalBytes).toBe(1000);
    expect(result.total).toEqual({ files: 6, bytes: 2000 });
    expect(result.percentages).toEqual({ images: 20, videos: 30, posters: 50 });
  });

  it('uses the uploader roots captured before cwd changes and counts only allowed flat regular files', async () => {
    await fixture('images', 'photo.png', 1);
    await fixture('images', 'ignore.avif', 100); await fixture('images', 'ignore.mp4', 100);
    await fixture('images', 'ignore.txt', 100); await fixture('videos', 'ignore.jpg', 100);
    await mkdir(join(directories.images, 'nested.jpg'));
    await writeFile(join(directories.images, 'nested.jpg', 'photo.jpg'), Buffer.alloc(100));
    await mkdir(join(root, 'node_modules'));
    await writeFile(join(root, 'node_modules', 'photo.jpg'), Buffer.alloc(100));
    expect(process.cwd()).not.toBe(root);
    expect((await service.getStats()).total).toEqual({ files: 1, bytes: 1 });
  });

  it('measures zero-byte media files and fractional averages accurately', async () => {
    await fixture('images', 'empty.jpg', 0); await fixture('images', 'one.jpg', 1);
    expect((await service.getStats()).gallery.images).toMatchObject({ count: 2, totalBytes: 1, averageBytes: 0.5, largestBytes: 1 });
  });

  it('distinguishes missing directories from empty directories', async () => {
    await rm(directories.images, { recursive: true });
    const result = await service.getStats();
    expect(result.status).toBe('partial');
    expect(result.gallery.images).toMatchObject({ status: 'missing', count: null, totalBytes: null });
    expect(result.total).toEqual({ files: null, bytes: null });
    expect(result.percentages).toEqual({ images: null, videos: null, posters: null });
    expect(result.gallery.videos.status).toBe('ok');
  });

  it('does not create a missing uploads root or report it as successfully empty', async () => {
    await rm(join(root, 'uploads'), { recursive: true });
    expect(await service.getStats()).toMatchObject({ status: 'unavailable', total: { files: null, bytes: null } });
    await expect(storageFilesystem.lstat(join(root, 'uploads'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('reports directory permission errors without exposing server paths', async () => {
    withFilesystem({ opendir: path => path === directories.images
      ? Promise.reject(Object.assign(new Error(`Permission denied: ${root}/secret`), { code: 'EACCES' }))
      : storageFilesystem.opendir(path) });
    const result = await service.getStats();
    expect(result.gallery.images).toMatchObject({ status: 'unavailable', count: null });
    expect(result.warnings).toContainEqual({ category: 'gallery.images', code: 'directory_unavailable' });
    expect(JSON.stringify(result)).not.toContain(root);
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it.each(['ENOENT', 'EACCES', 'EIO'])('handles file metadata failure %s as an incomplete scan', async code => {
    await fixture('images', 'valid.jpg', 5); await fixture('images', 'unreadable.jpg', 10);
    const target = join(directories.images, 'unreadable.jpg');
    withFilesystem({ lstat: path => path === target ? Promise.reject(Object.assign(new Error('simulated race'), { code })) : storageFilesystem.lstat(path) });
    const result = await service.getStats();
    expect(result.gallery.images).toMatchObject({ status: 'partial', count: 1, totalBytes: 5 });
    expect(result.total.bytes).toBeNull();
    expect(result.observed.bytes).toBe(5);
    expect(result.warnings).toContainEqual({ category: 'gallery.images', code: code === 'ENOENT' ? 'file_disappeared' : 'metadata_unavailable' });
  });

  it('refuses linked category directories without scanning their targets', async () => {
    const outside = join(root, 'outside'); await mkdir(outside);
    await writeFile(join(outside, 'secret.jpg'), Buffer.alloc(100));
    await rm(directories.images, { recursive: true });
    await symlink(outside, directories.images, process.platform === 'win32' ? 'junction' : 'dir');
    const result = await service.getStats();
    expect(result.gallery.images).toMatchObject({ status: 'unsafe', count: null, totalBytes: null });
    expect(result.observed.bytes).toBe(0);
  });

  it('skips supported-extension symlink entries instead of following them', async () => {
    const outside = join(root, 'outside'); await mkdir(outside);
    await writeFile(join(outside, 'photo.jpg'), Buffer.alloc(100));
    await symlink(outside, join(directories.images, 'linked.jpg'), process.platform === 'win32' ? 'junction' : 'dir');
    expect(await service.getStats()).toMatchObject({ status: 'ok', total: { bytes: 0, files: 0 }, warnings: [{ category: 'gallery.images', code: 'symlink_skipped' }] });
  });

  it('refuses a regular file where a directory is expected', async () => {
    await rm(directories.images, { recursive: true });
    await writeFile(directories.images, 'not a directory');
    expect((await service.getStats()).gallery.images.status).toBe('unsafe');
  });

  it('rejects invalid root paths without returning them to clients', async () => {
    jest.spyOn(uploads, 'getUploadsRoot').mockReturnValue('relative/private/uploads');
    const result = await service.getStats();
    expect(result.gallery.images.status).toBe('unsafe');
    expect(JSON.stringify(result)).not.toContain('relative/private');
  });

  it('shares concurrent scans, caches complete results briefly, and prevents consumer mutations', async () => {
    const opendir = jest.fn(storageFilesystem.opendir);
    withFilesystem({ opendir });
    const [first, second] = await Promise.all([service.getStats(), service.getStats()]);
    expect(opendir).toHaveBeenCalledTimes(3);
    expect(first).toEqual(second);
    first.gallery.images.count = 100;
    await fixture('images', 'later.jpg', 5);
    expect((await service.getStats()).gallery.images.count).toBe(0);
    expect(opendir).toHaveBeenCalledTimes(3);
  });

  it('does not cache incomplete measurements', async () => {
    await rm(directories.images, { recursive: true });
    expect((await service.getStats()).gallery.images.status).toBe('missing');
    await mkdir(directories.images);
    expect((await service.getStats()).status).toBe('ok');
  });
});
