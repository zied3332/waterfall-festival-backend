import { Injectable } from "@nestjs/common";

import type {
  AssistantContextEvent,
  AssistantContextFaq,
  AssistantContextTicket,
  AssistantIntent,
  AssistantResult,
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
  suggestions: string[];
  sources: AssistantSource[];
};

const MONTH_DATE_FORMATTER =
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

@Injectable()
export class RuleBasedProvider
  implements AssistantProvider
{
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
  ): Promise<AssistantResult> {
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

    return {
      answer: generatedAnswer.answer,
      handledBy: "RULE_BASED",
      intent: input.intent,
      confidence: generatedAnswer.confidence,
      requiresHumanFollowUp: false,
      suggestions:
        generatedAnswer.suggestions,
      sources: generatedAnswer.sources,
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
          context.tickets,
        );

      case "VENUE":
        return this.generateVenueAnswer(context);

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

    const event =
      matchingEvent ??
      this.getNextEvent(events);

    if (!event) {
      return null;
    }

    const formattedDate =
      this.formatDate(event.date);

    const description =
      event.description.trim();

    const answerParts = [
      `The next available event is ${event.title}.`,
      `It is scheduled for ${formattedDate} at ${event.location}.`,
    ];

    if (description) {
      answerParts.push(description);
    }

    return {
      answer: answerParts.join(" "),
      confidence: matchingEvent ? 0.97 : 0.92,
      suggestions: [
        "Show available tickets",
        "Where is the venue?",
        "Open the event page",
      ],
      sources: [
        {
          type: "EVENT",
          id: event.id,
          label: event.title,
          url: `/events/${event.slug}`,
        },
      ],
    };
  }

  private generateTicketAnswer(
    message: string,
    tickets: AssistantContextTicket[],
  ): GeneratedAnswer | null {
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
      return this.describeTicket(
        matchingTicket,
      );
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

    const ticketSummary = ticketsToDisplay
      .map(
        (ticket) =>
          `${ticket.name} for ${this.formatPrice(
            ticket.price,
            ticket.currency,
          )}`,
      )
      .join(", ");

    return {
      answer:
        `The currently listed ticket options include ${ticketSummary}. ` +
        "Choose a ticket based on the benefits, group size, and availability shown on the ticket page.",
      confidence: 0.88,
      suggestions: [
        "Show me VIP tickets",
        "Which ticket is best for a group?",
        "Open the ticket page",
      ],
      sources: ticketsToDisplay.map(
        (ticket) => ({
          type: "TICKET",
          id: ticket.id,
          label: ticket.name,
          url: `/tickets#${ticket.slug}`,
        }),
      ),
    };
  }

  private describeTicket(
    ticket: AssistantContextTicket,
  ): GeneratedAnswer {
    const answerParts = [
      `${ticket.name} costs ${this.formatPrice(
        ticket.price,
        ticket.currency,
      )}.`,
    ];

    if (
      ticket.originalPrice !== null &&
      ticket.originalPrice > ticket.price
    ) {
      answerParts.push(
        `The original price was ${this.formatPrice(
          ticket.originalPrice,
          ticket.currency,
        )}.`,
      );
    }

    const description =
      ticket.shortDescription?.trim() ||
      ticket.description?.trim();

    if (description) {
      answerParts.push(description);
    }

    if (ticket.benefits.length > 0) {
      answerParts.push(
        `Benefits include ${ticket.benefits
          .slice(0, 4)
          .join(", ")}.`,
      );
    }

    if (ticket.availabilityLabel) {
      answerParts.push(
        ticket.availabilityLabel,
      );
    } else if (
      ticket.remainingQuantity !== null
    ) {
      answerParts.push(
        `${ticket.remainingQuantity} tickets are currently recorded as remaining.`,
      );
    }

    if (ticket.externalPurchaseUrl) {
      answerParts.push(
        "You can use the official ticket link to continue with the purchase.",
      );
    }

    return {
      answer: answerParts.join(" "),
      confidence: 0.97,
      suggestions: [
        "Show ticket benefits",
        "Show other tickets",
        "Open the ticket page",
      ],
      sources: [
        {
          type: "TICKET",
          id: ticket.id,
          label: ticket.name,
          url: ticket.externalPurchaseUrl ??
            `/tickets#${ticket.slug}`,
        },
      ],
    };
  }

  private generateVenueAnswer(
    context: RetrievedAssistantContext,
  ): GeneratedAnswer | null {
    const settings = context.settings;

    if (!settings) {
      return null;
    }

    const venue =
      settings.venue?.trim();

    const location =
      settings.location?.trim();

    const address =
      settings.address?.trim();

    const place =
      address ||
      [venue, location]
        .filter(Boolean)
        .join(", ");

    if (!place) {
      return null;
    }

    const answerParts = [
      `${settings.festivalName} is located at ${place}.`,
    ];

    if (settings.googleMapsUrl) {
      answerParts.push(
        "You can open the official map link for directions.",
      );
    }

    return {
      answer: answerParts.join(" "),
      confidence: 0.96,
      suggestions: [
        "Open Google Maps",
        "Is parking available?",
        "How can I contact the festival?",
      ],
      sources: [
        {
          type: "SETTINGS",
          label: `${settings.festivalName} venue`,
          url:
            settings.googleMapsUrl ??
            "/venue",
        },
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

    const email =
      settings.supportEmail?.trim() ||
      settings.publicEmail?.trim();

    const phone =
      settings.phoneNumber?.trim();

    const whatsapp =
      settings.whatsappNumber?.trim();

    const contactParts: string[] = [];

    if (email) {
      contactParts.push(`email at ${email}`);
    }

    if (phone) {
      contactParts.push(`phone at ${phone}`);
    }

    if (whatsapp) {
      contactParts.push(
        `WhatsApp at ${whatsapp}`,
      );
    }

    if (contactParts.length === 0) {
      return {
        answer:
          "Please use the Contact page to send your question to the festival team.",
        confidence: 0.9,
        suggestions: [
          "Open the contact page",
          "View the FAQ",
        ],
        sources: [
          {
            type: "SETTINGS",
            label: "Festival contact page",
            url: "/contact",
          },
        ],
      };
    }

    return {
      answer:
        `You can contact the ${settings.festivalName} team by ` +
        `${this.joinNaturalLanguage(contactParts)}. ` +
        "You can also use the Contact page to send a message.",
      confidence: 0.98,
      suggestions: [
        "Open the contact page",
        "Where is the venue?",
        "View the FAQ",
      ],
      sources: [
        {
          type: "SETTINGS",
          label: `${settings.festivalName} contact information`,
          url: "/contact",
        },
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

    const matchedFaq =
      this.findBestFaqMatch(message, faqs);

    if (!matchedFaq) {
      return null;
    }

    return {
      answer: matchedFaq.answer,
      confidence: 0.93,
      suggestions: [
        "View more questions",
        "Contact the festival team",
        "Ask about the venue",
      ],
      sources: [
        {
          type: "FAQ",
          id: matchedFaq.id,
          label: matchedFaq.question,
          url: `/faq#faq-${matchedFaq.id}`,
        },
      ],
    };
  }

  private generateExperienceAnswer(
    context: RetrievedAssistantContext,
  ): GeneratedAnswer | null {
    const experience = context.experience;

    if (!experience) {
      return null;
    }

    const answerParts = [
      experience.heroTitle,
    ];

    if (experience.heroSubtitle) {
      answerParts.push(
        experience.heroSubtitle,
      );
    }

    if (experience.heroDescription) {
      answerParts.push(
        experience.heroDescription,
      );
    } else {
      answerParts.push(
        experience.storyDescription,
      );
    }

    return {
      answer: answerParts.join(" "),
      confidence: 0.93,
      suggestions: [
        "Explore the experience page",
        "Show upcoming events",
        "Show available tickets",
      ],
      sources: [
        {
          type: "EXPERIENCE",
          label: experience.storyTitle,
          url: "/experience",
        },
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

    const settings = context.settings;

    if (!settings) {
      return null;
    }

    return {
      answer:
        `I can help you with ${settings.festivalName} events, tickets, venue information, FAQs, contact details, and the festival experience.`,
      confidence: 0.75,
      suggestions: [
        "What events are coming up?",
        "Which tickets are available?",
        "Where is the venue?",
      ],
      sources: [
        {
          type: "SETTINGS",
          label: settings.festivalName,
          url: "/",
        },
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
      normalizedMessage.includes("premium")
    ) {
      return tickets.find((ticket) =>
        this.normalizeText(ticket.name)
          .includes("vip"),
      );
    }

    if (
      normalizedMessage.includes("group") ||
      normalizedMessage.includes("friends") ||
      normalizedMessage.includes("five") ||
      normalizedMessage.includes("5 people")
    ) {
      return tickets.find((ticket) => {
        const searchableText =
          this.normalizeText(
            `${ticket.name} ${ticket.shortDescription ?? ""} ${
              ticket.description ?? ""
            } ${ticket.benefits.join(" ")}`,
          );

        return (
          searchableText.includes("group") ||
          searchableText.includes("friends") ||
          searchableText.includes("five")
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
      )
    ) {
      return [...tickets]
        .filter((ticket) =>
          this.isTicketAvailable(ticket),
        )
        .sort(
          (firstTicket, secondTicket) =>
            firstTicket.price -
            secondTicket.price,
        )[0];
    }

    return undefined;
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

    let bestFaq: AssistantContextFaq | null =
      null;

    let bestScore = 0;

    for (const faq of faqs) {
      const searchableWords =
        this.extractMeaningfulWords(
          `${faq.question} ${faq.category ?? ""}`,
        );

      const score = messageWords.reduce(
        (total, word) =>
          searchableWords.includes(word)
            ? total + 1
            : total,
        0,
      );

      if (score > bestScore) {
        bestScore = score;
        bestFaq = faq;
      }
    }

    const minimumScore =
      messageWords.length <= 3 ? 1 : 2;

    return bestScore >= minimumScore
      ? bestFaq
      : null;
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
        (firstEvent, secondEvent) =>
          new Date(firstEvent.date).getTime() -
          new Date(secondEvent.date).getTime(),
      );

    return futureEvents[0] ?? events[0] ?? null;
  }

  private isTicketAvailable(
    ticket: AssistantContextTicket,
  ): boolean {
    return [
      "AVAILABLE",
      "LIMITED",
      "SCHEDULED",
    ].includes(ticket.status);
  }

  private formatDate(value: string): string {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return MONTH_DATE_FORMATTER.format(date);
  }

  private formatPrice(
    price: number,
    currency: string,
  ): string {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(price);
    } catch {
      return `${price} ${currency}`;
    }
  }

  private normalizeText(value: string): string {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
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
      "an",
      "and",
      "are",
      "can",
      "do",
      "for",
      "how",
      "i",
      "is",
      "it",
      "of",
      "on",
      "the",
      "to",
      "what",
      "when",
      "where",
      "which",
      "with",
      "you",
    ]);

    return this.normalizeText(value)
      .split(" ")
      .filter(
        (word) =>
          word.length > 1 &&
          !ignoredWords.has(word),
      );
  }

  private joinNaturalLanguage(
    values: string[],
  ): string {
    if (values.length === 1) {
      return values[0];
    }

    if (values.length === 2) {
      return `${values[0]} or ${values[1]}`;
    }

    return `${values
      .slice(0, -1)
      .join(", ")}, or ${
      values.at(-1) ?? ""
    }`;
  }
}