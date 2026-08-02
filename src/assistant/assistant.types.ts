export type AssistantIntent =
  | "EVENTS"
  | "TICKETS"
  | "VENUE"
  | "FAQ"
  | "CONTACT"
  | "EXPERIENCE"
  | "GENERAL"
  | "UNKNOWN";

export type AssistantHandler =
  | "RULE_BASED"
  | "HUMAN_FALLBACK";

export type AssistantSourceType =
  | "EVENT"
  | "TICKET"
  | "FAQ"
  | "SETTINGS"
  | "EXPERIENCE";

export type AssistantSource = {
  type: AssistantSourceType;
  id?: number;
  label: string;
  url?: string;
};
export type AssistantProviderResult = {
  answer: string;
  handledBy: AssistantHandler;
  intent: AssistantIntent;
  confidence: number;
  requiresHumanFollowUp: boolean;
  suggestions: string[];
  sources: AssistantSource[];
};

export type AssistantResult =
  AssistantProviderResult & {
    conversationId: string;
  };

export type AssistantContextEvent = {
  id: number;
  title: string;
  slug: string;
  description: string;
  date: string;
  location: string;
  status: string;
};

export type AssistantContextTicket = {
  id: number;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  price: number;
  originalPrice: number | null;
  currency: string;
  status: string;
  availabilityLabel: string | null;
  remainingQuantity: number | null;
  externalPurchaseUrl: string | null;
  benefits: string[];
};

export type AssistantContextFaq = {
  id: number;
  question: string;
  answer: string;
  category: string | null;
};

export type AssistantContextSettings = {
  festivalName: string;
  location: string | null;
  venue: string | null;
  address: string | null;
  publicEmail: string | null;
  supportEmail: string | null;
  phoneNumber: string | null;
  whatsappNumber: string | null;
  googleMapsUrl: string | null;
};

export type AssistantContextExperience = {
  heroTitle: string;
  heroSubtitle: string | null;
  heroDescription: string | null;
  storyTitle: string;
  storyDescription: string;
};

export type RetrievedAssistantContext = {
  events: AssistantContextEvent[];
  tickets: AssistantContextTicket[];
  faqs: AssistantContextFaq[];
  settings: AssistantContextSettings | null;
  experience: AssistantContextExperience | null;
};