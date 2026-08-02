import type {
  AssistantIntent,
  AssistantProviderResult,
  RetrievedAssistantContext,
} from "../assistant.types.js";

export type AssistantProviderInput = {
  message: string;
  intent: AssistantIntent;
  context: RetrievedAssistantContext;
  conversationId?: string;
};

export interface AssistantProvider {
  canHandle(
    input: AssistantProviderInput,
  ): boolean;

  generateResponse(
    input: AssistantProviderInput,
  ): Promise<AssistantProviderResult>;
}