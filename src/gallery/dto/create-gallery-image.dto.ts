import {
  ApiProperty,
  ApiPropertyOptional,
} from "@nestjs/swagger";

import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from "class-validator";

import {
  GalleryMediaType,
  GalleryStatus,
} from "../../generated/prisma/enums.js";

export class CreateGalleryImageDto {
  @ApiProperty({
    example: "Waterfall Festival Main Stage",
    description:
      "Public title of the gallery media item.",
    minLength: 1,
  })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({
    example:
      "Festival visitors enjoying the main-stage performance.",
    description:
      "Optional description displayed with the gallery media item.",
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    enum: GalleryMediaType,
    enumName: "GalleryMediaType",
    example: GalleryMediaType.IMAGE,
    default: GalleryMediaType.IMAGE,
    description:
      "Determines whether the gallery item is an image or video.",
  })
  @IsOptional()
  @IsEnum(GalleryMediaType)
  mediaType?: GalleryMediaType;

  @ApiProperty({
    example:
      "https://res.cloudinary.com/example/image/upload/waterfall-festival/gallery/images/main-stage.webp",
    description:
      "Public Cloudinary URL of the uploaded image or video.",
    format: "uri",
  })
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  imageUrl!: string;

  @ApiPropertyOptional({
    example:
      "waterfall-festival/gallery/images/main-stage",
    description:
      "Cloudinary public ID used for deleting or managing the media asset.",
  })
  @IsOptional()
  @IsString()
  publicId?: string;

  @ApiPropertyOptional({
    example:
      "https://res.cloudinary.com/example/video/upload/so_0/waterfall-festival/gallery/videos/reel.jpg",
    description:
      "Poster or thumbnail URL for video media.",
    format: "uri",
  })
  @IsOptional()
  @IsUrl()
  thumbnailUrl?: string;

  @ApiPropertyOptional({
    example: 18.4,
    minimum: 0,
    description:
      "Video duration in seconds. Used only for video media.",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  duration?: number;

  @ApiPropertyOptional({
    example: 1080,
    minimum: 1,
    description:
      "Original media width in pixels.",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  width?: number;

  @ApiPropertyOptional({
    example: 1920,
    minimum: 1,
    description:
      "Original media height in pixels.",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  height?: number;

  @ApiPropertyOptional({
    example:
      "Crowd watching the Waterfall Festival main-stage performance",
    description:
      "Alternative text used for accessibility and media context.",
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
      "Publishing status of the gallery media item.",
  })
  @IsOptional()
  @IsEnum(GalleryStatus)
  status?: GalleryStatus;

  @ApiPropertyOptional({
    example: false,
    default: false,
    description:
      "Whether the media item is highlighted as featured.",
  })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({
    example: 0,
    default: 0,
    minimum: 0,
    description:
      "Display position in the main gallery.",
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({
    example: false,
    default: false,
    description:
      "Whether this video should be displayed in the homepage reels section.",
  })
  @IsOptional()
  @IsBoolean()
  showOnHomepage?: boolean;

  @ApiPropertyOptional({
    example: 1,
    default: 0,
    minimum: 0,
    description:
      "Display order inside the homepage reels carousel.",
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  homepageSortOrder?: number;

  @ApiPropertyOptional({
    example: 12,
    minimum: 1,
    description:
      "Optional ID of the event associated with the gallery media item.",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  eventId?: number;
}