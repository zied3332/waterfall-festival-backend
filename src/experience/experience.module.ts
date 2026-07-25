import { Module } from '@nestjs/common';
import { ExperienceController } from './experience.controller';
import { ExperienceService } from './experience.service';
import { AdminExperienceController } from './admin-experience/admin-experience.controller';

@Module({
  controllers: [ExperienceController, AdminExperienceController],
  providers: [ExperienceService]
})
export class ExperienceModule {}
