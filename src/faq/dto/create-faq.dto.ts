import {
  ApiProperty,
  ApiPropertyOptional,
} from "@nestjs/swagger";

import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

import { FaqStatus } from "../../generated/prisma/enums.js";

export class CreateFaqDto {
  @ApiProperty({
    example: "What should I bring to the festival?",
    description:
      "Question displayed to visitors on the FAQ page.",
    minLength: 3,
    maxLength: 300,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  question!: string;

  @ApiProperty({
    example:
      "Bring your ticket, a valid ID, comfortable clothes, sunscreen, and a fully charged phone.",
    description:
      "Answer displayed when the visitor opens the FAQ item.",
    minLength: 3,
    maxLength: 5000,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(5000)
  answer!: string;

  @ApiPropertyOptional({
    example: "Festival preparation",
    description:
      "Optional category used to group related FAQ entries.",
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({
    enum: FaqStatus,
    enumName: "FaqStatus",
    example: FaqStatus.PUBLISHED,
    default: FaqStatus.DRAFT,
    description:
      "Publishing status of the FAQ entry.",
  })
  @IsOptional()
  @IsEnum(FaqStatus)
  status?: FaqStatus;

  @ApiPropertyOptional({
    example: 0,
    default: 0,
    minimum: 0,
    description:
      "Display position of the FAQ. Lower values appear first.",
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}