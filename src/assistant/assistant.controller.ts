import {
  Body,
  Controller,
  Post,
} from "@nestjs/common";

import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

import { AssistantService } from "./assistant.service.js";
import { AssistantChatDto } from "./dto/assistant-chat.dto.js";
import { AssistantResponseDto } from "./dto/assistant-response.dto.js";

@ApiTags("Assistant")
@Controller("assistant")
export class AssistantController {
  constructor(
    private readonly assistantService:
      AssistantService,
  ) {}

  @Post("chat")
  @ApiOperation({
    summary:
      "Send a message to the festival assistant",
    description:
      "Detects the visitor's intent, retrieves trusted public festival data, and returns a rule-based answer. When the assistant cannot answer confidently, it returns a safe human-support fallback.",
  })
  @ApiCreatedResponse({
    description:
      "Assistant response generated successfully.",
    type: AssistantResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "The message is missing, too short, too long, or otherwise invalid.",
  })
  chat(
    @Body()
    assistantChatDto: AssistantChatDto,
  ): Promise<AssistantResponseDto> {
    return this.assistantService.chat(
      assistantChatDto,
    );
  }
}