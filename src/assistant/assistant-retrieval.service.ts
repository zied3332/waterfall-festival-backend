import { Injectable } from "@nestjs/common";

import {
  EventStatus,
  FaqStatus,
  TicketStatus,
} from "../generated/prisma/enums.js";

import { PrismaService } from "../prisma/prisma.service.js";

import type {
  AssistantContextEvent,
  AssistantContextExperience,
  AssistantContextFaq,
  AssistantContextTicket,
  AssistantIntent,
  RetrievedAssistantContext,
} from "./assistant.types.js";

const EMPTY_CONTEXT: RetrievedAssistantContext = {
  events: [],
  tickets: [],
  faqs: [],
  settings: null,
  experience: null,
};

@Injectable()
export class AssistantRetrievalService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async retrieveContext(
    intent: AssistantIntent,
    message: string,
  ): Promise<RetrievedAssistantContext> {
    const normalizedMessage =
      this.normalizeText(message);

    switch (intent) {
      case "EVENTS":
        return {
          ...EMPTY_CONTEXT,
          events:
            await this.retrieveEvents(
              normalizedMessage,
            ),
        };

      case "TICKETS":
        return {
          ...EMPTY_CONTEXT,
          tickets:
            await this.retrieveTickets(
              normalizedMessage,
            ),
        };

      case "FAQ":
        return {
          ...EMPTY_CONTEXT,
          faqs:
            await this.retrieveFaqs(
              normalizedMessage,
            ),
        };

      case "EXPERIENCE":
        return {
          ...EMPTY_CONTEXT,
          experience:
            await this.retrieveExperience(),
        };

      case "VENUE":
      case "CONTACT":
        return {
          ...EMPTY_CONTEXT,

          // Website settings will be connected
          // once its service contract is added.
          settings: null,
        };

      case "GENERAL":
        return this.retrieveGeneralContext(
          normalizedMessage,
        );

      case "UNKNOWN":
      default:
        return {
          ...EMPTY_CONTEXT,
        };
    }
  }

  private async retrieveGeneralContext(
    normalizedMessage: string,
  ): Promise<RetrievedAssistantContext> {
    const [
      events,
      tickets,
      faqs,
      experience,
    ] = await Promise.all([
      this.retrieveEvents(
        normalizedMessage,
      ),
      this.retrieveTickets(
        normalizedMessage,
      ),
      this.retrieveFaqs(
        normalizedMessage,
      ),
      this.retrieveExperience(),
    ]);

    return {
      events,
      tickets,
      faqs,
      settings: null,
      experience,
    };
  }

  private async retrieveEvents(
    normalizedMessage: string,
  ): Promise<AssistantContextEvent[]> {
    const searchWords =
      this.extractSearchWords(
        normalizedMessage,
      );

    const events =
      await this.prisma.event.findMany({
        where: {
          status: EventStatus.PUBLISHED,
          ...(searchWords.length > 0 && {
            OR: searchWords.flatMap(
              (word) => [
                {
                  title: {
                    contains: word,
                    mode: "insensitive",
                  },
                },
                {
                  description: {
                    contains: word,
                    mode: "insensitive",
                  },
                },
                {
                  location: {
                    contains: word,
                    mode: "insensitive",
                  },
                },
              ],
            ),
          }),
        },
        orderBy: {
          date: "asc",
        },
        take: 10,
      });

    if (
      events.length === 0 &&
      searchWords.length > 0
    ) {
      return this.retrieveEvents("");
    }

    return events.map(
      (event): AssistantContextEvent => ({
        id: event.id,
        title: event.title,
        slug: event.slug,
        description: event.description,
        date: event.date.toISOString(),
        location: event.location,
        status: event.status,
      }),
    );
  }

  private async retrieveTickets(
    normalizedMessage: string,
  ): Promise<AssistantContextTicket[]> {
    const searchWords =
      this.extractSearchWords(
        normalizedMessage,
      );

    const tickets =
      await this.prisma.ticketPreview.findMany({
        where: {
          status: {
            in: [
              TicketStatus.SCHEDULED,
              TicketStatus.AVAILABLE,
              TicketStatus.LIMITED,
              TicketStatus.SOLD_OUT,
            ],
          },
          event: {
            status: EventStatus.PUBLISHED,
          },
          ...(searchWords.length > 0 && {
            OR: searchWords.flatMap(
              (word) => [
                {
                  name: {
                    contains: word,
                    mode: "insensitive",
                  },
                },
                {
                  shortDescription: {
                    contains: word,
                    mode: "insensitive",
                  },
                },
                {
                  description: {
                    contains: word,
                    mode: "insensitive",
                  },
                },
                {
                  badge: {
                    contains: word,
                    mode: "insensitive",
                  },
                },
                {
                  benefits: {
                    some: {
                      text: {
                        contains: word,
                        mode: "insensitive",
                      },
                    },
                  },
                },
              ],
            ),
          }),
        },
        include: {
          benefits: {
            orderBy: {
              sortOrder: "asc",
            },
          },
        },
        orderBy: [
          {
            isFeatured: "desc",
          },
          {
            sortOrder: "asc",
          },
          {
            createdAt: "desc",
          },
        ],
        take: 15,
      });

    if (
      tickets.length === 0 &&
      searchWords.length > 0
    ) {
      return this.retrieveTickets("");
    }

    return tickets.map(
      (ticket): AssistantContextTicket => ({
        id: ticket.id,
        name: ticket.name,
        slug: ticket.slug,
        shortDescription:
          ticket.shortDescription,
        description: ticket.description,
        price: Number(ticket.price),
        originalPrice:
          ticket.originalPrice === null
            ? null
            : Number(
                ticket.originalPrice,
              ),
        currency: ticket.currency,
        status: ticket.status,
        availabilityLabel:
          ticket.availabilityLabel,
        remainingQuantity:
          ticket.remainingQuantity,
        externalPurchaseUrl:
          ticket.externalPurchaseUrl,
        benefits: ticket.benefits.map(
          (benefit) => benefit.text,
        ),
      }),
    );
  }

  private async retrieveFaqs(
    normalizedMessage: string,
  ): Promise<AssistantContextFaq[]> {
    const searchWords =
      this.extractSearchWords(
        normalizedMessage,
      );

    const faqs =
      await this.prisma.faq.findMany({
        where: {
          status: FaqStatus.PUBLISHED,
          ...(searchWords.length > 0 && {
            OR: searchWords.flatMap(
              (word) => [
                {
                  question: {
                    contains: word,
                    mode: "insensitive",
                  },
                },
                {
                  answer: {
                    contains: word,
                    mode: "insensitive",
                  },
                },
                {
                  category: {
                    contains: word,
                    mode: "insensitive",
                  },
                },
              ],
            ),
          }),
        },
        orderBy: [
          {
            sortOrder: "asc",
          },
          {
            createdAt: "desc",
          },
        ],
        take: 15,
      });

    if (
      faqs.length === 0 &&
      searchWords.length > 0
    ) {
      return this.retrieveFaqs("");
    }

    return faqs.map(
      (faq): AssistantContextFaq => ({
        id: faq.id,
        question: faq.question,
        answer: faq.answer,
        category: faq.category,
      }),
    );
  }

  private async retrieveExperience(): Promise<AssistantContextExperience | null> {
    const experiencePage =
      await this.prisma.experiencePage.findFirst({
        where: {
          isPublished: true,
        },
        orderBy: {
          updatedAt: "desc",
        },
        select: {
          heroTitle: true,
          heroSubtitle: true,
          heroDescription: true,
          storyTitle: true,
          storyDescription: true,
        },
      });

    if (!experiencePage) {
      return null;
    }

    return {
      heroTitle:
        experiencePage.heroTitle,
      heroSubtitle:
        experiencePage.heroSubtitle,
      heroDescription:
        experiencePage.heroDescription,
      storyTitle:
        experiencePage.storyTitle,
      storyDescription:
        experiencePage.storyDescription,
    };
  }

  private extractSearchWords(
    normalizedMessage: string,
  ): string[] {
    if (!normalizedMessage) {
      return [];
    }

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
      "show",
      "tell",
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
        normalizedMessage
          .split(" ")
          .filter(
            (word) =>
              word.length >= 3 &&
              !ignoredWords.has(word),
          ),
      ),
    ].slice(0, 8);
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