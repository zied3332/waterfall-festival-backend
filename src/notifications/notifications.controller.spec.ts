import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';

import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
describe('NotificationsController', () => {
  let controller: NotificationsController;

  const notificationsServiceMock = {
    create: jest.fn(),
    findAll: jest.fn(),
    getUnreadCount: jest.fn(),
    getRecent: jest.fn(),
    markAllAsRead: jest.fn(),
    markAsRead: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],

      providers: [
        {
          provide: NotificationsService,
          useValue: notificationsServiceMock,
        },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
