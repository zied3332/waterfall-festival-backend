import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { AuthModule } from "./auth/auth.module.js";
import { ContactModule } from "./contact/contact.module.js";
import { EventsModule } from "./events/events.module.js";
import { ExperienceModule } from "./experience/experience.module.js";
import { FaqModule } from "./faq/faq.module.js";
import { GalleryModule } from "./gallery/gallery.module.js";
import { NotificationsModule } from "./notifications/notifications.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { SettingsModule } from "./settings/settings.module.js";
import { TicketsModule } from "./tickets/tickets.module.js";
import { UsersModule } from "./users/users.module.js";
import { AssistantModule } from "./assistant/assistant.module.js";
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    EventsModule,
    ContactModule,
    UsersModule,
    AuthModule,
    GalleryModule,
    FaqModule,
    NotificationsModule,
    ExperienceModule,
    TicketsModule,
    SettingsModule,
    AssistantModule,
  ],
  controllers: [
    AppController,
  ],
  providers: [
    AppService,
  ],
})
export class AppModule {}