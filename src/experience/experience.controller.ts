import { Controller, Get } from '@nestjs/common';

import { ExperienceService } from './experience.service.js';

@Controller('experience')
export class ExperienceController {
  constructor(
    private readonly experienceService: ExperienceService,
  ) {}

  @Get()
  findPublicPage() {
    return this.experienceService.findPublicPage();
  }
}