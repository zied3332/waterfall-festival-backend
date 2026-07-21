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
} from "@nestjs/common";

import { UserRole } from "../../generated/prisma/client.js";
import { Roles } from "../../auth/decorators/roles.decorator.js";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../../auth/guards/roles.guard.js";
import { CreateGalleryImageDto } from "../dto/create-gallery-image.dto.js";
import { UpdateGalleryImageDto } from "../dto/update-gallery-image.dto.js";
import { GalleryService } from "../gallery.service.js";

@Controller("admin/gallery")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminGalleryController {
  constructor(
    private readonly galleryService: GalleryService,
  ) {}

  @Get()
  findAll() {
    return this.galleryService.findAllAdmin();
  }

  @Post()
  create(
    @Body()
    createGalleryImageDto: CreateGalleryImageDto,
  ) {
    return this.galleryService.create(
      createGalleryImageDto,
    );
  }

  @Patch(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body()
    updateGalleryImageDto: UpdateGalleryImageDto,
  ) {
    return this.galleryService.update(
      id,
      updateGalleryImageDto,
    );
  }

  @Delete(":id")
  remove(
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.galleryService.remove(id);
  }
}