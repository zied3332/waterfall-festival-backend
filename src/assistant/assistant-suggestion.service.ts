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
        return this.buildVenueSuggestions();

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
      "Which tickets are available?",
      "Where is the venue?",
    ];

    if (context.events.length > 1) {
      suggestions.push(
        "What other upcoming events are available?",
      );
    } else {
      suggestions.push(
        "Tell me more about this event",
      );
    }

    return this.limitSuggestions(
      suggestions,
    );
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
        this.createTicketSearchText(
          ticket,
        ).includes("vip"),
    );

    const hasGroupTicket = tickets.some(
      (ticket) => {
        const searchableText =
          this.createTicketSearchText(
            ticket,
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
        "Which VIP tickets are available?",
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

    if (
      hasAvailableTicket &&
      !normalizedMessage.includes("cheap") &&
      !normalizedMessage.includes(
        "cheapest",
      )
    ) {
      suggestions.push(
        "Which ticket is the cheapest?",
      );
    }

    suggestions.push(
      "What benefits are included with the tickets?",
    );

    return this.limitSuggestions(
      suggestions,
    );
  }

  private buildVenueSuggestions(): string[] {
    return [
      "Is parking available?",
      "How do I get to the venue?",
      "How can I contact the festival team?",
    ];
  }

  private buildContactSuggestions(): string[] {
    return [
      "What upcoming events are available?",
      "Where is the venue?",
      "What should I know before attending?",
    ];
  }

  private buildFaqSuggestions(): string[] {
    return [
      "What should I bring?",
      "What items are prohibited?",
      "How can I contact the festival team?",
    ];
  }

  private buildExperienceSuggestions(): string[] {
    return [
      "What can I expect at the festival?",
      "What upcoming events are available?",
      "Which tickets are available?",
    ];
  }

  private buildGeneralSuggestions(
    context: RetrievedAssistantContext,
  ): string[] {
    const suggestions: string[] = [];

    if (context.events.length > 0) {
      suggestions.push(
        "What upcoming events are available?",
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

    if (context.experience) {
      suggestions.push(
        "What can I expect at the festival?",
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
      "How can I contact the festival team?",
      "What should I know before attending?",
      "What upcoming events are available?",
    ];
  }

  private createTicketSearchText(
    ticket: AssistantContextTicket,
  ): string {
    return this.normalizeText(
      [
        ticket.name,
        ticket.shortDescription ?? "",
        ticket.description ?? "",
        ...ticket.benefits,
      ].join(" "),
    );
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