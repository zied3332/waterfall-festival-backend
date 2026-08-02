import {
  ApiProperty,
  ApiPropertyOptional,
} from "@nestjs/swagger";

import type {
  AssistantHandler,
  AssistantIntent,
  AssistantSourceType,
} from "../assistant.types.js";

export class AssistantSourceDto {
  @ApiProperty({
    enum: [
      "EVENT",
      "TICKET",
      "FAQ",
      "SETTINGS",
      "EXPERIENCE",
    ],
    example: "TICKET",
    description:
      "Type of festival resource used to produce the answer.",
  })
  type!: AssistantSourceType;

  @ApiPropertyOptional({
    example: 4,
    description:
      "Optional database identifier of the source resource.",
  })
  id?: number;

  @ApiProperty({
    example: "Group Friends Ticket",
    description:
      "Human-readable label for the source.",
  })
  label!: string;

  @ApiPropertyOptional({
    example: "/tickets/group-friends-ticket",
    description:
      "Optional frontend URL related to the source.",
  })
  url?: string;
}

export class AssistantResponseDto {
  @ApiProperty({
    example:
      "The Group Friends Ticket is designed for five guests and includes five general admission entries.",
    description:
      "Answer returned to the website visitor.",
  })
  answer!: string;

  @ApiProperty({
    enum: [
      "RULE_BASED",
      "HUMAN_FALLBACK",
    ],
    example: "RULE_BASED",
    description:
      "Indicates which part of the assistant handled the question.",
  })
  handledBy!: AssistantHandler;

  @ApiProperty({
    enum: [
      "EVENTS",
      "TICKETS",
      "VENUE",
      "FAQ",
      "CONTACT",
      "EXPERIENCE",
      "GENERAL",
      "UNKNOWN",
    ],
    example: "TICKETS",
    description:
      "Detected category of the visitor question.",
  })
  intent!: AssistantIntent;

  @ApiProperty({
    example: 0.94,
    minimum: 0,
    maximum: 1,
    description:
      "Confidence score of the generated answer.",
  })
  confidence!: number;

  @ApiProperty({
    example: false,
    description:
      "Whether the visitor should contact a human team member.",
  })
  requiresHumanFollowUp!: boolean;

  @ApiProperty({
    example: [
      "Show ticket benefits",
      "When does the sale end?",
      "Open the ticket page",
    ],
    type: [String],
    description:
      "Suggested follow-up questions or actions.",
  })
  suggestions!: string[];

  @ApiProperty({
    type: AssistantSourceDto,
    isArray: true,
    description:
      "Festival resources used to produce the answer.",
  })
  sources!: AssistantSourceDto[];
}