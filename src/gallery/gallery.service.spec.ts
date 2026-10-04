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

import {
  LocalUploadService,
} from '../uploads/local-upload.service.js';

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

  const localUploadServiceMock = {
    deleteFile: jest.fn(),
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
            provide: LocalUploadService,
            useValue: localUploadServiceMock,
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
});