import { Injectable } from "@nestjs/common";

import type {
  AssistantProvider,
  AssistantProviderInput,
} from "./assistant-provider.interface.js";

import type {
  AssistantProviderResult,
} from "../assistant.types.js";

@Injectable()
export class HumanFallbackProvider
  implements AssistantProvider
{
  canHandle(): boolean {
    return true;
  }

  async generateResponse(
    _input: AssistantProviderInput,
  ): Promise<AssistantProviderResult> {
    return {
      answer:
        "I'm sorry, but I couldn't confidently answer your question using the available festival information. Please use the Contact page so a member of the Waterfall Festival team can help you.",
      handledBy: "HUMAN_FALLBACK",
      intent: "UNKNOWN",
      confidence: 0,
      requiresHumanFollowUp: true,
      suggestions: [
        "How can I contact the festival team?",
        "What should I know before attending?",
        "What upcoming events are available?",
      ],
      sources: [],
    };
  }
}