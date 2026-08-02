import { Injectable } from "@nestjs/common";

import type {
  AssistantContextEvent,
  AssistantContextExperience,
  AssistantContextFaq,
  AssistantContextSettings,
  AssistantContextTicket,
} from "./assistant.types.js";

export type BuiltAssistantResponse = {
  answer: string;
  confidence: number;
};

type EventResponseOptions = {
  isExactMatch?: boolean;
};

const EVENT_DATE_FORMATTER =
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

@Injectable()
export class AssistantResponseBuilder {
  buildEventResponse(
    event: AssistantContextEvent,
    options: EventResponseOptions = {},
  ): BuiltAssistantResponse {
    const formattedDate = this.formatDate(
      event.date,
    );

    const description = this.cleanText(
      event.description,
    );

    const answerParts = [
      options.isExactMatch
        ? `${event.title} is scheduled for ${formattedDate} at ${event.location}.`
        : `The next available event is ${event.title}. It is scheduled for ${formattedDate} at ${event.location}.`,
    ];

    if (description) {
      answerParts.push(description);
    }

    return {
      answer: answerParts.join(" "),
      confidence:
        options.isExactMatch === true
          ? 0.97
          : 0.92,
    };
  }

  buildTicketResponse(
    ticket: AssistantContextTicket,
  ): BuiltAssistantResponse {
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
      const savings =
        ticket.originalPrice - ticket.price;

      answerParts.push(
        `The original price was ${this.formatPrice(
          ticket.originalPrice,
          ticket.currency,
        )}, which means you save ${this.formatPrice(
          savings,
          ticket.currency,
        )}.`,
      );
    }

    const description =
      this.cleanOptionalText(
        ticket.shortDescription,
      ) ??
      this.cleanOptionalText(
        ticket.description,
      );

    if (description) {
      answerParts.push(description);
    }

    const benefits = ticket.benefits
      .map((benefit) =>
        this.cleanText(benefit),
      )
      .filter(Boolean)
      .slice(0, 4);

    if (benefits.length > 0) {
      answerParts.push(
        `The included benefits are ${this.joinNaturalLanguage(
          benefits,
        )}.`,
      );
    }

    const availabilityMessage =
      this.buildTicketAvailabilityMessage(
        ticket,
      );

    if (availabilityMessage) {
      answerParts.push(
        availabilityMessage,
      );
    }

    if (ticket.externalPurchaseUrl) {
      answerParts.push(
        "You can continue through the official ticket link when you are ready to purchase.",
      );
    }

    return {
      answer: answerParts.join(" "),
      confidence: 0.97,
    };
  }

  buildTicketListResponse(
    tickets: AssistantContextTicket[],
  ): BuiltAssistantResponse {
    const ticketsToDisplay = tickets.slice(
      0,
      3,
    );

    if (ticketsToDisplay.length === 0) {
      return {
        answer:
          "There are no public ticket options available to display right now.",
        confidence: 0.65,
      };
    }

    const ticketDescriptions =
      ticketsToDisplay.map((ticket) => {
        const price = this.formatPrice(
          ticket.price,
          ticket.currency,
        );

        const availability =
          this.buildShortAvailabilityLabel(
            ticket,
          );

        return availability
          ? `${ticket.name} for ${price} (${availability})`
          : `${ticket.name} for ${price}`;
      });

    return {
      answer:
        `The currently listed ticket options include ${this.joinNaturalLanguage(
          ticketDescriptions,
        )}. ` +
        "You can compare their benefits, availability, and purchase conditions on the Tickets page.",
      confidence: 0.88,
    };
  }

  buildVenueResponse(
    settings: AssistantContextSettings,
  ): BuiltAssistantResponse {
    const venue =
      this.cleanOptionalText(settings.venue);

    const location =
      this.cleanOptionalText(
        settings.location,
      );

    const address =
      this.cleanOptionalText(
        settings.address,
      );

    const displayedLocation =
      address ??
      this.joinNonEmptyValues(
        [venue, location],
        ", ",
      );

    if (!displayedLocation) {
      return {
        answer:
          "The exact festival venue information is not available right now. Please check the Venue page or contact the festival team.",
        confidence: 0.65,
      };
    }

    const answerParts = [
      `${settings.festivalName} is located at ${displayedLocation}.`,
    ];

    if (settings.googleMapsUrl) {
      answerParts.push(
        "An official Google Maps link is available on the Venue page for directions.",
      );
    }

    return {
      answer: answerParts.join(" "),
      confidence: 0.96,
    };
  }

  buildContactResponse(
    settings: AssistantContextSettings,
  ): BuiltAssistantResponse {
    const email =
      this.cleanOptionalText(
        settings.supportEmail,
      ) ??
      this.cleanOptionalText(
        settings.publicEmail,
      );

    const phone = this.cleanOptionalText(
      settings.phoneNumber,
    );

    const whatsapp =
      this.cleanOptionalText(
        settings.whatsappNumber,
      );

    const contactMethods: string[] = [];

    if (email) {
      contactMethods.push(
        `email at ${email}`,
      );
    }

    if (phone) {
      contactMethods.push(
        `phone at ${phone}`,
      );
    }

    if (whatsapp) {
      contactMethods.push(
        `WhatsApp at ${whatsapp}`,
      );
    }

    if (contactMethods.length === 0) {
      return {
        answer:
          "Please use the Contact page to send your question to the festival team.",
        confidence: 0.9,
      };
    }

    return {
      answer:
        `You can contact the ${settings.festivalName} team by ${this.joinNaturalLanguage(
          contactMethods,
          "or",
        )}. ` +
        "You can also send a message through the Contact page.",
      confidence: 0.98,
    };
  }

  buildFaqResponse(
    faq: AssistantContextFaq,
  ): BuiltAssistantResponse {
    return {
      answer: this.cleanText(faq.answer),
      confidence: 0.93,
    };
  }

  buildExperienceResponse(
    experience: AssistantContextExperience,
  ): BuiltAssistantResponse {
    const answerParts: string[] = [];

    const heroTitle = this.cleanText(
      experience.heroTitle,
    );

    const heroSubtitle =
      this.cleanOptionalText(
        experience.heroSubtitle,
      );

    const heroDescription =
      this.cleanOptionalText(
        experience.heroDescription,
      );

    const storyDescription =
      this.cleanText(
        experience.storyDescription,
      );

    if (heroTitle) {
      answerParts.push(heroTitle);
    }

    if (heroSubtitle) {
      answerParts.push(heroSubtitle);
    }

    if (heroDescription) {
      answerParts.push(heroDescription);
    } else if (storyDescription) {
      answerParts.push(storyDescription);
    }

    return {
      answer: answerParts.join(" "),
      confidence: 0.93,
    };
  }

  buildGeneralResponse(
    settings: AssistantContextSettings | null,
  ): BuiltAssistantResponse {
    const festivalName =
      settings?.festivalName?.trim() ||
      "Waterfall Festival";

    return {
      answer:
        `I can help you with ${festivalName} events, tickets, venue information, frequently asked questions, contact details, and the festival experience. ` +
        "Ask me what you would like to know.",
      confidence: 0.75,
    };
  }

  private buildTicketAvailabilityMessage(
    ticket: AssistantContextTicket,
  ): string | null {
    const availabilityLabel =
      this.cleanOptionalText(
        ticket.availabilityLabel,
      );

    if (availabilityLabel) {
      return availabilityLabel.endsWith(".")
        ? availabilityLabel
        : `${availabilityLabel}.`;
    }

    if (
      ticket.status === "SOLD_OUT" ||
      ticket.remainingQuantity === 0
    ) {
      return "This ticket is currently sold out.";
    }

    if (
      ticket.remainingQuantity !== null
    ) {
      if (
        ticket.remainingQuantity === 1
      ) {
        return "There is currently 1 ticket recorded as remaining.";
      }

      return `There are currently ${ticket.remainingQuantity} tickets recorded as remaining.`;
    }

    switch (ticket.status) {
      case "AVAILABLE":
        return "This ticket is currently available.";

      case "LIMITED":
        return "Availability is currently limited.";

      case "SCHEDULED":
        return "This ticket is scheduled to become available.";

      case "EXPIRED":
        return "This ticket is no longer available.";

      default:
        return null;
    }
  }

  private buildShortAvailabilityLabel(
    ticket: AssistantContextTicket,
  ): string | null {
    const availabilityLabel =
      this.cleanOptionalText(
        ticket.availabilityLabel,
      );

    if (availabilityLabel) {
      return availabilityLabel;
    }

    if (
      ticket.status === "SOLD_OUT" ||
      ticket.remainingQuantity === 0
    ) {
      return "sold out";
    }

    if (
      ticket.remainingQuantity !== null
    ) {
      return `${ticket.remainingQuantity} remaining`;
    }

    switch (ticket.status) {
      case "AVAILABLE":
        return "available";

      case "LIMITED":
        return "limited availability";

      case "SCHEDULED":
        return "coming soon";

      default:
        return null;
    }
  }

  private formatDate(
    value: string,
  ): string {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return EVENT_DATE_FORMATTER.format(
      date,
    );
  }

  private formatPrice(
    price: number,
    currency: string,
  ): string {
    try {
      return new Intl.NumberFormat(
        "en-US",
        {
          style: "currency",
          currency,
          maximumFractionDigits: 2,
        },
      ).format(price);
    } catch {
      return `${price} ${currency}`;
    }
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

  private joinNonEmptyValues(
    values: Array<string | null | undefined>,
    separator: string,
  ): string {
    return values
      .map((value) =>
        this.cleanOptionalText(value),
      )
      .filter(
        (value): value is string =>
          value !== null,
      )
      .join(separator);
  }

  private joinNaturalLanguage(
    values: string[],
    conjunction = "and",
  ): string {
    if (values.length === 0) {
      return "";
    }

    if (values.length === 1) {
      return values[0];
    }

    if (values.length === 2) {
      return `${values[0]} ${conjunction} ${values[1]}`;
    }

    return `${values
      .slice(0, -1)
      .join(", ")}, ${conjunction} ${
      values.at(-1) ?? ""
    }`;
  }
}