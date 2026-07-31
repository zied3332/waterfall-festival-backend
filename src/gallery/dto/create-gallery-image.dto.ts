import {
  ApiProperty,
  ApiPropertyOptional,
} from "@nestjs/swagger";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from "class-validator";

import { GalleryStatus } from "../../generated/prisma/enums.js";

export class CreateGalleryImageDto {
  @ApiProperty({
    example: "Waterfall Festival Main Stage",
    description:
      "Public title of the gallery image.",
    minLength: 1,
  })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({
    example:
      "Festival visitors enjoying the main-stage performance.",
    description:
      "Optional description displayed with the gallery image.",
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example:
      "https://res.cloudinary.com/example/image/upload/waterfall-festival/gallery/main-stage.webp",
    description:
      "Public URL of the image stored in Cloudinary.",
    format: "uri",
  })
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  imageUrl!: string;

  @ApiPropertyOptional({
    example:
      "Crowd watching the Waterfall Festival main-stage performance",
    description:
      "Alternative text used for accessibility and image context.",
  })
  @IsOptional()
  @IsString()
  altText?: string;

  @ApiPropertyOptional({
    enum: GalleryStatus,
    enumName: "GalleryStatus",
    example: GalleryStatus.DRAFT,
    default: GalleryStatus.DRAFT,
    description:
      "Publishing status of the gallery image.",
  })
  @IsOptional()
  @IsEnum(GalleryStatus)
  status?: GalleryStatus;

  @ApiPropertyOptional({
    example: false,
    default: false,
    description:
      "Whether the image should be highlighted as a featured gallery image.",
  })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({
    example: 0,
    default: 0,
    minimum: 0,
    description:
      "Display position of the image. Lower values appear first.",
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({
    example: 12,
    minimum: 1,
    description:
      "Optional ID of the event associated with the gallery image.",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  eventId?: number;
}