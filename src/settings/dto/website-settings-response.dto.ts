import {
  ApiProperty,
  ApiPropertyOptional,
} from "@nestjs/swagger";

import { FestivalStatus } from "../../generated/prisma/enums.js";

export class WebsiteSettingsResponseDto {
  @ApiProperty({
    example: 1,
  })
  id!: number;

  @ApiProperty({
    example: "Waterfall Festival Koh Phangan",
  })
  festivalName!: string;

  @ApiProperty({
    example: "Nature. Music. Freedom.",
  })
  tagline!: string;

  @ApiProperty({
    example: "Koh Phangan, Thailand",
  })
  location!: string;

  @ApiProperty({
    example: "Waterfall Party Venue",
  })
  venue!: string;

  @ApiPropertyOptional({
    example: "2026-12-28T00:00:00.000Z",
    nullable: true,
    format: "date-time",
  })
  startDate!: Date | null;

  @ApiPropertyOptional({
    example: "2027-01-02T00:00:00.000Z",
    nullable: true,
    format: "date-time",
  })
  endDate!: Date | null;

  @ApiProperty({
    example: "Asia/Bangkok",
  })
  timezone!: string;

  @ApiProperty({
    enum: FestivalStatus,
    enumName: "FestivalStatus",
    example: FestivalStatus.UPCOMING,
  })
  festivalStatus!: FestivalStatus;

  @ApiProperty({
    example: "English",
  })
  defaultLanguage!: string;

  @ApiProperty({
    example:
      "https://www.waterfallfestival.com",
  })
  websiteUrl!: string;

  @ApiProperty({
    example: "info@waterfallfestival.com",
  })
  publicEmail!: string;

  @ApiProperty({
    example: "support@waterfallfestival.com",
  })
  supportEmail!: string;

  @ApiProperty({
    example: "+66 000 000 000",
  })
  phoneNumber!: string;

  @ApiProperty({
    example: "+66 000 000 000",
  })
  whatsappNumber!: string;

  @ApiProperty({
    example:
      "Waterfall Party, Koh Phangan, Thailand",
  })
  address!: string;

  @ApiProperty({
    example:
      "https://maps.google.com/example",
  })
  googleMapsUrl!: string;

  @ApiProperty({
    example: true,
  })
  contactFormEnabled!: boolean;

  @ApiProperty({
    example:
      "https://instagram.com/waterfallfestival",
  })
  instagramUrl!: string;

  @ApiProperty({
    example:
      "https://facebook.com/waterfallfestival",
  })
  facebookUrl!: string;

  @ApiProperty({
    example:
      "https://tiktok.com/@waterfallfestival",
  })
  tiktokUrl!: string;

  @ApiProperty({
    example:
      "https://youtube.com/@waterfallfestival",
  })
  youtubeUrl!: string;

  @ApiProperty({
    example:
      "https://open.spotify.com/artist/example",
  })
  spotifyUrl!: string;

  @ApiProperty({
    example: true,
  })
  showSocialLinksInFooter!: boolean;

  @ApiProperty({
    example: true,
  })
  assistantEnabled!: boolean;

  @ApiProperty({
    example: "Guardian Assistant",
  })
  assistantName!: string;

  @ApiProperty({
    example:
      "Hi! Ask me about tickets, events, the venue, or festival information.",
  })
  assistantWelcomeMessage!: string;

  @ApiProperty({
    example: "Ask about the festival...",
  })
  assistantPlaceholder!: string;

  @ApiProperty({
    example:
      "The assistant is temporarily unavailable.",
  })
  assistantOfflineMessage!: string;

  @ApiProperty({
    example: "support@waterfallfestival.com",
  })
  escalationEmail!: string;

  @ApiProperty({ example: true })
  eventsPageEnabled!: boolean;

  @ApiProperty({ example: true })
  ticketsPageEnabled!: boolean;

  @ApiProperty({ example: true })
  experiencePageEnabled!: boolean;

  @ApiProperty({ example: true })
  galleryPageEnabled!: boolean;

  @ApiProperty({ example: true })
  faqPageEnabled!: boolean;

  @ApiProperty({ example: false })
  newsletterEnabled!: boolean;

  @ApiProperty({
    example: "#7c3aed",
  })
  primaryAccent!: string;

  @ApiProperty({
    example: "#22d3ee",
  })
  secondaryAccent!: string;

  @ApiProperty({
    example: "/logo.png",
  })
  logoUrl!: string;

  @ApiProperty({
    example: "/logo-mark.png",
  })
  compactLogoUrl!: string;

  @ApiProperty({
    example: "/favicon.ico",
  })
  faviconUrl!: string;

  @ApiProperty({
    example: "/social-share.jpg",
  })
  socialImageUrl!: string;

  @ApiProperty({
    example:
      "Experience Thailand's most unforgettable music festival in the heart of Koh Phangan.",
  })
  footerDescription!: string;

  @ApiProperty({
    example:
      "© Waterfall Festival. All rights reserved.",
  })
  footerCopyright!: string;

  @ApiProperty({
    example: "2026-07-31T08:00:00.000Z",
    format: "date-time",
  })
  createdAt!: Date;

  @ApiProperty({
    example: "2026-07-31T08:30:00.000Z",
    format: "date-time",
  })
  updatedAt!: Date;
}