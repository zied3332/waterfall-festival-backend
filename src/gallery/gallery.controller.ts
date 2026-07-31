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
      "List published gallery images",
    description:
      "Returns gallery images that are currently published on the public website. Images are ordered by sort order and then by creation date.",
  })
  @ApiOkResponse({
    description:
      "Published gallery images returned successfully.",
    type: GalleryImageResponseDto,
    isArray: true,
  })
  findPublished() {
    return this.galleryService.findPublished();
  }
}