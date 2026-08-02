import { Injectable } from "@nestjs/common";

import type {
  AssistantContextEvent,
  AssistantContextExperience,
  AssistantContextFaq,
  AssistantContextSettings,
  AssistantContextTicket,
  AssistantIntent,
  RetrievedAssistantContext,
} from "./assistant.types.js";

import { AssistantRetrievalService } from "./assistant-retrieval.service.js";

const MAX_EVENTS = 5;
const MAX_TICKETS = 8;
const MAX_FAQS = 8;
const MAX_TICKET_BENEFITS = 6;

@Injectable()
export class AssistantContextService {
  constructor(
    private readonly retrievalService:
      AssistantRetrievalService,
  ) {}

  async buildContext(
    intent: AssistantIntent,
    message: string,
  ): Promise<RetrievedAssistantContext> {
    const retrievedContext =
      await this.retrievalService.retrieveContext(
        intent,
        message,
      );

    return {
      events: this.prepareEvents(
        retrievedContext.events,
      ),
      tickets: this.prepareTickets(
        retrievedContext.tickets,
      ),
      faqs: this.prepareFaqs(
        retrievedContext.faqs,
      ),
      settings: this.prepareSettings(
        retrievedContext.settings,
      ),
      experience: this.prepareExperience(
        retrievedContext.experience,
      ),
    };
  }

  hasRelevantContext(
    intent: AssistantIntent,
    context: RetrievedAssistantContext,
  ): boolean {
    switch (intent) {
      case "EVENTS":
        return context.events.length > 0;

      case "TICKETS":
        return context.tickets.length > 0;

      case "FAQ":
        return context.faqs.length > 0;

      case "VENUE":
      case "CONTACT":
        return context.settings !== null;

      case "EXPERIENCE":
        return context.experience !== null;

      case "GENERAL":
        return this.hasAnyContext(context);

      case "UNKNOWN":
      default:
        return false;
    }
  }

  hasAnyContext(
    context: RetrievedAssistantContext,
  ): boolean {
    return (
      context.events.length > 0 ||
      context.tickets.length > 0 ||
      context.faqs.length > 0 ||
      context.settings !== null ||
      context.experience !== null
    );
  }

  private prepareEvents(
    events: AssistantContextEvent[],
  ): AssistantContextEvent[] {
    return events
      .slice(0, MAX_EVENTS)
      .map((event) => ({
        id: event.id,
        title: this.cleanText(event.title),
        slug: event.slug,
        description: this.cleanText(
          event.description,
        ),
        date: event.date,
        location: this.cleanText(
          event.location,
        ),
        status: event.status,
      }));
  }

  private prepareTickets(
    tickets: AssistantContextTicket[],
  ): AssistantContextTicket[] {
    return tickets
      .slice(0, MAX_TICKETS)
      .map((ticket) => ({
        id: ticket.id,
        name: this.cleanText(ticket.name),
        slug: ticket.slug,
        shortDescription:
          this.cleanOptionalText(
            ticket.shortDescription,
          ),
        description:
          this.cleanOptionalText(
            ticket.description,
          ),
        price: ticket.price,
        originalPrice:
          ticket.originalPrice,
        currency: ticket.currency
          .trim()
          .toUpperCase(),
        status: ticket.status,
        availabilityLabel:
          this.cleanOptionalText(
            ticket.availabilityLabel,
          ),
        remainingQuantity:
          ticket.remainingQuantity,
        externalPurchaseUrl:
          this.cleanOptionalText(
            ticket.externalPurchaseUrl,
          ),
        benefits: ticket.benefits
          .map((benefit) =>
            this.cleanText(benefit),
          )
          .filter(Boolean)
          .slice(0, MAX_TICKET_BENEFITS),
      }));
  }

  private prepareFaqs(
    faqs: AssistantContextFaq[],
  ): AssistantContextFaq[] {
    return faqs
      .slice(0, MAX_FAQS)
      .map((faq) => ({
        id: faq.id,
        question: this.cleanText(
          faq.question,
        ),
        answer: this.cleanText(faq.answer),
        category:
          this.cleanOptionalText(
            faq.category,
          ),
      }));
  }

  private prepareSettings(
    settings: AssistantContextSettings | null,
  ): AssistantContextSettings | null {
    if (!settings) {
      return null;
    }

    return {
      festivalName:
        this.cleanText(
          settings.festivalName,
        ) || "Waterfall Festival",
      location:
        this.cleanOptionalText(
          settings.location,
        ),
      venue:
        this.cleanOptionalText(
          settings.venue,
        ),
      address:
        this.cleanOptionalText(
          settings.address,
        ),
      publicEmail:
        this.cleanOptionalText(
          settings.publicEmail,
        ),
      supportEmail:
        this.cleanOptionalText(
          settings.supportEmail,
        ),
      phoneNumber:
        this.cleanOptionalText(
          settings.phoneNumber,
        ),
      whatsappNumber:
        this.cleanOptionalText(
          settings.whatsappNumber,
        ),
      googleMapsUrl:
        this.cleanOptionalText(
          settings.googleMapsUrl,
        ),
    };
  }

  private prepareExperience(
    experience:
      | AssistantContextExperience
      | null,
  ): AssistantContextExperience | null {
    if (!experience) {
      return null;
    }

    return {
      heroTitle: this.cleanText(
        experience.heroTitle,
      ),
      heroSubtitle:
        this.cleanOptionalText(
          experience.heroSubtitle,
        ),
      heroDescription:
        this.cleanOptionalText(
          experience.heroDescription,
        ),
      storyTitle: this.cleanText(
        experience.storyTitle,
      ),
      storyDescription: this.cleanText(
        experience.storyDescription,
      ),
    };
  }

  private cleanText(value: string): string {
    return value
      .replace(/\s+/g, " ")
      .trim();
  }

  private cleanOptionalText(
    value: string | null | undefined,
  ): string | null {
    if (!value) {
      return null;
    }

    const cleanedValue =
      this.cleanText(value);

    return cleanedValue || null;
  }
}