import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { UserRole } from '../../generated/prisma/client.js';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';

import { CreateExperienceHighlightDto } from '../dto/create-experience-highlight.dto.js';
import { CreateExperienceImageDto } from '../dto/create-experience-image.dto.js';
import { CreateExperiencePageDto } from '../dto/create-experience-page.dto.js';
import { UpdateExperienceHighlightDto } from '../dto/update-experience-highlight.dto.js';
import { UpdateExperienceImageDto } from '../dto/update-experience-image.dto.js';
import { UpdateExperiencePageDto } from '../dto/update-experience-page.dto.js';

import { ExperienceService } from '../experience.service.js';

@Controller('admin/experience')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminExperienceController {
  constructor(
    private readonly experienceService: ExperienceService,
  ) {}

  /*
   * Experience page
   */

  @Get()
  findAdminPage() {
    return this.experienceService.findAdminPage();
  }

  @Post()
  createPage(
    @Body()
    createExperiencePageDto: CreateExperiencePageDto,
  ) {
    return this.experienceService.createPage(
      createExperiencePageDto,
    );
  }

  @Patch()
  updatePage(
    @Body()
    updateExperiencePageDto: UpdateExperiencePageDto,
  ) {
    return this.experienceService.updatePage(
      updateExperiencePageDto,
    );
  }

  /*
   * Experience highlights
   */

  @Get('highlights')
  findHighlights() {
    return this.experienceService.findHighlights();
  }

  @Get('highlights/:id')
  findHighlight(
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return this.experienceService.findHighlight(id);
  }

  @Post('highlights')
  createHighlight(
    @Body()
    createExperienceHighlightDto:
      CreateExperienceHighlightDto,
  ) {
    return this.experienceService.createHighlight(
      createExperienceHighlightDto,
    );
  }

  @Patch('highlights/:id')
  updateHighlight(
    @Param('id', ParseIntPipe)
    id: number,

    @Body()
    updateExperienceHighlightDto:
      UpdateExperienceHighlightDto,
  ) {
    return this.experienceService.updateHighlight(
      id,
      updateExperienceHighlightDto,
    );
  }

  @Delete('highlights/:id')
  removeHighlight(
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return this.experienceService.removeHighlight(id);
  }

  /*
   * Experience images
   */

  @Get('images')
  findImages() {
    return this.experienceService.findImages();
  }

  @Get('images/:id')
  findImage(
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return this.experienceService.findImage(id);
  }

  @Post('images')
  createImage(
    @Body()
    createExperienceImageDto:
      CreateExperienceImageDto,
  ) {
    return this.experienceService.createImage(
      createExperienceImageDto,
    );
  }

  @Patch('images/:id')
  updateImage(
    @Param('id', ParseIntPipe)
    id: number,

    @Body()
    updateExperienceImageDto:
      UpdateExperienceImageDto,
  ) {
    return this.experienceService.updateImage(
      id,
      updateExperienceImageDto,
    );
  }

  @Delete('images/:id')
  removeImage(
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return this.experienceService.removeImage(id);
  }
}