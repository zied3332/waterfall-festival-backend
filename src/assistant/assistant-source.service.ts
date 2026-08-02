import { Injectable } from "@nestjs/common";

import type {
  AssistantContextEvent,
  AssistantContextExperience,
  AssistantContextFaq,
  AssistantContextSettings,
  AssistantContextTicket,
  AssistantSource,
} from "./assistant.types.js";

@Injectable()
export class AssistantSourceService {
  buildEventSource(
    event: AssistantContextEvent,
  ): AssistantSource {
    return {
      type: "EVENT",
      id: event.id,
      label: event.title,
      url: `/events/${event.slug}`,
    };
  }

  buildEventSources(
    events: AssistantContextEvent[],
  ): AssistantSource[] {
    return this.removeDuplicateSources(
      events.map((event) =>
        this.buildEventSource(event),
      ),
    );
  }

  buildTicketSource(
    ticket: AssistantContextTicket,
  ): AssistantSource {
    return {
      type: "TICKET",
      id: ticket.id,
      label: ticket.name,
      url:
        this.cleanOptionalText(
          ticket.externalPurchaseUrl,
        ) ?? `/tickets#${ticket.slug}`,
    };
  }

  buildTicketSources(
    tickets: AssistantContextTicket[],
  ): AssistantSource[] {
    return this.removeDuplicateSources(
      tickets.map((ticket) =>
        this.buildTicketSource(ticket),
      ),
    );
  }

  buildFaqSource(
    faq: AssistantContextFaq,
  ): AssistantSource {
    return {
      type: "FAQ",
      id: faq.id,
      label: faq.question,
      url: `/faq#faq-${faq.id}`,
    };
  }

  buildFaqSources(
    faqs: AssistantContextFaq[],
  ): AssistantSource[] {
    return this.removeDuplicateSources(
      faqs.map((faq) =>
        this.buildFaqSource(faq),
      ),
    );
  }

  buildVenueSource(
    settings: AssistantContextSettings,
  ): AssistantSource {
    const festivalName =
      this.cleanText(
        settings.festivalName,
      ) || "Waterfall Festival";

    return {
      type: "SETTINGS",
      label: `${festivalName} venue`,
      url:
        this.cleanOptionalText(
          settings.googleMapsUrl,
        ) ?? "/venue",
    };
  }

  buildContactSource(
    settings: AssistantContextSettings,
  ): AssistantSource {
    const festivalName =
      this.cleanText(
        settings.festivalName,
      ) || "Waterfall Festival";

    return {
      type: "SETTINGS",
      label: `${festivalName} contact information`,
      url: "/contact",
    };
  }

  buildSettingsSource(
    settings: AssistantContextSettings,
  ): AssistantSource {
    const festivalName =
      this.cleanText(
        settings.festivalName,
      ) || "Waterfall Festival";

    return {
      type: "SETTINGS",
      label: festivalName,
      url: "/",
    };
  }

  buildExperienceSource(
    experience: AssistantContextExperience,
  ): AssistantSource {
    const label =
      this.cleanText(
        experience.storyTitle,
      ) ||
      this.cleanText(
        experience.heroTitle,
      ) ||
      "Festival experience";

    return {
      type: "EXPERIENCE",
      label,
      url: "/experience",
    };
  }

  buildFallbackSources(): AssistantSource[] {
    return [];
  }

  limitSources(
    sources: AssistantSource[],
    limit = 3,
  ): AssistantSource[] {
    const safeLimit = Math.max(
      0,
      Math.floor(limit),
    );

    return this.removeDuplicateSources(
      sources,
    ).slice(0, safeLimit);
  }

  private removeDuplicateSources(
    sources: AssistantSource[],
  ): AssistantSource[] {
    const uniqueSources =
      new Map<string, AssistantSource>();

    for (const source of sources) {
      const normalizedSource =
        this.normalizeSource(source);

      const key = [
        normalizedSource.type,
        normalizedSource.id ?? "",
        normalizedSource.url ?? "",
        normalizedSource.label,
      ].join(":");

      if (!uniqueSources.has(key)) {
        uniqueSources.set(
          key,
          normalizedSource,
        );
      }
    }

    return [...uniqueSources.values()];
  }

  private normalizeSource(
    source: AssistantSource,
  ): AssistantSource {
    const label =
      this.cleanText(source.label);

    const url =
      this.cleanOptionalText(source.url);

    return {
      type: source.type,
      ...(source.id !== undefined && {
        id: source.id,
      }),
      label,
      ...(url && {
        url,
      }),
    };
  }

  private cleanText(
    value: string,
  ): string {
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