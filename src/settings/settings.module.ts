import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { AdminSettingsController } from "./admin-settings.controller.js";
import { SettingsController } from "./settings.controller.js";
import { SettingsService } from "./settings.service.js";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
  ],
  controllers: [
    SettingsController,
    AdminSettingsController,
  ],
  providers: [
    SettingsService,
  ],
  exports: [
    SettingsService,
  ],
})
export class SettingsModule {}