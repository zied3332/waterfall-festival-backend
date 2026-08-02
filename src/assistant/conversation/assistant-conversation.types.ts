import type {
  AssistantIntent,
  AssistantResult,
  AssistantSource,
} from "../assistant.types.js";

export type AssistantConversationRole =
  | "USER"
  | "ASSISTANT";

export type AssistantConversationMessage = {
  id: string;
  role: AssistantConversationRole;
  content: string;
  createdAt: Date;
};

export type AssistantConversationReference = {
  type:
    | "EVENT"
    | "TICKET"
    | "FAQ"
    | "SETTINGS"
    | "EXPERIENCE";

  id?: number;
  label: string;
  url?: string;
};

export type AssistantConversationState = {
  conversationId: string;

  messages: AssistantConversationMessage[];

  lastIntent: AssistantIntent | null;

  lastReferences:
    AssistantConversationReference[];

  lastResult: AssistantResult | null;

  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
};

export type CreateConversationInput = {
  conversationId?: string;
};

export type AddConversationMessageInput = {
  conversationId: string;
  role: AssistantConversationRole;
  content: string;
};

export type UpdateConversationContextInput = {
  conversationId: string;
  intent: AssistantIntent;
  result: AssistantResult;
};

export type ConversationResolution = {
  conversationId: string;
  conversation:
    | AssistantConversationState
    | null;
};

export function createConversationReferences(
  sources: AssistantSource[],
): AssistantConversationReference[] {
  return sources.map((source) => ({
    type: source.type,
    ...(source.id !== undefined && {
      id: source.id,
    }),
    label: source.label,
    ...(source.url && {
      url: source.url,
    }),
  }));
}