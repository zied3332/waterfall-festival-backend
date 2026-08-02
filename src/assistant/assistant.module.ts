import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module.js";

import { AssistantContextService } from "./assistant-context.service.js";
import { AssistantController } from "./assistant.controller.js";
import { AssistantIntentService } from "./assistant-intent.service.js";
import { AssistantResponseBuilder } from "./assistant-response.builder.js";
import { AssistantRetrievalService } from "./assistant-retrieval.service.js";
import { AssistantService } from "./assistant.service.js";
import { AssistantSourceService } from "./assistant-source.service.js";
import { AssistantSuggestionService } from "./assistant-suggestion.service.js";

import { HumanFallbackProvider } from "./providers/human-fallback.provider.js";
import { RuleBasedProvider } from "./providers/rule-based.provider.js";

@Module({
  imports: [
    PrismaModule,
  ],
  controllers: [
    AssistantController,
  ],
  providers: [
    AssistantService,
    AssistantIntentService,
    AssistantRetrievalService,
    AssistantContextService,
    AssistantResponseBuilder,
    AssistantSuggestionService,
    AssistantSourceService,
    RuleBasedProvider,
    HumanFallbackProvider,
  ],
  exports: [
    AssistantService,
  ],
})
export class AssistantModule {}