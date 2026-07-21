import { PartialType } from "@nestjs/mapped-types";

import { CreateGalleryImageDto } from "./create-gallery-image.dto.js";

export class UpdateGalleryImageDto extends PartialType(
  CreateGalleryImageDto,
) {}