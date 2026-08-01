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
  MaxLength,
  Min,
} from "class-validator";

export class CreateExperienceHighlightDto {
  @ApiProperty({
    example: "Live Music",
    description:
      "Title displayed for the Experience highlight.",
    maxLength: 150,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title!: string;

  @ApiProperty({
    example:
      "International DJs, powerful sound systems, and unforgettable performances beneath the stars.",
    description:
      "Description explaining the Experience highlight.",
  })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiPropertyOptional({
    example: "Music2",
    description:
      "Optional frontend icon identifier, such as a Lucide icon name.",
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  icon?: string;

  @ApiPropertyOptional({
    example: 0,
    default: 0,
    minimum: 0,
    description:
      "Display position of the highlight. Lower values appear first.",
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({
    example: true,
    default: true,
    description:
      "Whether the highlight is visible on the public Experience page.",
  })
  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}