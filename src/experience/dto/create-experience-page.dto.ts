import {
  ApiProperty,
  ApiPropertyOptional,
} from "@nestjs/swagger";

import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from "class-validator";

export class CreateExperiencePageDto {
  @ApiPropertyOptional({
    example: "The Waterfall Experience",
    maxLength: 120,
    description:
      "Small badge displayed above the main hero title.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  heroBadge?: string;

  @ApiProperty({
    example:
      "More than a festival. A world of its own.",
    maxLength: 200,
    description:
      "Main title displayed in the Experience page hero section.",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  heroTitle!: string;

  @ApiPropertyOptional({
    example:
      "Music, nature, fire, water, and tropical island energy.",
    maxLength: 300,
    description:
      "Optional subtitle displayed below the hero title.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  heroSubtitle?: string;

  @ApiPropertyOptional({
    example:
      "Discover an unforgettable festival experience beneath the waterfalls of Koh Phangan.",
    description:
      "Longer introductory description displayed in the hero section.",
  })
  @IsOptional()
  @IsString()
  heroDescription?: string;

  @ApiPropertyOptional({
    example: "Our Story",
    maxLength: 120,
    description:
      "Small eyebrow text displayed above the story title.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  storyEyebrow?: string;

  @ApiProperty({
    example:
      "Born in the jungle of Koh Phangan",
    maxLength: 200,
    description:
      "Main title of the Experience story section.",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  storyTitle!: string;

  @ApiProperty({
    example:
      "Waterfall Festival brings together international music, tropical nature, creative performances, and an unforgettable island community.",
    description:
      "Full text displayed in the Experience story section.",
  })
  @IsString()
  @IsNotEmpty()
  storyDescription!: string;

  @ApiPropertyOptional({
    example: "View Upcoming Events",
    maxLength: 100,
    description:
      "Optional call-to-action button label.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  buttonText?: string;

  @ApiPropertyOptional({
    example: "/events",
    description:
      "Optional call-to-action destination. It may be a relative path or full URL.",
  })
  @IsOptional()
  @IsUrl({
    require_protocol: false,
    require_tld: false,
  })
  buttonUrl?: string;

  @ApiPropertyOptional({
    example: true,
    default: false,
    description:
      "Whether the Experience page is publicly available.",
  })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}