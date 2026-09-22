import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';

import { CloudinaryService } from '../cloudinary/cloudinary.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { GalleryService } from './gallery.service.js';

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

  const cloudinaryServiceMock = {
    deleteImage: jest.fn(),
    deleteVideo: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GalleryService,

        {
          provide: PrismaService,
          useValue: prismaMock,
        },

        {
          provide: CloudinaryService,
          useValue: cloudinaryServiceMock,
        },
      ],
    }).compile();

    service = module.get<GalleryService>(GalleryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
