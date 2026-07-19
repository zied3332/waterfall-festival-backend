import { Module } from '@nestjs/common';

import { AdminEventsController } from './admin-events.controller.js';
import { EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';

@Module({
  controllers: [EventsController, AdminEventsController],
  providers: [EventsService],
})
export class EventsModule {}
