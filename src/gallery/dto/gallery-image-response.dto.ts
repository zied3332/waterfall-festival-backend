import {
  ApiProperty,
  ApiPropertyOptional,
} from "@nestjs/swagger";

import { GalleryStatus } from "../../generated/prisma/enums.js";

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
      "Unique numeric identifier of the gallery image.",
  })
  id!: number;

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
      "https://res.cloudinary.com/example/image/upload/waterfall-festival/gallery/main-stage.webp",
    format: "uri",
  })
  imageUrl!: string;

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
    description:
      "Whether the image is highlighted as featured.",
  })
  isFeatured!: boolean;

  @ApiProperty({
    example: 0,
    minimum: 0,
    description:
      "Display position of the image.",
  })
  sortOrder!: number;

  @ApiPropertyOptional({
    example: 12,
    nullable: true,
    minimum: 1,
    description:
      "ID of the associated event, when one is assigned.",
  })
  eventId!: number | null;

  @ApiPropertyOptional({
    type: GalleryEventSummaryDto,
    nullable: true,
    description:
      "Summary of the associated event.",
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
      "Number of gallery images successfully created.",
  })
  count!: number;

  @ApiProperty({
    type: GalleryImageResponseDto,
    isArray: true,
  })
  images!: GalleryImageResponseDto[];
}