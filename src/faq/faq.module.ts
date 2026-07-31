import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { PrismaModule } from "../prisma/prisma.module.js";

import { AdminFaqController } from "./admin-faq.controller.js";
import { FaqController } from "./faq.controller.js";
import { FaqService } from "./faq.service.js";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
  ],
  controllers: [
    FaqController,
    AdminFaqController,
  ],
  providers: [
    FaqService,
  ],
  exports: [
    FaqService,
  ],
})
export class FaqModule {}