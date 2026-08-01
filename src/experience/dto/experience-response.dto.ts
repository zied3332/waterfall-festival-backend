import {
  ApiProperty,
  ApiPropertyOptional,
} from "@nestjs/swagger";

export class ExperienceHighlightResponseDto {
  @ApiProperty({
    example: 1,
    description:
      "Unique numeric identifier of the Experience highlight.",
  })
  id!: number;

  @ApiProperty({
    example: "Live Music",
    description:
      "Title displayed for the Experience highlight.",
  })
  title!: string;

  @ApiProperty({
    example:
      "International DJs, powerful sound systems, and performances beneath the stars.",
    description:
      "Description displayed for the highlight.",
  })
  description!: string;

  @ApiPropertyOptional({
    example: "Music2",
    nullable: true,
    description:
      "Optional frontend icon identifier.",
  })
  icon!: string | null;

  @ApiProperty({
    example: 0,
    minimum: 0,
    description:
      "Display position of the highlight.",
  })
  sortOrder!: number;

  @ApiProperty({
    example: true,
    description:
      "Whether the highlight is visible on the public Experience page.",
  })
  isVisible!: boolean;

  @ApiProperty({
    example: 1,
    description:
      "Identifier of the Experience page that owns this highlight.",
  })
  experiencePageId!: number;

  @ApiProperty({
    example: "2026-08-01T08:00:00.000Z",
    format: "date-time",
  })
  createdAt!: Date;

  @ApiProperty({
    example: "2026-08-01T08:30:00.000Z",
    format: "date-time",
  })
  updatedAt!: Date;
}

export class ExperienceImageResponseDto {
  @ApiProperty({
    example: 4,
    description:
      "Unique numeric identifier of the Experience image.",
  })
  id!: number;

  @ApiProperty({
    example:
      "https://res.cloudinary.com/example/image/upload/waterfall-festival/experience/main-stage.webp",
    format: "uri",
    description:
      "Public URL of the Experience image.",
  })
  imageUrl!: string;

  @ApiPropertyOptional({
    example:
      "Festival crowd dancing near the waterfall",
    nullable: true,
    description:
      "Alternative text used for accessibility.",
  })
  altText!: string | null;

  @ApiPropertyOptional({
    example:
      "Festival night beneath the Koh Phangan waterfall",
    nullable: true,
    description:
      "Optional image caption.",
  })
  caption!: string | null;

  @ApiProperty({
    example: 0,
    minimum: 0,
    description:
      "Display position of the image.",
  })
  sortOrder!: number;

  @ApiProperty({
    example: true,
    description:
      "Whether this is the featured Experience image.",
  })
  isFeatured!: boolean;

  @ApiProperty({
    example: true,
    description:
      "Whether the image is visible on the public Experience page.",
  })
  isVisible!: boolean;

  @ApiProperty({
    example: 1,
    description:
      "Identifier of the Experience page that owns this image.",
  })
  experiencePageId!: number;

  @ApiProperty({
    example: "2026-08-01T08:00:00.000Z",
    format: "date-time",
  })
  createdAt!: Date;

  @ApiProperty({
    example: "2026-08-01T08:30:00.000Z",
    format: "date-time",
  })
  updatedAt!: Date;
}

export class ExperiencePageResponseDto {
  @ApiProperty({
    example: 1,
    description:
      "Unique numeric identifier of the Experience page.",
  })
  id!: number;

  @ApiPropertyOptional({
    example: "The Waterfall Experience",
    nullable: true,
  })
  heroBadge!: string | null;

  @ApiProperty({
    example:
      "More than a festival. A world of its own.",
  })
  heroTitle!: string;

  @ApiPropertyOptional({
    example:
      "Music, nature, fire, water, and tropical island energy.",
    nullable: true,
  })
  heroSubtitle!: string | null;

  @ApiPropertyOptional({
    example:
      "Discover an unforgettable festival experience beneath the waterfalls of Koh Phangan.",
    nullable: true,
  })
  heroDescription!: string | null;

  @ApiPropertyOptional({
    example: "Our Story",
    nullable: true,
  })
  storyEyebrow!: string | null;

  @ApiProperty({
    example:
      "Born in the jungle of Koh Phangan",
  })
  storyTitle!: string;

  @ApiProperty({
    example:
      "Waterfall Festival brings together international music, tropical nature, creative performances, and an unforgettable island community.",
  })
  storyDescription!: string;

  @ApiPropertyOptional({
    example: "View Upcoming Events",
    nullable: true,
  })
  buttonText!: string | null;

  @ApiPropertyOptional({
    example: "/events",
    nullable: true,
  })
  buttonUrl!: string | null;

  @ApiProperty({
    example: true,
    description:
      "Whether the page is publicly available.",
  })
  isPublished!: boolean;

  @ApiProperty({
    type: ExperienceHighlightResponseDto,
    isArray: true,
    description:
      "Highlights attached to the Experience page.",
  })
  highlights!: ExperienceHighlightResponseDto[];

  @ApiProperty({
    type: ExperienceImageResponseDto,
    isArray: true,
    description:
      "Images attached to the Experience page.",
  })
  images!: ExperienceImageResponseDto[];

  @ApiProperty({
    example: "2026-08-01T08:00:00.000Z",
    format: "date-time",
  })
  createdAt!: Date;

  @ApiProperty({
    example: "2026-08-01T08:30:00.000Z",
    format: "date-time",
  })
  updatedAt!: Date;
}

export class DeleteExperienceResourceResponseDto {
  @ApiProperty({
    example:
      "Experience highlight deleted successfully",
  })
  message!: string;
}