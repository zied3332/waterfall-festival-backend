import {
  Module,
} from "@nestjs/common";

import {
  AuthModule,
} from "../auth/auth.module.js";

import {
  PrismaModule,
} from "../prisma/prisma.module.js";

import {
  LocalImageStorageService,
} from "../storage/local-image-storage.service.js";

import {
  AdminEventsController,
} from "./admin-events.controller.js";

import {
  EventsController,
} from "./events.controller.js";

import {
  EventsService,
} from "./events.service.js";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
  ],

  controllers: [
    EventsController,
    AdminEventsController,
  ],

  providers: [
    EventsService,
    LocalImageStorageService,
  ],

  exports: [
    EventsService,
  ],
})
export class EventsModule {}