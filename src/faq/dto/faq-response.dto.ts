import {
  ApiProperty,
  ApiPropertyOptional,
} from "@nestjs/swagger";

import { FaqStatus } from "../../generated/prisma/enums.js";

export class FaqResponseDto {
  @ApiProperty({
    example: 1,
    description:
      "Unique numeric identifier of the FAQ entry.",
  })
  id!: number;

  @ApiProperty({
    example: "What should I bring to the festival?",
    description:
      "Question displayed to visitors.",
  })
  question!: string;

  @ApiProperty({
    example:
      "Bring your ticket, a valid ID, comfortable clothes, sunscreen, and a fully charged phone.",
    description:
      "Answer displayed to visitors.",
  })
  answer!: string;

  @ApiPropertyOptional({
    example: "Festival preparation",
    nullable: true,
    description:
      "Category assigned to the FAQ entry.",
  })
  category!: string | null;

  @ApiProperty({
    enum: FaqStatus,
    enumName: "FaqStatus",
    example: FaqStatus.PUBLISHED,
    description:
      "Current publishing status of the FAQ entry.",
  })
  status!: FaqStatus;

  @ApiProperty({
    example: 0,
    minimum: 0,
    description:
      "Display position of the FAQ.",
  })
  sortOrder!: number;

  @ApiProperty({
    example: "2026-07-31T18:00:00.000Z",
    format: "date-time",
    description:
      "Date and time when the FAQ was created.",
  })
  createdAt!: Date;

  @ApiProperty({
    example: "2026-07-31T18:30:00.000Z",
    format: "date-time",
    description:
      "Date and time when the FAQ was last updated.",
  })
  updatedAt!: Date;
}