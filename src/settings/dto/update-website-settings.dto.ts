import {
  ApiPropertyOptional,
} from "@nestjs/swagger";
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from "class-validator";

import { FestivalStatus } from "../../generated/prisma/enums.js";

const URL_OR_PATH_PATTERN =
  /^(https?:\/\/[^\s]+|\/[^\s]*)$/;

const HEX_COLOR_PATTERN =
  /^#[0-9A-Fa-f]{6}$/;

export class UpdateWebsiteSettingsDto {
  @ApiPropertyOptional({
    example: "Waterfall Festival Koh Phangan",
    maxLength: 150,
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  festivalName?: string;

  @ApiPropertyOptional({
    example: "Nature. Music. Freedom.",
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  tagline?: string;

  @ApiPropertyOptional({
    example: "Koh Phangan, Thailand",
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @ApiPropertyOptional({
    example: "Waterfall Party Venue",
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  venue?: string;

  @ApiPropertyOptional({
    example: "2026-12-28",
    description:
      "Festival start date in ISO 8601 format.",
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: "2027-01-02",
    description:
      "Festival end date in ISO 8601 format.",
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    example: "Asia/Bangkok",
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;

  @ApiPropertyOptional({
    enum: FestivalStatus,
    enumName: "FestivalStatus",
    example: FestivalStatus.UPCOMING,
  })
  @IsOptional()
  @IsEnum(FestivalStatus)
  festivalStatus?: FestivalStatus;

  @ApiPropertyOptional({
    example: "English",
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  defaultLanguage?: string;

  @ApiPropertyOptional({
    example: "https://www.waterfallfestival.com",
  })
  @IsOptional()
  @IsString()
  @ValidateIf(
    (_object, value: unknown) =>
      value !== undefined && value !== "",
  )
  @Matches(URL_OR_PATH_PATTERN, {
    message:
      "websiteUrl must be a valid HTTP URL or absolute path.",
  })
  websiteUrl?: string;

  @ApiPropertyOptional({
    example: "info@waterfallfestival.com",
  })
  @IsOptional()
  @IsString()
  @ValidateIf(
    (_object, value: unknown) =>
      value !== undefined && value !== "",
  )
  @IsEmail()
  publicEmail?: string;

  @ApiPropertyOptional({
    example: "support@waterfallfestival.com",
  })
  @IsOptional()
  @IsString()
  @ValidateIf(
    (_object, value: unknown) =>
      value !== undefined && value !== "",
  )
  @IsEmail()
  supportEmail?: string;

  @ApiPropertyOptional({
    example: "+66 000 000 000",
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phoneNumber?: string;

  @ApiPropertyOptional({
    example: "+66 000 000 000",
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  whatsappNumber?: string;

  @ApiPropertyOptional({
    example:
      "Waterfall Party, Koh Phangan, Thailand",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({
    example:
      "https://maps.google.com/example",
  })
  @IsOptional()
  @IsString()
  @ValidateIf(
    (_object, value: unknown) =>
      value !== undefined && value !== "",
  )
  @Matches(URL_OR_PATH_PATTERN, {
    message:
      "googleMapsUrl must be a valid HTTP URL or absolute path.",
  })
  googleMapsUrl?: string;

  @ApiPropertyOptional({
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  contactFormEnabled?: boolean;

  @ApiPropertyOptional({
    example:
      "https://instagram.com/waterfallfestival",
  })
  @IsOptional()
  @IsString()
  @ValidateIf(
    (_object, value: unknown) =>
      value !== undefined && value !== "",
  )
  @Matches(URL_OR_PATH_PATTERN, {
    message:
      "instagramUrl must be a valid HTTP URL or absolute path.",
  })
  instagramUrl?: string;

  @ApiPropertyOptional({
    example:
      "https://facebook.com/waterfallfestival",
  })
  @IsOptional()
  @IsString()
  @ValidateIf(
    (_object, value: unknown) =>
      value !== undefined && value !== "",
  )
  @Matches(URL_OR_PATH_PATTERN, {
    message:
      "facebookUrl must be a valid HTTP URL or absolute path.",
  })
  facebookUrl?: string;

  @ApiPropertyOptional({
    example:
      "https://tiktok.com/@waterfallfestival",
  })
  @IsOptional()
  @IsString()
  @ValidateIf(
    (_object, value: unknown) =>
      value !== undefined && value !== "",
  )
  @Matches(URL_OR_PATH_PATTERN, {
    message:
      "tiktokUrl must be a valid HTTP URL or absolute path.",
  })
  tiktokUrl?: string;

  @ApiPropertyOptional({
    example:
      "https://youtube.com/@waterfallfestival",
  })
  @IsOptional()
  @IsString()
  @ValidateIf(
    (_object, value: unknown) =>
      value !== undefined && value !== "",
  )
  @Matches(URL_OR_PATH_PATTERN, {
    message:
      "youtubeUrl must be a valid HTTP URL or absolute path.",
  })
  youtubeUrl?: string;

  @ApiPropertyOptional({
    example:
      "https://open.spotify.com/artist/example",
  })
  @IsOptional()
  @IsString()
  @ValidateIf(
    (_object, value: unknown) =>
      value !== undefined && value !== "",
  )
  @Matches(URL_OR_PATH_PATTERN, {
    message:
      "spotifyUrl must be a valid HTTP URL or absolute path.",
  })
  spotifyUrl?: string;

  @ApiPropertyOptional({
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  showSocialLinksInFooter?: boolean;

  @ApiPropertyOptional({
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  assistantEnabled?: boolean;

  @ApiPropertyOptional({
    example: "Guardian Assistant",
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  assistantName?: string;

  @ApiPropertyOptional({
    example:
      "Hi! Ask me about tickets, events, the venue, or festival information.",
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  assistantWelcomeMessage?: string;

  @ApiPropertyOptional({
    example: "Ask about the festival...",
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  assistantPlaceholder?: string;

  @ApiPropertyOptional({
    example:
      "The assistant is temporarily unavailable.",
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  assistantOfflineMessage?: string;

  @ApiPropertyOptional({
    example: "support@waterfallfestival.com",
  })
  @IsOptional()
  @IsString()
  @ValidateIf(
    (_object, value: unknown) =>
      value !== undefined && value !== "",
  )
  @IsEmail()
  escalationEmail?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  eventsPageEnabled?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  ticketsPageEnabled?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  experiencePageEnabled?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  galleryPageEnabled?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  faqPageEnabled?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  newsletterEnabled?: boolean;

  @ApiPropertyOptional({
    example: "#7c3aed",
    pattern: "^#[0-9A-Fa-f]{6}$",
  })
  @IsOptional()
  @Matches(HEX_COLOR_PATTERN, {
    message:
      "primaryAccent must be a valid six-digit hexadecimal color.",
  })
  primaryAccent?: string;

  @ApiPropertyOptional({
    example: "#22d3ee",
    pattern: "^#[0-9A-Fa-f]{6}$",
  })
  @IsOptional()
  @Matches(HEX_COLOR_PATTERN, {
    message:
      "secondaryAccent must be a valid six-digit hexadecimal color.",
  })
  secondaryAccent?: string;

  @ApiPropertyOptional({
    example: "/logo.png",
  })
  @IsOptional()
  @IsString()
  @ValidateIf(
    (_object, value: unknown) =>
      value !== undefined && value !== "",
  )
  @Matches(URL_OR_PATH_PATTERN, {
    message:
      "logoUrl must be a valid HTTP URL or absolute path.",
  })
  logoUrl?: string;

  @ApiPropertyOptional({
    example: "/logo-mark.png",
  })
  @IsOptional()
  @IsString()
  @ValidateIf(
    (_object, value: unknown) =>
      value !== undefined && value !== "",
  )
  @Matches(URL_OR_PATH_PATTERN, {
    message:
      "compactLogoUrl must be a valid HTTP URL or absolute path.",
  })
  compactLogoUrl?: string;

  @ApiPropertyOptional({
    example: "/favicon.ico",
  })
  @IsOptional()
  @IsString()
  @ValidateIf(
    (_object, value: unknown) =>
      value !== undefined && value !== "",
  )
  @Matches(URL_OR_PATH_PATTERN, {
    message:
      "faviconUrl must be a valid HTTP URL or absolute path.",
  })
  faviconUrl?: string;

  @ApiPropertyOptional({
    example: "/social-share.jpg",
  })
  @IsOptional()
  @IsString()
  @ValidateIf(
    (_object, value: unknown) =>
      value !== undefined && value !== "",
  )
  @Matches(URL_OR_PATH_PATTERN, {
    message:
      "socialImageUrl must be a valid HTTP URL or absolute path.",
  })
  socialImageUrl?: string;

  @ApiPropertyOptional({
    example:
      "Experience Thailand's most unforgettable music festival in the heart of Koh Phangan.",
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  footerDescription?: string;

  @ApiPropertyOptional({
    example:
      "© Waterfall Festival. All rights reserved.",
    maxLength: 300,
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  footerCopyright?: string;
}