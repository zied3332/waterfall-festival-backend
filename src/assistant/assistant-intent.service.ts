import { Injectable } from "@nestjs/common";

import type {
  AssistantIntent,
} from "./assistant.types.js";

type IntentRule = {
  intent: AssistantIntent;
  keywords: string[];
  phrases?: string[];
};

const INTENT_RULES: IntentRule[] = [
  {
    intent: "TICKETS",
    keywords: [
      "ticket",
      "tickets",
      "price",
      "prices",
      "cost",
      "buy",
      "purchase",
      "pass",
      "passes",
      "vip",
      "group",
      "sold",
      "available",
      "availability",
    ],
    phrases: [
      "how much",
      "where can i buy",
      "which ticket",
      "buy a ticket",
      "ticket price",
      "sold out",
    ],
  },
  {
    intent: "EVENTS",
    keywords: [
      "event",
      "events",
      "date",
      "dates",
      "schedule",
      "calendar",
      "upcoming",
      "next",
      "time",
      "start",
      "starts",
      "edition",
    ],
    phrases: [
      "next event",
      "upcoming event",
      "when is",
      "what date",
      "event schedule",
    ],
  },
  {
    intent: "VENUE",
    keywords: [
      "venue",
      "location",
      "address",
      "map",
      "directions",
      "parking",
      "park",
      "transport",
      "taxi",
      "drive",
      "entrance",
      "stage",
      "toilet",
      "bathroom",
      "first aid",
    ],
    phrases: [
      "how do i get",
      "where is",
      "google maps",
      "parking available",
      "festival map",
    ],
  },
  {
    intent: "CONTACT",
    keywords: [
      "contact",
      "email",
      "phone",
      "whatsapp",
      "call",
      "support",
      "help",
      "team",
      "staff",
      "message",
    ],
    phrases: [
      "contact the team",
      "how can i contact",
      "send a message",
      "customer support",
    ],
  },
  {
    intent: "EXPERIENCE",
    keywords: [
      "experience",
      "music",
      "dj",
      "djs",
      "fire",
      "waterfall",
      "jungle",
      "food",
      "drinks",
      "atmosphere",
      "stage",
      "performance",
      "festival",
    ],
    phrases: [
      "what is it like",
      "festival experience",
      "what can i expect",
      "what happens there",
    ],
  },
  {
    intent: "FAQ",
    keywords: [
      "bring",
      "allowed",
      "prohibited",
      "rule",
      "rules",
      "policy",
      "id",
      "age",
      "entry",
      "refund",
      "transfer",
      "security",
      "safety",
      "outside",
      "alcohol",
      "weather",
    ],
    phrases: [
      "what should i bring",
      "can i bring",
      "am i allowed",
      "is it allowed",
      "what is prohibited",
    ],
  },
];

@Injectable()
export class AssistantIntentService {
  detectIntent(message: string): AssistantIntent {
    const normalizedMessage =
      this.normalizeText(message);

    if (!normalizedMessage) {
      return "UNKNOWN";
    }

    const scores = new Map<
      AssistantIntent,
      number
    >();

    for (const rule of INTENT_RULES) {
      let score = 0;

      for (const phrase of rule.phrases ?? []) {
        if (
          normalizedMessage.includes(
            this.normalizeText(phrase),
          )
        ) {
          score += 3;
        }
      }

      const messageWords = new Set(
        normalizedMessage.split(" "),
      );

      for (const keyword of rule.keywords) {
        const normalizedKeyword =
          this.normalizeText(keyword);

        if (
          normalizedKeyword.includes(" ")
        ) {
          if (
            normalizedMessage.includes(
              normalizedKeyword,
            )
          ) {
            score += 2;
          }

          continue;
        }

        if (
          messageWords.has(
            normalizedKeyword,
          )
        ) {
          score += 1;
        }
      }

      scores.set(rule.intent, score);
    }

    const rankedIntents = [...scores.entries()]
      .filter(([, score]) => score > 0)
      .sort(
        (
          firstIntent,
          secondIntent,
        ) =>
          secondIntent[1] -
          firstIntent[1],
      );

    if (rankedIntents.length === 0) {
      return this.detectGeneralIntent(
        normalizedMessage,
      );
    }

    const [bestIntent, bestScore] =
      rankedIntents[0];

    const secondBestScore =
      rankedIntents[1]?.[1] ?? 0;

    if (
      bestScore === secondBestScore &&
      bestScore <= 1
    ) {
      return "GENERAL";
    }

    return bestIntent;
  }

  private detectGeneralIntent(
    normalizedMessage: string,
  ): AssistantIntent {
    const generalGreetings = [
      "hello",
      "hi",
      "hey",
      "good morning",
      "good afternoon",
      "good evening",
      "what can you do",
      "how can you help",
      "help me",
      "tell me about the festival",
    ];

    const isGeneralMessage =
      generalGreetings.some((phrase) =>
        normalizedMessage.includes(
          phrase,
        ),
      );

    return isGeneralMessage
      ? "GENERAL"
      : "UNKNOWN";
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