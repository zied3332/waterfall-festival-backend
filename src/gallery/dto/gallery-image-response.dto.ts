import {
  ApiProperty,
  ApiPropertyOptional,
} from "@nestjs/swagger";

import {
  GalleryMediaType,
  GalleryStatus,
} from "../../generated/prisma/enums.js";

export class GalleryEventSummaryDto {
  @ApiProperty({
    example: 12,
    description:
      "Unique numeric identifier of the associated event.",
  })
  id!: number;

  @ApiProperty({
    example: "Waterfall Full Moon Festival",
    description:
      "Public title of the associated event.",
  })
  title!: string;

  @ApiProperty({
    example: "waterfall-full-moon-festival",
    description:
      "URL-friendly identifier of the associated event.",
  })
  slug!: string;
}

export class GalleryImageResponseDto {
  @ApiProperty({
    example: 25,
    description:
      "Unique numeric identifier of the gallery media item.",
  })
  id!: number;

  @ApiProperty({
    enum: GalleryMediaType,
    enumName: "GalleryMediaType",
    example: GalleryMediaType.IMAGE,
  })
  mediaType!: GalleryMediaType;

  @ApiProperty({
    example: "Waterfall Festival Main Stage",
  })
  title!: string;

  @ApiPropertyOptional({
    example:
      "Festival visitors enjoying the main-stage performance.",
    nullable: true,
  })
  description!: string | null;

  @ApiProperty({
    example:
      "https://res.cloudinary.com/example/image/upload/waterfall-festival/gallery/images/main-stage.webp",
    format: "uri",
  })
  imageUrl!: string;

  @ApiPropertyOptional({
    example:
      "waterfall-festival/gallery/images/main-stage",
    nullable: true,
  })
  publicId!: string | null;

  @ApiPropertyOptional({
    example:
      "https://res.cloudinary.com/example/video/upload/so_0/waterfall-festival/gallery/videos/reel.jpg",
    nullable: true,
  })
  thumbnailUrl!: string | null;

  @ApiPropertyOptional({
    example: 18.4,
    nullable: true,
  })
  duration!: number | null;

  @ApiPropertyOptional({
    example: 1080,
    nullable: true,
  })
  width!: number | null;

  @ApiPropertyOptional({
    example: 1920,
    nullable: true,
  })
  height!: number | null;

  @ApiPropertyOptional({
    example:
      "Crowd watching the Waterfall Festival main-stage performance",
    nullable: true,
  })
  altText!: string | null;

  @ApiProperty({
    enum: GalleryStatus,
    enumName: "GalleryStatus",
    example: GalleryStatus.PUBLISHED,
  })
  status!: GalleryStatus;

  @ApiProperty({
    example: false,
  })
  isFeatured!: boolean;

  @ApiProperty({
    example: 0,
    minimum: 0,
  })
  sortOrder!: number;

  @ApiProperty({
    example: true,
    description:
      "Whether the media item is displayed in the homepage reels section.",
  })
  showOnHomepage!: boolean;

  @ApiProperty({
    example: 1,
    minimum: 0,
    description:
      "Order of the media item in the homepage reels carousel.",
  })
  homepageSortOrder!: number;

  @ApiPropertyOptional({
    example: 12,
    nullable: true,
    minimum: 1,
  })
  eventId!: number | null;

  @ApiPropertyOptional({
    type: GalleryEventSummaryDto,
    nullable: true,
  })
  event!: GalleryEventSummaryDto | null;

  @ApiProperty({
    example: "2026-07-31T08:00:00.000Z",
    format: "date-time",
  })
  createdAt!: Date;

  @ApiProperty({
    example: "2026-07-31T08:30:00.000Z",
    format: "date-time",
  })
  updatedAt!: Date;
}

export class GalleryUploadResponseDto {
  @ApiProperty({
    example: true,
  })
  success!: boolean;

  @ApiProperty({
    example: 3,
    minimum: 1,
    description:
      "Number of gallery media items successfully created.",
  })
  count!: number;

  @ApiProperty({
    type: GalleryImageResponseDto,
    isArray: true,
  })
  items!: GalleryImageResponseDto[];
}