import { OmitType, PartialType } from "@nestjs/swagger";

import { CreateGalleryImageDto } from "./create-gallery-image.dto.js";

export class UpdateGalleryImageDto extends PartialType(
  OmitType(CreateGalleryImageDto, ['imageUrl', 'publicId', 'thumbnailUrl', 'mediaType'] as const),
) {}
