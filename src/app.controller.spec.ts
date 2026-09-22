import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';

import { AppController } from './app.controller.js';
import { PrismaService } from './prisma/prisma.service.js';

describe('AppController', () => {
  let appController: AppController;

  const prismaMock = {
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],

      providers: [
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('root', () => {
    it('should return the API status', () => {
      expect(appController.getApiInfo()).toEqual({
        name: 'Waterfall Festival API',
        status: 'running',
      });
    });
  });

  describe('database-check', () => {
    it('should return connected when the database query succeeds', async () => {
      prismaMock.$queryRaw.mockResolvedValueOnce([] as never);

      await expect(appController.checkDatabase()).resolves.toEqual({
        database: 'connected',
      });

      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });
});
