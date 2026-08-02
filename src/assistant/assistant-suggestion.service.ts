import { Injectable } from "@nestjs/common";

import type {
  AssistantContextTicket,
  AssistantIntent,
  RetrievedAssistantContext,
} from "./assistant.types.js";

type SuggestionOptions = {
  intent: AssistantIntent;
  context: RetrievedAssistantContext;
  message?: string;
};

@Injectable()
export class AssistantSuggestionService {
  buildSuggestions({
    intent,
    context,
    message = "",
  }: SuggestionOptions): string[] {
    switch (intent) {
      case "EVENTS":
        return this.buildEventSuggestions(
          context,
        );

      case "TICKETS":
        return this.buildTicketSuggestions(
          context.tickets,
          message,
        );

      case "VENUE":
        return this.buildVenueSuggestions(
          context,
        );

      case "CONTACT":
        return this.buildContactSuggestions();

      case "FAQ":
        return this.buildFaqSuggestions();

      case "EXPERIENCE":
        return this.buildExperienceSuggestions();

      case "GENERAL":
        return this.buildGeneralSuggestions(
          context,
        );

      case "UNKNOWN":
      default:
        return this.buildFallbackSuggestions();
    }
  }

  private buildEventSuggestions(
    context: RetrievedAssistantContext,
  ): string[] {
    const suggestions = [
      "Show available tickets",
      "Where is the venue?",
    ];

    if (context.events.length > 1) {
      suggestions.push(
        "Show all upcoming events",
      );
    } else {
      suggestions.push(
        "Open the event page",
      );
    }

    return suggestions;
  }

  private buildTicketSuggestions(
    tickets: AssistantContextTicket[],
    message: string,
  ): string[] {
    const normalizedMessage =
      this.normalizeText(message);

    const suggestions: string[] = [];

    const hasVipTicket = tickets.some(
      (ticket) =>
        this.normalizeText(
          `${ticket.name} ${ticket.description ?? ""}`,
        ).includes("vip"),
    );

    const hasGroupTicket = tickets.some(
      (ticket) => {
        const searchableText =
          this.normalizeText(
            `${ticket.name} ${
              ticket.shortDescription ?? ""
            } ${
              ticket.description ?? ""
            } ${ticket.benefits.join(" ")}`,
          );

        return (
          searchableText.includes("group") ||
          searchableText.includes("friends")
        );
      },
    );

    const hasAvailableTicket =
      tickets.some((ticket) =>
        [
          "AVAILABLE",
          "LIMITED",
          "SCHEDULED",
        ].includes(ticket.status),
      );

    if (
      hasVipTicket &&
      !normalizedMessage.includes("vip")
    ) {
      suggestions.push(
        "Show me VIP tickets",
      );
    }

    if (
      hasGroupTicket &&
      !normalizedMessage.includes("group") &&
      !normalizedMessage.includes("friends")
    ) {
      suggestions.push(
        "Which ticket is best for a group?",
      );
    }

    if (hasAvailableTicket) {
      suggestions.push(
        "Which ticket is the cheapest?",
      );
    }

    suggestions.push(
      "Open the ticket page",
    );

    return this.limitSuggestions(
      suggestions,
    );
  }

  private buildVenueSuggestions(
    context: RetrievedAssistantContext,
  ): string[] {
    const suggestions = [
      "Is parking available?",
      "How can I contact the festival?",
    ];

    if (
      context.settings?.googleMapsUrl
    ) {
      suggestions.unshift(
        "Open Google Maps",
      );
    } else {
      suggestions.unshift(
        "View the venue page",
      );
    }

    return suggestions;
  }

  private buildContactSuggestions(): string[] {
    return [
      "Open the contact page",
      "Where is the venue?",
      "View the FAQ",
    ];
  }

  private buildFaqSuggestions(): string[] {
    return [
      "View more questions",
      "Contact the festival team",
      "Ask about the venue",
    ];
  }

  private buildExperienceSuggestions(): string[] {
    return [
      "Explore the experience page",
      "Show upcoming events",
      "Show available tickets",
    ];
  }

  private buildGeneralSuggestions(
    context: RetrievedAssistantContext,
  ): string[] {
    const suggestions: string[] = [];

    if (context.events.length > 0) {
      suggestions.push(
        "What events are coming up?",
      );
    }

    if (context.tickets.length > 0) {
      suggestions.push(
        "Which tickets are available?",
      );
    }

    if (context.settings) {
      suggestions.push(
        "Where is the venue?",
      );
    }

    if (context.faqs.length > 0) {
      suggestions.push(
        "What should I bring?",
      );
    }

    return this.limitSuggestions(
      suggestions.length > 0
        ? suggestions
        : this.buildFallbackSuggestions(),
    );
  }

  private buildFallbackSuggestions(): string[] {
    return [
      "Contact the festival team",
      "View the FAQ",
      "Browse upcoming events",
    ];
  }

  private limitSuggestions(
    suggestions: string[],
  ): string[] {
    return [
      ...new Set(
        suggestions
          .map((suggestion) =>
            suggestion.trim(),
          )
          .filter(Boolean),
      ),
    ].slice(0, 3);
  }

  private normalizeText(
    value: string,
  ): string {
    return value
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        "",
      )
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}