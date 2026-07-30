import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";

import { Roles } from "../auth/decorators/roles.decorator.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { UserRole } from "../generated/prisma/enums.js";
import { CreateEventDto } from "./dto/create-event.dto.js";
import { UpdateEventDto } from "./dto/update-event.dto.js";
import { EventsService } from "./events.service.js";

const MAX_HERO_IMAGE_SIZE =
  5 * 1024 * 1024;

const ALLOWED_HERO_IMAGE_MIME_TYPES =
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/avif",
  ]);

@Controller("admin/events")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminEventsController {
  constructor(
    private readonly eventsService: EventsService,
  ) {}

  @Post()
  create(
    @Body()
    createEventDto: CreateEventDto,
  ) {
    return this.eventsService.create(
      createEventDto,
    );
  }

  @Get()
  findAll() {
    return this.eventsService.findAllForAdmin();
  }

  @Patch(":id/hero-image")
  @UseInterceptors(
    FileInterceptor("image", {
      limits: {
        fileSize: MAX_HERO_IMAGE_SIZE,
        files: 1,
      },
      fileFilter: (
        _request,
        file,
        callback,
      ) => {
        if (
          !ALLOWED_HERO_IMAGE_MIME_TYPES.has(
            file.mimetype,
          )
        ) {
          callback(
            new BadRequestException(
              "Only JPG, PNG, WebP and AVIF images are allowed.",
            ),
            false,
          );

          return;
        }

        callback(null, true);
      },
    }),
  )
  uploadHeroImage(
    @Param("id", ParseIntPipe)
    id: number,
    @UploadedFile()
    file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        "An event hero image is required.",
      );
    }

    return this.eventsService.uploadHeroImage(
      id,
      file,
    );
  }

  @Patch(":id")
  update(
    @Param("id", ParseIntPipe)
    id: number,
    @Body()
    updateEventDto: UpdateEventDto,
  ) {
    return this.eventsService.update(
      id,
      updateEventDto,
    );
  }

  @Delete(":id")
  remove(
    @Param("id", ParseIntPipe)
    id: number,
  ) {
    return this.eventsService.remove(id);
  }
  @Get(":id")
findOne(
  @Param("id", ParseIntPipe)
  id: number,
) {
  return this.eventsService.findOneForAdmin(
    id,
  );
}
}