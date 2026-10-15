import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import {
  Test,
  TestingModule,
} from '@nestjs/testing';

import {
  PrismaService,
} from '../prisma/prisma.service.js';

import { GalleryDeletionService } from './gallery-deletion.service.js';

import {
  GalleryService,
} from './gallery.service.js';

describe('GalleryService', () => {
  let service: GalleryService;

  const prismaMock = {
    galleryImage: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },

    event: {
      findUnique: jest.fn(),
    },
  };

  const deletionServiceMock = {
    delete: jest.fn<GalleryDeletionService['delete']>(),
  };

  beforeEach(async () => {
    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          GalleryService,

          {
            provide: PrismaService,
            useValue: prismaMock,
          },

          {
            provide: GalleryDeletionService,
            useValue: deletionServiceMock,
          },
        ],
      }).compile();

    service =
      module.get<GalleryService>(
        GalleryService,
      );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('keeps the single-delete record response and adds cleanup information', async () => {
    const record = { id: 12, title: 'Image' };
    const result = { operationId: 'op', status: 'cleanup_failed', cleanup: { failed: 1 } };
    deletionServiceMock.delete.mockResolvedValueOnce({ records: [record], result } as Awaited<ReturnType<GalleryDeletionService['delete']>>);
    expect(await service.remove(12)).toEqual({ ...record, deletion: result });
    expect(deletionServiceMock.delete).toHaveBeenCalledWith([12], false);
  });
});
