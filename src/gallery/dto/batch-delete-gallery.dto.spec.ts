import { describe, expect, it } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BatchDeleteGalleryDto } from './batch-delete-gallery.dto.js';
import { UpdateGalleryImageDto } from './update-gallery-image.dto.js';

describe('Gallery deletion input', () => {
  it.each([[], [1, 1], [0], [-1], [1.5], ['1'], [null], [2147483648], Array.from({ length: 101 }, (_, i) => i + 1), undefined, '1'])('rejects invalid IDs %j', async (ids) => {
    expect((await validate(plainToInstance(BatchDeleteGalleryDto, { ids }))).length).toBeGreaterThan(0);
  });
  it('accepts integer IDs including the PostgreSQL upper bound', async () => {
    expect(await validate(plainToInstance(BatchDeleteGalleryDto, { ids: [1, 2147483647] }))).toEqual([]);
  });
  it('rejects storage ownership updates', async () => {
    expect((await validate(plainToInstance(UpdateGalleryImageDto, { publicId: 'gallery/images/other.jpg' }), { whitelist: true, forbidNonWhitelisted: true })).length).toBeGreaterThan(0);
  });
});
