import { Test, TestingModule } from '@nestjs/testing';
import { AdminGalleryController } from './admin-gallery.controller';

describe('AdminGalleryController', () => {
  let controller: AdminGalleryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminGalleryController],
    }).compile();

    controller = module.get<AdminGalleryController>(AdminGalleryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
