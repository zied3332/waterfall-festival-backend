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
    FileInterceptor("image"),
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
}