import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

import { AdminExperienceController } from './admin-experience/admin-experience.controller.js';
import { ExperienceController } from './experience.controller.js';
import { ExperienceService } from './experience.service.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
  ],
  controllers: [
    ExperienceController,
    AdminExperienceController,
  ],
  providers: [
    ExperienceService,
  ],
  exports: [
    ExperienceService,
  ],
})
export class ExperienceModule {}