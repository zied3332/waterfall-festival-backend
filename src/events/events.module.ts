import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { CloudinaryModule } from "../cloudinary/cloudinary.module.js";
import { PrismaModule } from "../prisma/prisma.module.js";

import { AdminEventsController } from "./admin-events.controller.js";
import { EventsController } from "./events.controller.js";
import { EventsService } from "./events.service.js";

@Module({
  imports: [
    PrismaModule,
    CloudinaryModule,
    AuthModule,
  ],
  controllers: [
    EventsController,
    AdminEventsController,
  ],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}