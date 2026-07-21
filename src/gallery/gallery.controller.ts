import {
  Controller,
  Get,
} from "@nestjs/common";

import { GalleryService } from "./gallery.service.js";

@Controller("gallery")
export class GalleryController {
  constructor(
    private readonly galleryService: GalleryService,
  ) {}

  @Get()
  findPublished() {
    return this.galleryService.findPublished();
  }
}