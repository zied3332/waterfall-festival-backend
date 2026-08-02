import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import type {
  AssistantConversationState,
  CreateConversationInput,
} from "./assistant-conversation.types.js";

const DEFAULT_CONVERSATION_TTL_MS =
  30 * 60 * 1000;

const MAX_CONVERSATIONS = 1_000;

@Injectable()
export class InMemoryConversationStore {
  private readonly conversations =
    new Map<
      string,
      AssistantConversationState
    >();

  private readonly conversationTtlMs =
    DEFAULT_CONVERSATION_TTL_MS;

  get(
    conversationId: string,
  ): AssistantConversationState | null {
    this.removeExpiredConversations();

    const conversation =
      this.conversations.get(
        conversationId,
      );

    if (!conversation) {
      return null;
    }

    if (
      conversation.expiresAt.getTime() <=
      Date.now()
    ) {
      this.conversations.delete(
        conversationId,
      );

      return null;
    }

    return this.cloneConversation(
      conversation,
    );
  }

  create(
    input: CreateConversationInput = {},
  ): AssistantConversationState {
    this.removeExpiredConversations();

    const conversationId =
      input.conversationId?.trim() ||
      randomUUID();

    const existingConversation =
      this.conversations.get(
        conversationId,
      );

    if (
      existingConversation &&
      existingConversation.expiresAt.getTime() >
        Date.now()
    ) {
      return this.cloneConversation(
        existingConversation,
      );
    }

    this.ensureCapacity();

    const now = new Date();

    const conversation:
      AssistantConversationState = {
      conversationId,
      messages: [],
      lastIntent: null,
      lastReferences: [],
      lastResult: null,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(
        now.getTime() +
          this.conversationTtlMs,
      ),
    };

    this.conversations.set(
      conversationId,
      conversation,
    );

    return this.cloneConversation(
      conversation,
    );
  }

  set(
    conversation:
      AssistantConversationState,
  ): AssistantConversationState {
    const now = new Date();

    const normalizedConversation:
      AssistantConversationState = {
      ...conversation,
      messages: conversation.messages.map(
        (message) => ({
          ...message,
          createdAt: new Date(
            message.createdAt,
          ),
        }),
      ),
      lastReferences:
        conversation.lastReferences.map(
          (reference) => ({
            ...reference,
          }),
        ),
      lastResult: conversation.lastResult
        ? {
            ...conversation.lastResult,
            suggestions: [
              ...conversation.lastResult
                .suggestions,
            ],
            sources:
              conversation.lastResult.sources.map(
                (source) => ({
                  ...source,
                }),
              ),
          }
        : null,
      createdAt: new Date(
        conversation.createdAt,
      ),
      updatedAt: now,
      expiresAt: new Date(
        now.getTime() +
          this.conversationTtlMs,
      ),
    };

    this.conversations.set(
      normalizedConversation.conversationId,
      normalizedConversation,
    );

    return this.cloneConversation(
      normalizedConversation,
    );
  }

  delete(conversationId: string): boolean {
    return this.conversations.delete(
      conversationId,
    );
  }

  has(conversationId: string): boolean {
    return this.get(conversationId) !== null;
  }

  clear(): void {
    this.conversations.clear();
  }

  size(): number {
    this.removeExpiredConversations();

    return this.conversations.size;
  }

  private removeExpiredConversations(): void {
    const now = Date.now();

    for (const [
      conversationId,
      conversation,
    ] of this.conversations.entries()) {
      if (
        conversation.expiresAt.getTime() <=
        now
      ) {
        this.conversations.delete(
          conversationId,
        );
      }
    }
  }

  private ensureCapacity(): void {
    if (
      this.conversations.size <
      MAX_CONVERSATIONS
    ) {
      return;
    }

    const oldestConversation =
      [...this.conversations.values()]
        .sort(
          (
            firstConversation,
            secondConversation,
          ) =>
            firstConversation.updatedAt.getTime() -
            secondConversation.updatedAt.getTime(),
        )[0];

    if (oldestConversation) {
      this.conversations.delete(
        oldestConversation.conversationId,
      );
    }
  }

  private cloneConversation(
    conversation:
      AssistantConversationState,
  ): AssistantConversationState {
    return {
      ...conversation,
      messages:
        conversation.messages.map(
          (message) => ({
            ...message,
            createdAt: new Date(
              message.createdAt,
            ),
          }),
        ),
      lastReferences:
        conversation.lastReferences.map(
          (reference) => ({
            ...reference,
          }),
        ),
      lastResult: conversation.lastResult
        ? {
            ...conversation.lastResult,
            suggestions: [
              ...conversation.lastResult
                .suggestions,
            ],
            sources:
              conversation.lastResult.sources.map(
                (source) => ({
                  ...source,
                }),
              ),
          }
        : null,
      createdAt: new Date(
        conversation.createdAt,
      ),
      updatedAt: new Date(
        conversation.updatedAt,
      ),
      expiresAt: new Date(
        conversation.expiresAt,
      ),
    };
  }
}