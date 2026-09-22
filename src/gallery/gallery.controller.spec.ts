import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';

import { GalleryController } from './gallery.controller.js';
import { GalleryService } from './gallery.service.js';

describe('GalleryController', () => {
  let controller: GalleryController;

  const galleryServiceMock = {
    findPublished: jest.fn(),
    findPublishedImages: jest.fn(),
    findPublishedVideos: jest.fn(),
    findHomepageVideos: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GalleryController],

      providers: [
        {
          provide: GalleryService,
          useValue: galleryServiceMock,
        },
      ],
    }).compile();

    controller = module.get<GalleryController>(GalleryController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
