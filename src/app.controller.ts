import { Controller, Get } from '@nestjs/common';

import { PrismaService } from './prisma/prisma.service.js';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  getApiInfo() {
    return {
      name: 'Waterfall Festival API',
      status: 'running',
    };
  }

  @Get('database-check')
  async checkDatabase() {
    await this.prisma.$queryRaw`SELECT 1`;

    return {
      database: 'connected',
    };
  }
}