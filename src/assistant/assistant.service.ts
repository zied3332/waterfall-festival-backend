import {
  Injectable,
  Logger,
} from "@nestjs/common";

import type {
  AssistantResult,
  RetrievedAssistantContext,
} from "./assistant.types.js";

import { AssistantContextService } from "./assistant-context.service.js";
import { AssistantIntentService } from "./assistant-intent.service.js";

import type { AssistantChatDto } from "./dto/assistant-chat.dto.js";

import { HumanFallbackProvider } from "./providers/human-fallback.provider.js";
import type {
  AssistantProviderInput,
} from "./providers/assistant-provider.interface.js";
import { RuleBasedProvider } from "./providers/rule-based.provider.js";

const MINIMUM_RULE_BASED_CONFIDENCE = 0.6;

const EMPTY_CONTEXT: RetrievedAssistantContext = {
  events: [],
  tickets: [],
  faqs: [],
  settings: null,
  experience: null,
};

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(
    AssistantService.name,
  );

  constructor(
    private readonly intentService:
      AssistantIntentService,

    private readonly contextService:
      AssistantContextService,

    private readonly ruleBasedProvider:
      RuleBasedProvider,

    private readonly humanFallbackProvider:
      HumanFallbackProvider,
  ) {}

  async chat(
    assistantChatDto: AssistantChatDto,
  ): Promise<AssistantResult> {
    const message =
      assistantChatDto.message.trim();

    const conversationId =
      assistantChatDto.conversationId?.trim() ||
      undefined;

    const intent =
      this.intentService.detectIntent(message);

    let context = EMPTY_CONTEXT;

    try {
      context =
        await this.contextService.buildContext(
          intent,
          message,
        );
    } catch (error: unknown) {
      this.logger.error(
        `Unable to retrieve assistant context for intent "${intent}".`,
        error instanceof Error
          ? error.stack
          : undefined,
      );
    }

    const providerInput: AssistantProviderInput = {
      message,
      intent,
      context,
      conversationId,
    };

    const ruleBasedResult =
      await this.tryRuleBasedProvider(
        providerInput,
      );

    if (ruleBasedResult) {
      return ruleBasedResult;
    }

    return this.generateFallbackResponse(
      providerInput,
    );
  }

  private async tryRuleBasedProvider(
    input: AssistantProviderInput,
  ): Promise<AssistantResult | null> {
    if (
      !this.ruleBasedProvider.canHandle(
        input,
      )
    ) {
      return null;
    }

    try {
      const result =
        await this.ruleBasedProvider.generateResponse(
          input,
        );

      if (
        !this.isReliableRuleBasedResult(
          result,
        )
      ) {
        return null;
      }

      return result;
    } catch (error: unknown) {
      this.logger.error(
        `The rule-based assistant provider failed for intent "${input.intent}".`,
        error instanceof Error
          ? error.stack
          : undefined,
      );

      return null;
    }
  }

  private async generateFallbackResponse(
    input: AssistantProviderInput,
  ): Promise<AssistantResult> {
    const fallbackResult =
      await this.humanFallbackProvider.generateResponse(
        input,
      );

    return {
      ...fallbackResult,

      // Preserve the detected category so the
      // frontend and logs still know what the
      // visitor was asking about.
      intent: input.intent,
    };
  }

  private isReliableRuleBasedResult(
    result: AssistantResult,
  ): boolean {
    return (
      result.answer.trim().length > 0 &&
      result.confidence >=
        MINIMUM_RULE_BASED_CONFIDENCE &&
      !result.requiresHumanFollowUp
    );
  }
}