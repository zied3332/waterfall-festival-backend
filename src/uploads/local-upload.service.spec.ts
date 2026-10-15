import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { LocalUploadService } from './local-upload.service.js';

describe('Local gallery cleanup safety', () => {
  let root: string;
  let service: LocalUploadService;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'gallery-cleanup-'));
    const cwd = jest.spyOn(process, 'cwd').mockReturnValue(root);
    service = new LocalUploadService();
    cwd.mockRestore();
    await mkdir(join(root, 'uploads/gallery/images'), { recursive: true });
  });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });
  it('deletes a file and treats repeated missing-file cleanup as success', async () => {
    const file = join(root, 'uploads/gallery/images/test.jpg');
    await writeFile(file, 'isolated test media');
    await service.deleteFile('gallery/images/test.jpg');
    await expect(readFile(file)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(service.deleteFile('gallery/images/test.jpg')).resolves.toBeUndefined();
  });
  it.each(['gallery/images/../private.jpg', 'gallery/images/../../secret.jpg', '/gallery/images/test.jpg', 'gallery\\images\\test.jpg', 'gallery/images/%2e%2e.jpg', 'legacy/asset', 'gallery/images/test.jpg:stream'])('rejects unsafe path %s', async value => {
    await expect(service.deleteFile(value)).rejects.toThrow('Unsafe');
  });
  it('rejects a junction directory without touching its target', async () => {
    await rm(join(root, 'uploads/gallery/images'), { recursive: true });
    const outside = join(root, 'outside');
    await mkdir(outside); await writeFile(join(outside, 'test.jpg'), 'protected');
    await symlink(outside, join(root, 'uploads/gallery/images'), process.platform === 'win32' ? 'junction' : 'dir');
    await expect(service.deleteFile('gallery/images/test.jpg')).rejects.toThrow('unsafe');
    expect(await readFile(join(outside, 'test.jpg'), 'utf8')).toBe('protected');
  });
  it('reports filesystem failures instead of claiming success', async () => {
    await mkdir(join(root, 'uploads/gallery/images/directory.jpg'));
    await expect(service.deleteFile('gallery/images/directory.jpg')).rejects.toThrow();
  });
});
