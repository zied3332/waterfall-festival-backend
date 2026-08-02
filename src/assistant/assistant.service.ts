import {
  Injectable,
  Logger,
} from "@nestjs/common";

import { AssistantContextService } from "./assistant-context.service.js";
import { AssistantIntentService } from "./assistant-intent.service.js";

import type {
  AssistantIntent,
  AssistantResult,
  RetrievedAssistantContext,
} from "./assistant.types.js";

import { AssistantConversationService } from "./conversation/assistant-conversation.service.js";

import type { AssistantChatDto } from "./dto/assistant-chat.dto.js";

import type {
  AssistantProviderInput,
} from "./providers/assistant-provider.interface.js";

import { HumanFallbackProvider } from "./providers/human-fallback.provider.js";
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

    private readonly conversationService:
      AssistantConversationService,

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

    const conversationResolution =
      this.conversationService.resolveConversation(
        assistantChatDto.conversationId,
      );

    const conversationId =
      conversationResolution.conversationId;

    const previousConversation =
      conversationResolution.conversation;

    const detectedIntent =
      this.intentService.detectIntent(message);

    const resolvedIntent =
      this.resolveIntentFromConversation(
        detectedIntent,
        previousConversation?.lastIntent ?? null,
        message,
      );

    this.conversationService.addUserMessage(
      conversationId,
      message,
    );

    let context = EMPTY_CONTEXT;

    try {
      context =
        await this.contextService.buildContext(
          resolvedIntent,
          message,
        );
    } catch (error: unknown) {
      this.logger.error(
        `Unable to retrieve assistant context for intent "${resolvedIntent}".`,
        error instanceof Error
          ? error.stack
          : undefined,
      );
    }

    const providerInput: AssistantProviderInput = {
      message,
      intent: resolvedIntent,
      context,
      conversationId,
    };

    const ruleBasedResult =
      await this.tryRuleBasedProvider(
        providerInput,
      );

    const finalResult =
      ruleBasedResult ??
      (await this.generateFallbackResponse(
        providerInput,
      ));

    this.conversationService.addAssistantMessage(
      conversationId,
      finalResult.answer,
    );

    this.conversationService.updateConversationContext({
      conversationId,
      intent: finalResult.intent,
      result: finalResult,
    });

    return finalResult;
  }

  private resolveIntentFromConversation(
    detectedIntent: AssistantIntent,
    previousIntent: AssistantIntent | null,
    message: string,
  ): AssistantIntent {
    if (
      detectedIntent !== "UNKNOWN" &&
      detectedIntent !== "GENERAL"
    ) {
      return detectedIntent;
    }

    if (
      previousIntent &&
      previousIntent !== "UNKNOWN" &&
      this.isLikelyFollowUpMessage(message)
    ) {
      return previousIntent;
    }

    return detectedIntent;
  }

  private isLikelyFollowUpMessage(
    message: string,
  ): boolean {
    const normalizedMessage = message
      .trim()
      .toLowerCase();

    const followUpPatterns = [
      /^how much/,
      /^when/,
      /^where/,
      /^what about/,
      /^and /,
      /^is it/,
      /^does it/,
      /^can i/,
      /^show me/,
      /^open it/,
      /^tell me more/,
      /^more/,
      /^why/,
      /^which one/,
      /^what time/,
      /^how many/,
    ];

    if (
      followUpPatterns.some((pattern) =>
        pattern.test(normalizedMessage),
      )
    ) {
      return true;
    }

    const wordCount =
      normalizedMessage
        .split(/\s+/)
        .filter(Boolean)
        .length;

    return wordCount <= 5;
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