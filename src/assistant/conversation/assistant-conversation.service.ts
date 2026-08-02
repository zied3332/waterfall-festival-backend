import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import type {
  AssistantIntent,
  AssistantResult,
} from "../assistant.types.js";

import type {
  AddConversationMessageInput,
  AssistantConversationMessage,
  AssistantConversationState,
  ConversationResolution,
  UpdateConversationContextInput,
} from "./assistant-conversation.types.js";

import { createConversationReferences } from "./assistant-conversation.types.js";
import { InMemoryConversationStore } from "./in-memory-conversation.store.js";

const MAX_CONVERSATION_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 1_000;

@Injectable()
export class AssistantConversationService {
  constructor(
    private readonly conversationStore:
      InMemoryConversationStore,
  ) {}

  resolveConversation(
    conversationId?: string,
  ): ConversationResolution {
    const normalizedConversationId =
      conversationId?.trim();

    if (normalizedConversationId) {
      const existingConversation =
        this.conversationStore.get(
          normalizedConversationId,
        );

      if (existingConversation) {
        return {
          conversationId:
            existingConversation.conversationId,
          conversation:
            existingConversation,
        };
      }
    }

    const createdConversation =
      this.conversationStore.create({
        conversationId:
          normalizedConversationId,
      });

    return {
      conversationId:
        createdConversation.conversationId,
      conversation:
        createdConversation,
    };
  }

  getConversation(
    conversationId: string,
  ): AssistantConversationState | null {
    const normalizedConversationId =
      conversationId.trim();

    if (!normalizedConversationId) {
      return null;
    }

    return this.conversationStore.get(
      normalizedConversationId,
    );
  }

  addUserMessage(
    conversationId: string,
    content: string,
  ): AssistantConversationState {
    return this.addMessage({
      conversationId,
      role: "USER",
      content,
    });
  }

  addAssistantMessage(
    conversationId: string,
    content: string,
  ): AssistantConversationState {
    return this.addMessage({
      conversationId,
      role: "ASSISTANT",
      content,
    });
  }

  addMessage(
    input: AddConversationMessageInput,
  ): AssistantConversationState {
    const conversation =
      this.getOrCreateConversation(
        input.conversationId,
      );

    const content = this.cleanContent(
      input.content,
    );

    if (!content) {
      return conversation;
    }

    const message:
      AssistantConversationMessage = {
      id: randomUUID(),
      role: input.role,
      content,
      createdAt: new Date(),
    };

    const updatedConversation:
      AssistantConversationState = {
      ...conversation,
      messages: [
        ...conversation.messages,
        message,
      ].slice(-MAX_CONVERSATION_MESSAGES),
    };

    return this.conversationStore.set(
      updatedConversation,
    );
  }

  updateConversationContext(
    input: UpdateConversationContextInput,
  ): AssistantConversationState {
    const conversation =
      this.getOrCreateConversation(
        input.conversationId,
      );

    const updatedConversation:
      AssistantConversationState = {
      ...conversation,
      lastIntent: input.intent,
      lastReferences:
        createConversationReferences(
          input.result.sources,
        ),
      lastResult:
        this.cloneAssistantResult(
          input.result,
        ),
    };

    return this.conversationStore.set(
      updatedConversation,
    );
  }

  recordInteraction(
    conversationId: string,
    userMessage: string,
    result: AssistantResult,
  ): AssistantConversationState {
    this.addUserMessage(
      conversationId,
      userMessage,
    );

    this.addAssistantMessage(
      conversationId,
      result.answer,
    );

    return this.updateConversationContext({
      conversationId,
      intent: result.intent,
      result,
    });
  }

  getLastIntent(
    conversationId: string,
  ): AssistantIntent | null {
    return (
      this.getConversation(
        conversationId,
      )?.lastIntent ?? null
    );
  }

  getRecentMessages(
    conversationId: string,
    limit = 6,
  ): AssistantConversationMessage[] {
    const conversation =
      this.getConversation(conversationId);

    if (!conversation) {
      return [];
    }

    const safeLimit = Math.min(
      Math.max(Math.floor(limit), 1),
      MAX_CONVERSATION_MESSAGES,
    );

    return conversation.messages
      .slice(-safeLimit)
      .map((message) => ({
        ...message,
        createdAt: new Date(
          message.createdAt,
        ),
      }));
  }

  deleteConversation(
    conversationId: string,
  ): boolean {
    const normalizedConversationId =
      conversationId.trim();

    if (!normalizedConversationId) {
      return false;
    }

    return this.conversationStore.delete(
      normalizedConversationId,
    );
  }

  private getOrCreateConversation(
    conversationId: string,
  ): AssistantConversationState {
    const normalizedConversationId =
      conversationId.trim();

    const existingConversation =
      normalizedConversationId
        ? this.conversationStore.get(
            normalizedConversationId,
          )
        : null;

    if (existingConversation) {
      return existingConversation;
    }

    return this.conversationStore.create({
      conversationId:
        normalizedConversationId ||
        undefined,
    });
  }

  private cleanContent(
    content: string,
  ): string {
    return content
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_MESSAGE_LENGTH);
  }

  private cloneAssistantResult(
    result: AssistantResult,
  ): AssistantResult {
    return {
      ...result,
      suggestions: [
        ...result.suggestions,
      ],
      sources: result.sources.map(
        (source) => ({
          ...source,
        }),
      ),
    };
  }
}