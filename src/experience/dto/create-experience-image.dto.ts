import {
  ApiProperty,
  ApiPropertyOptional,
} from "@nestjs/swagger";

import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from "class-validator";

export class CreateExperienceImageDto {
  @ApiProperty({
    example:
      "https://res.cloudinary.com/example/image/upload/waterfall-festival/experience/main-stage.webp",
    description:
      "Public URL of the Experience image. The URL must include a protocol.",
    format: "uri",
  })
  @IsString()
  @IsNotEmpty()
  @IsUrl({
    require_protocol: true,
  })
  imageUrl!: string;

  @ApiPropertyOptional({
    example:
      "Festival crowd dancing near the waterfall",
    description:
      "Alternative text used for accessibility and image context.",
    maxLength: 250,
  })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  altText?: string;

  @ApiPropertyOptional({
    example:
      "An unforgettable festival night beneath the Koh Phangan waterfall.",
    description:
      "Optional caption displayed with the image.",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;

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
    example: false,
    default: false,
    description:
      "Whether this image is the featured image for the Experience page. Only one image should be featured at a time.",
  })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({
    example: true,
    default: true,
    description:
      "Whether the image is visible on the public Experience page.",
  })
  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}