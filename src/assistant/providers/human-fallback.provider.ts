import { Injectable } from "@nestjs/common";

import type {
  AssistantProvider,
  AssistantProviderInput,
} from "./assistant-provider.interface.js";

import type { AssistantResult } from "../assistant.types.js";

@Injectable()
export class HumanFallbackProvider
  implements AssistantProvider
{
  canHandle(): boolean {
    return true;
  }

  async generateResponse(
    _input: AssistantProviderInput,
  ): Promise<AssistantResult> {
    return {
      answer:
        "I'm sorry, but I couldn't confidently answer your question using the available festival information. Please contact the Waterfall Festival team through the Contact page, and a member of the team will be happy to assist you.",
      handledBy: "HUMAN_FALLBACK",
      intent: "UNKNOWN",
      confidence: 0,
      requiresHumanFollowUp: true,
      suggestions: [
        "Contact the festival team",
        "View the FAQ",
        "Browse upcoming events",
      ],
      sources: [],
    };
  }
}