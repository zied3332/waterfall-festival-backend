import {
  Controller,
  Get,
} from "@nestjs/common";

import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

import { GalleryImageResponseDto } from "./dto/gallery-image-response.dto.js";
import { GalleryService } from "./gallery.service.js";

@ApiTags("Public Gallery")
@Controller("gallery")
export class GalleryController {
  constructor(
    private readonly galleryService: GalleryService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      "List published gallery media",
    description:
      "Returns all published gallery images and videos ordered by sort order and creation date.",
  })
  @ApiOkResponse({
    description:
      "Published gallery media returned successfully.",
    type: GalleryImageResponseDto,
    isArray: true,
  })
  findPublished() {
    return this.galleryService.findPublished();
  }

  @Get("images")
  @ApiOperation({
    summary:
      "List published gallery images",
  })
  @ApiOkResponse({
    type: GalleryImageResponseDto,
    isArray: true,
  })
  findPublishedImages() {
    return this.galleryService.findPublishedImages();
  }

  @Get("videos")
  @ApiOperation({
    summary:
      "List published gallery videos",
  })
  @ApiOkResponse({
    type: GalleryImageResponseDto,
    isArray: true,
  })
  findPublishedVideos() {
    return this.galleryService.findPublishedVideos();
  }

  @Get("homepage-videos")
  @ApiOperation({
    summary:
      "List videos selected for homepage reels",
    description:
      "Returns published videos selected by the administrator for the homepage reels carousel.",
  })
  @ApiOkResponse({
    description:
      "Homepage reel videos returned successfully.",
    type: GalleryImageResponseDto,
    isArray: true,
  })
  findHomepageVideos() {
    return this.galleryService.findHomepageVideos();
  }
}