import {
  BadRequestException,
  Injectable,
} from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service.js";
import { UpdateWebsiteSettingsDto } from "./dto/update-website-settings.dto.js";

const SETTINGS_ID = 1;

const DEFAULT_START_DATE =
  new Date("2026-12-28T00:00:00.000Z");

const DEFAULT_END_DATE =
  new Date("2027-01-02T00:00:00.000Z");

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async getAdminSettings() {
    return this.findOrCreateSettings();
  }

  async getPublicSettings() {
    const settings =
      await this.findOrCreateSettings();

    const {
      escalationEmail: _escalationEmail,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...publicSettings
    } = settings;

    return publicSettings;
  }

  async updateSettings(
    updateWebsiteSettingsDto: UpdateWebsiteSettingsDto,
  ) {
    const currentSettings =
      await this.findOrCreateSettings();

    const {
      startDate,
      endDate,
      ...settingsData
    } = updateWebsiteSettingsDto;

    const nextStartDate =
      startDate === undefined
        ? currentSettings.startDate
        : this.parseDate(startDate);

    const nextEndDate =
      endDate === undefined
        ? currentSettings.endDate
        : this.parseDate(endDate);

    this.validateDateRange(
      nextStartDate,
      nextEndDate,
    );

    return this.prisma.websiteSettings.update({
      where: {
        id: SETTINGS_ID,
      },
      data: {
        ...settingsData,
        startDate:
          startDate === undefined
            ? undefined
            : nextStartDate,
        endDate:
          endDate === undefined
            ? undefined
            : nextEndDate,
      },
    });
  }

  private async findOrCreateSettings() {
    return this.prisma.websiteSettings.upsert({
      where: {
        id: SETTINGS_ID,
      },
      update: {},
      create: {
        id: SETTINGS_ID,
        startDate: DEFAULT_START_DATE,
        endDate: DEFAULT_END_DATE,
        websiteUrl:
          "https://www.waterfallfestival.com",
        publicEmail:
          "info@waterfallfestival.com",
        supportEmail:
          "support@waterfallfestival.com",
        phoneNumber:
          "+66 000 000 000",
        whatsappNumber:
          "+66 000 000 000",
        address:
          "Waterfall Party, Koh Phangan, Thailand",
        googleMapsUrl:
          "https://maps.google.com",
        instagramUrl:
          "https://instagram.com/waterfallfestival",
        facebookUrl:
          "https://facebook.com/waterfallfestival",
        tiktokUrl:
          "https://tiktok.com/@waterfallfestival",
        youtubeUrl:
          "https://youtube.com",
        escalationEmail:
          "support@waterfallfestival.com",
      },
    });
  }

  private parseDate(value: string): Date {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(
        `"${value}" is not a valid date.`,
      );
    }

    return date;
  }

  private validateDateRange(
    startDate: Date | null,
    endDate: Date | null,
  ): void {
    if (
      startDate &&
      endDate &&
      startDate.getTime() >
        endDate.getTime()
    ) {
      throw new BadRequestException(
        "Festival end date must be on or after the start date.",
      );
    }
  }
}