import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';

import { FaqController } from './faq.controller.js';
import { FaqService } from './faq.service.js';

describe('FaqController', () => {
  let controller: FaqController;

  const faqServiceMock = {
    findAll: jest.fn(),
    findPublished: jest.fn(),
    findOne: jest.fn(),
    findOnePublished: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FaqController],
      providers: [
        {
          provide: FaqService,
          useValue: faqServiceMock,
        },
      ],
    }).compile();

    controller = module.get<FaqController>(FaqController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
