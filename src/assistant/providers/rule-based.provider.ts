import { Injectable } from "@nestjs/common";

import { AssistantResponseBuilder } from "../assistant-response.builder.js";
import { AssistantSourceService } from "../assistant-source.service.js";
import { AssistantSuggestionService } from "../assistant-suggestion.service.js";

import type {
  AssistantContextEvent,
  AssistantContextFaq,
  AssistantContextTicket,
  AssistantIntent,
  AssistantProviderResult,
  AssistantSource,
  RetrievedAssistantContext,
} from "../assistant.types.js";

import type {
  AssistantProvider,
  AssistantProviderInput,
} from "./assistant-provider.interface.js";

type GeneratedAnswer = {
  answer: string;
  confidence: number;
  sources: AssistantSource[];
};

@Injectable()
export class RuleBasedProvider
  implements AssistantProvider
{
  constructor(
    private readonly responseBuilder:
      AssistantResponseBuilder,

    private readonly suggestionService:
      AssistantSuggestionService,

    private readonly sourceService:
      AssistantSourceService,
  ) {}

  canHandle(
    input: AssistantProviderInput,
  ): boolean {
    return this.hasContextForIntent(
      input.intent,
      input.context,
    );
  }

  async generateResponse(
    input: AssistantProviderInput,
  ): Promise<AssistantProviderResult> {
    const generatedAnswer =
      this.generateForIntent(
        input.intent,
        input.message,
        input.context,
      );

    if (!generatedAnswer) {
      return {
        answer: "",
        handledBy: "RULE_BASED",
        intent: input.intent,
        confidence: 0,
        requiresHumanFollowUp: true,
        suggestions: [],
        sources: [],
      };
    }

    const suggestions =
      this.suggestionService.buildSuggestions({
        intent: input.intent,
        context: input.context,
        message: input.message,
      });

    return {
      answer: generatedAnswer.answer,
      handledBy: "RULE_BASED",
      intent: input.intent,
      confidence:
        generatedAnswer.confidence,
      requiresHumanFollowUp: false,
      suggestions,
      sources:
        this.sourceService.limitSources(
          generatedAnswer.sources,
        ),
    };
  }

  private hasContextForIntent(
    intent: AssistantIntent,
    context: RetrievedAssistantContext,
  ): boolean {
    switch (intent) {
      case "EVENTS":
        return context.events.length > 0;

      case "TICKETS":
        return context.tickets.length > 0;

      case "VENUE":
      case "CONTACT":
        return context.settings !== null;

      case "FAQ":
        return context.faqs.length > 0;

      case "EXPERIENCE":
        return context.experience !== null;

      case "GENERAL":
        return (
          context.events.length > 0 ||
          context.tickets.length > 0 ||
          context.faqs.length > 0 ||
          context.settings !== null ||
          context.experience !== null
        );

      case "UNKNOWN":
      default:
        return false;
    }
  }

  private generateForIntent(
    intent: AssistantIntent,
    message: string,
    context: RetrievedAssistantContext,
  ): GeneratedAnswer | null {
    switch (intent) {
      case "EVENTS":
        return this.generateEventAnswer(
          message,
          context.events,
        );

      case "TICKETS":
        return this.generateTicketAnswer(
          message,
          context,
        );

      case "VENUE":
        return this.generateVenueAnswer(
          context,
        );

      case "CONTACT":
        return this.generateContactAnswer(
          context,
        );

      case "FAQ":
        return this.generateFaqAnswer(
          message,
          context.faqs,
        );

      case "EXPERIENCE":
        return this.generateExperienceAnswer(
          context,
        );

      case "GENERAL":
        return this.generateGeneralAnswer(
          message,
          context,
        );

      case "UNKNOWN":
      default:
        return null;
    }
  }

  private generateEventAnswer(
    message: string,
    events: AssistantContextEvent[],
  ): GeneratedAnswer | null {
    if (events.length === 0) {
      return null;
    }

    const normalizedMessage =
      this.normalizeText(message);

    const matchingEvent = events.find(
      (event) =>
        normalizedMessage.includes(
          this.normalizeText(event.title),
        ) ||
        normalizedMessage.includes(
          this.normalizeText(event.slug),
        ),
    );

    const selectedEvent =
      matchingEvent ??
      this.getNextEvent(events);

    if (!selectedEvent) {
      return null;
    }

    const builtResponse =
      this.responseBuilder.buildEventResponse(
        selectedEvent,
        {
          isExactMatch:
            matchingEvent !== undefined,
        },
      );

    return {
      answer: builtResponse.answer,
      confidence:
        builtResponse.confidence,
      sources: [
        this.sourceService.buildEventSource(
          selectedEvent,
        ),
      ],
    };
  }

  private generateTicketAnswer(
    message: string,
    context: RetrievedAssistantContext,
  ): GeneratedAnswer | null {
    const { tickets } = context;

    if (tickets.length === 0) {
      return null;
    }

    const normalizedMessage =
      this.normalizeText(message);

    const matchingTicket =
      this.findMatchingTicket(
        normalizedMessage,
        tickets,
      );

    if (matchingTicket) {
      const builtResponse =
        this.responseBuilder.buildTicketResponse(
          matchingTicket,
        );

      return {
        answer: builtResponse.answer,
        confidence:
          builtResponse.confidence,
        sources: [
          this.sourceService.buildTicketSource(
            matchingTicket,
          ),
        ],
      };
    }

    const availableTickets =
      tickets.filter((ticket) =>
        this.isTicketAvailable(ticket),
      );

    const ticketsToDisplay =
      availableTickets.length > 0
        ? availableTickets.slice(0, 3)
        : tickets.slice(0, 3);

    if (ticketsToDisplay.length === 0) {
      return null;
    }

    const builtResponse =
      this.responseBuilder.buildTicketListResponse(
        ticketsToDisplay,
      );

    return {
      answer: builtResponse.answer,
      confidence:
        builtResponse.confidence,
      sources:
        this.sourceService.buildTicketSources(
          ticketsToDisplay,
        ),
    };
  }

  private generateVenueAnswer(
    context: RetrievedAssistantContext,
  ): GeneratedAnswer | null {
    const settings = context.settings;

    if (!settings) {
      return null;
    }

    const builtResponse =
      this.responseBuilder.buildVenueResponse(
        settings,
      );

    return {
      answer: builtResponse.answer,
      confidence:
        builtResponse.confidence,
      sources: [
        this.sourceService.buildVenueSource(
          settings,
        ),
      ],
    };
  }

  private generateContactAnswer(
    context: RetrievedAssistantContext,
  ): GeneratedAnswer | null {
    const settings = context.settings;

    if (!settings) {
      return null;
    }

    const builtResponse =
      this.responseBuilder.buildContactResponse(
        settings,
      );

    return {
      answer: builtResponse.answer,
      confidence:
        builtResponse.confidence,
      sources: [
        this.sourceService.buildContactSource(
          settings,
        ),
      ],
    };
  }

  private generateFaqAnswer(
    message: string,
    faqs: AssistantContextFaq[],
  ): GeneratedAnswer | null {
    if (faqs.length === 0) {
      return null;
    }

    const matchingFaq =
      this.findBestFaqMatch(
        message,
        faqs,
      );

    if (!matchingFaq) {
      return null;
    }

    const builtResponse =
      this.responseBuilder.buildFaqResponse(
        matchingFaq,
      );

    return {
      answer: builtResponse.answer,
      confidence:
        builtResponse.confidence,
      sources: [
        this.sourceService.buildFaqSource(
          matchingFaq,
        ),
      ],
    };
  }

  private generateExperienceAnswer(
    context: RetrievedAssistantContext,
  ): GeneratedAnswer | null {
    const experience =
      context.experience;

    if (!experience) {
      return null;
    }

    const builtResponse =
      this.responseBuilder.buildExperienceResponse(
        experience,
      );

    return {
      answer: builtResponse.answer,
      confidence:
        builtResponse.confidence,
      sources: [
        this.sourceService.buildExperienceSource(
          experience,
        ),
      ],
    };
  }

  private generateGeneralAnswer(
    message: string,
    context: RetrievedAssistantContext,
  ): GeneratedAnswer | null {
    const faqAnswer =
      this.generateFaqAnswer(
        message,
        context.faqs,
      );

    if (faqAnswer) {
      return faqAnswer;
    }

    if (!context.settings) {
      return null;
    }

    const builtResponse =
      this.responseBuilder.buildGeneralResponse(
        context.settings,
      );

    return {
      answer: builtResponse.answer,
      confidence:
        builtResponse.confidence,
      sources: [
        this.sourceService.buildSettingsSource(
          context.settings,
        ),
      ],
    };
  }

  private findMatchingTicket(
    normalizedMessage: string,
    tickets: AssistantContextTicket[],
  ): AssistantContextTicket | undefined {
    const explicitMatch = tickets.find(
      (ticket) =>
        normalizedMessage.includes(
          this.normalizeText(ticket.name),
        ) ||
        normalizedMessage.includes(
          this.normalizeText(ticket.slug),
        ),
    );

    if (explicitMatch) {
      return explicitMatch;
    }

    if (
      normalizedMessage.includes("vip") ||
      normalizedMessage.includes(
        "premium",
      )
    ) {
      return tickets.find((ticket) => {
        const searchableText =
          this.createTicketSearchText(
            ticket,
          );

        return (
          searchableText.includes("vip") ||
          searchableText.includes(
            "premium",
          )
        );
      });
    }

    if (
      normalizedMessage.includes("group") ||
      normalizedMessage.includes(
        "friends",
      ) ||
      normalizedMessage.includes("five") ||
      normalizedMessage.includes(
        "5 people",
      )
    ) {
      return tickets.find((ticket) => {
        const searchableText =
          this.createTicketSearchText(
            ticket,
          );

        return (
          searchableText.includes("group") ||
          searchableText.includes(
            "friends",
          ) ||
          searchableText.includes("five") ||
          searchableText.includes(
            "5 people",
          )
        );
      });
    }

    if (
      normalizedMessage.includes("cheap") ||
      normalizedMessage.includes(
        "cheapest",
      ) ||
      normalizedMessage.includes(
        "lowest price",
      ) ||
      normalizedMessage.includes(
        "least expensive",
      )
    ) {
      return [...tickets]
        .filter((ticket) =>
          this.isTicketAvailable(ticket),
        )
        .sort(
          (
            firstTicket,
            secondTicket,
          ) =>
            firstTicket.price -
            secondTicket.price,
        )[0];
    }

    return undefined;
  }

  private createTicketSearchText(
    ticket: AssistantContextTicket,
  ): string {
    return this.normalizeText(
      [
        ticket.name,
        ticket.slug,
        ticket.shortDescription ?? "",
        ticket.description ?? "",
        ...ticket.benefits,
      ].join(" "),
    );
  }

  private findBestFaqMatch(
    message: string,
    faqs: AssistantContextFaq[],
  ): AssistantContextFaq | null {
    const messageWords =
      this.extractMeaningfulWords(message);

    if (messageWords.length === 0) {
      return null;
    }

    let bestFaq:
      | AssistantContextFaq
      | null = null;

    let bestScore = 0;

    for (const faq of faqs) {
      const questionWords =
        this.extractMeaningfulWords(
          faq.question,
        );

      const categoryWords =
        this.extractMeaningfulWords(
          faq.category ?? "",
        );

      const answerWords =
        this.extractMeaningfulWords(
          faq.answer,
        );

      const questionScore =
        this.countMatchingWords(
          messageWords,
          questionWords,
        ) * 3;

      const categoryScore =
        this.countMatchingWords(
          messageWords,
          categoryWords,
        ) * 2;

      const answerScore =
        this.countMatchingWords(
          messageWords,
          answerWords,
        );

      const totalScore =
        questionScore +
        categoryScore +
        answerScore;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestFaq = faq;
      }
    }

    const minimumScore =
      messageWords.length <= 3
        ? 2
        : 3;

    return bestScore >= minimumScore
      ? bestFaq
      : null;
  }

  private countMatchingWords(
    sourceWords: string[],
    searchableWords: string[],
  ): number {
    const searchableWordSet =
      new Set(searchableWords);

    return sourceWords.reduce(
      (total, word) =>
        searchableWordSet.has(word)
          ? total + 1
          : total,
      0,
    );
  }

  private getNextEvent(
    events: AssistantContextEvent[],
  ): AssistantContextEvent | null {
    const now = Date.now();

    const futureEvents = events
      .filter((event) => {
        const eventTime = new Date(
          event.date,
        ).getTime();

        return (
          !Number.isNaN(eventTime) &&
          eventTime >= now
        );
      })
      .sort(
        (
          firstEvent,
          secondEvent,
        ) =>
          new Date(
            firstEvent.date,
          ).getTime() -
          new Date(
            secondEvent.date,
          ).getTime(),
      );

    return (
      futureEvents[0] ??
      events[0] ??
      null
    );
  }

  private isTicketAvailable(
    ticket: AssistantContextTicket,
  ): boolean {
    if (
      ticket.remainingQuantity === 0
    ) {
      return false;
    }

    return [
      "AVAILABLE",
      "LIMITED",
      "SCHEDULED",
    ].includes(ticket.status);
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

  private extractMeaningfulWords(
    value: string,
  ): string[] {
    const ignoredWords = new Set([
      "a",
      "about",
      "an",
      "and",
      "are",
      "can",
      "could",
      "do",
      "for",
      "how",
      "i",
      "in",
      "is",
      "it",
      "me",
      "of",
      "on",
      "please",
      "the",
      "to",
      "what",
      "when",
      "where",
      "which",
      "with",
      "you",
    ]);

    return [
      ...new Set(
        this.normalizeText(value)
          .split(" ")
          .filter(
            (word) =>
              word.length > 1 &&
              !ignoredWords.has(word),
          ),
      ),
    ];
  }
}