import { PartialType } from "@nestjs/swagger";

import { CreateGalleryImageDto } from "./create-gallery-image.dto.js";

export class UpdateGalleryImageDto extends PartialType(
  CreateGalleryImageDto,
) {}