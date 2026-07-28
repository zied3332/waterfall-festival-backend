import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { AdminTicketsController } from './admin-tickets.controller.js';
import { TicketsController } from './tickets.controller.js';
import { TicketsService } from './tickets.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [
    TicketsController,
    AdminTicketsController,
  ],
  providers: [TicketsService],
})
export class TicketsModule {}