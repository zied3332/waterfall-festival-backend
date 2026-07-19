import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';

import { AdminEventsController } from './admin-events.controller.js';
import { EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';

@Module({
  imports: [AuthModule],
  controllers: [EventsController, AdminEventsController],
  providers: [EventsService],
})
export class EventsModule {}
