import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

import {
  ApiProperty,
  ApiPropertyOptional,
} from "@nestjs/swagger";

export class AssistantChatDto {
  @ApiProperty({
    example:
      "Which ticket is best for a group of five people?",
    description:
      "Question sent by the website visitor to the festival assistant.",
    minLength: 2,
    maxLength: 1000,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  message!: string;

  @ApiPropertyOptional({
    example: "session-8d4a2f1c",
    description:
      "Optional client-generated conversation identifier.",
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  conversationId?: string;
}