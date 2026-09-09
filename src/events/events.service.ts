import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";

import { CloudinaryService } from "../cloudinary/cloudinary.service.js";

import {
  EventStatus,
  HomepageEventMode,
} from "../generated/prisma/enums.js";

import { PrismaService } from "../prisma/prisma.service.js";

import { CreateEventDto } from "./dto/create-event.dto.js";
import { UpdateEventDto } from "./dto/update-event.dto.js";
import { UpdateHomepageEventSettingsDto } from "./dto/update-homepage-event-settings.dto.js";

const FESTIVAL_TIME_ZONE = "Asia/Bangkok";
const WEBSITE_SETTINGS_ID = 1;

@Injectable()
export class EventsService {
  private readonly logger = new Logger(
    EventsService.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  /*
   * ============================================================
   * PUBLIC EVENTS
   * ============================================================
   */

  findAll() {
    return this.prisma.event.findMany({
      where: {
        status: EventStatus.PUBLISHED,
      },
      orderBy: {
        date: "asc",
      },
    });
  }

  async findBySlug(slug: string) {
    const event =
      await this.prisma.event.findUnique({
        where: { slug },
      });

    if (
      !event ||
      event.status !== EventStatus.PUBLISHED
    ) {
      throw new NotFoundException(
        "Event not found",
      );
    }

    return event;
  }

  /*
   * ============================================================
   * HOMEPAGE EVENT
   * ============================================================
   *
   * AUTO:
   * The backend automatically chooses the event that should
   * currently be displayed on the homepage.
   *
   * An event stays on the homepage until
   * homepageAutoSwitchHours hours after its start time.
   *
   * After that time, the next published event becomes
   * the homepage event.
   *
   * MANUAL:
   * The administrator explicitly selects the event.
   * ============================================================
   */

  async getHomepageEvent() {
    const settings =
      await this.ensureWebsiteSettings();

    /*
     * Try MANUAL mode first.
     *
     * The selected event must still exist and must
     * still be published.
     *
     * If it does not, we safely fall back to AUTO.
     */
    if (
      settings.homepageEventMode ===
        HomepageEventMode.MANUAL &&
      settings.homepageManualEventId
    ) {
      const manualEvent =
        await this.prisma.event.findFirst({
          where: {
            id: settings.homepageManualEventId,
            status: EventStatus.PUBLISHED,
          },
        });

      if (manualEvent) {
        return {
          mode: HomepageEventMode.MANUAL,
          autoSwitchHours:
            settings.homepageAutoSwitchHours,
          event: manualEvent,
          switchAt: null,
        };
      }
    }

    /*
     * AUTO mode.
     */
    const automatic =
      await this.resolveAutomaticHomepageEvent(
        settings.homepageAutoSwitchHours,
      );

    return {
      mode: HomepageEventMode.AUTO,
      autoSwitchHours:
        settings.homepageAutoSwitchHours,
      event: automatic.event,
      switchAt: automatic.switchAt,
    };
  }

  /*
   * ============================================================
   * ADMIN HOMEPAGE EVENT SETTINGS
   * ============================================================
   */

  async getHomepageEventSettingsForAdmin() {
    const settings =
      await this.ensureWebsiteSettings();

    const manualEvent =
      settings.homepageManualEventId
        ? await this.prisma.event.findUnique({
            where: {
              id: settings.homepageManualEventId,
            },
          })
        : null;

    const resolved =
      await this.getHomepageEvent();

    return {
      homepageEventMode:
        settings.homepageEventMode,

      homepageAutoSwitchHours:
        settings.homepageAutoSwitchHours,

      homepageManualEventId:
        settings.homepageManualEventId,

      homepageManualEvent:
        manualEvent,

      /*
       * This tells the admin which mode/event is
       * actually being used right now.
       *
       * For example, MANUAL can safely fall back
       * to AUTO if its selected event is unavailable.
       */
      resolvedMode: resolved.mode,
      resolvedEvent: resolved.event,
      switchAt: resolved.switchAt,
    };
  }

  async updateHomepageEventSettings(
    dto: UpdateHomepageEventSettingsDto,
  ) {
    const current =
      await this.ensureWebsiteSettings();

    /*
     * Work out what the settings will look like
     * after this update.
     */
    const nextMode =
      dto.homepageEventMode ??
      current.homepageEventMode;

    const manualEventId =
      dto.homepageManualEventId !== undefined
        ? dto.homepageManualEventId
        : current.homepageManualEventId;

    /*
     * A manual event must be validated when:
     *
     * 1. MANUAL mode is being used, or
     * 2. the admin explicitly sends a manual event ID.
     */
    if (
      manualEventId !== null &&
      (
        nextMode ===
          HomepageEventMode.MANUAL ||
        dto.homepageManualEventId !==
          undefined
      )
    ) {
      const selectedEvent =
        await this.prisma.event.findUnique({
          where: {
            id: manualEventId,
          },
        });

      if (!selectedEvent) {
        throw new NotFoundException(
          "Selected homepage event not found",
        );
      }

      if (
        selectedEvent.status !==
        EventStatus.PUBLISHED
      ) {
        throw new BadRequestException(
          "The manual homepage event must be published",
        );
      }
    }

    /*
     * MANUAL mode cannot work without an event.
     */
    if (
      nextMode ===
        HomepageEventMode.MANUAL &&
      manualEventId === null
    ) {
      throw new BadRequestException(
        "A published event must be selected when homepage mode is MANUAL",
      );
    }

    await this.prisma.websiteSettings.update({
      where: {
        id: WEBSITE_SETTINGS_ID,
      },

      data: {
        ...(dto.homepageEventMode !==
          undefined && {
          homepageEventMode:
            dto.homepageEventMode,
        }),

        ...(dto.homepageAutoSwitchHours !==
          undefined && {
          homepageAutoSwitchHours:
            dto.homepageAutoSwitchHours,
        }),

        ...(dto.homepageManualEventId !==
          undefined && {
          homepageManualEventId:
            dto.homepageManualEventId,
        }),
      },
    });

    return this.getHomepageEventSettingsForAdmin();
  }

  /*
   * ============================================================
   * CREATE EVENT
   * ============================================================
   */

  async create(
    createEventDto: CreateEventDto,
  ) {
    const eventDate =
      this.validateEventDate(
        createEventDto.date,
      );

    const slug = this.createSlug(
      createEventDto.title,
    );

    const existingEvent =
      await this.prisma.event.findUnique({
        where: { slug },
      });

    if (existingEvent) {
      throw new ConflictException(
        "An event with a similar title already exists",
      );
    }

    return this.prisma.event.create({
      data: {
        ...createEventDto,
        slug,
        date: eventDate,
      },
    });
  }

  /*
   * ============================================================
   * HERO IMAGE
   * ============================================================
   */

  async uploadHeroImage(
    id: number,
    file: Express.Multer.File,
  ) {
    const existingEvent =
      await this.prisma.event.findUnique({
        where: { id },
      });

    if (!existingEvent) {
      throw new NotFoundException(
        "Event not found",
      );
    }

    const uploadedImage =
      await this.cloudinaryService.uploadEventHeroImage(
        file,
      );

    try {
      const updatedEvent =
        await this.prisma.event.update({
          where: { id },

          data: {
            heroImageUrl:
              uploadedImage.secure_url,

            heroImagePublicId:
              uploadedImage.public_id,
          },
        });

      if (
        existingEvent.heroImagePublicId
      ) {
        try {
          await this.cloudinaryService.deleteImage(
            existingEvent.heroImagePublicId,
          );
        } catch (error: unknown) {
          this.logger.warn(
            `The previous hero image for event ${id} could not be deleted from Cloudinary.`,
            error instanceof Error
              ? error.stack
              : undefined,
          );
        }
      }

      return updatedEvent;
    } catch (error: unknown) {
      try {
        await this.cloudinaryService.deleteImage(
          uploadedImage.public_id,
        );
      } catch (cleanupError: unknown) {
        this.logger.error(
          `The new Cloudinary image could not be cleaned up after the database update failed for event ${id}.`,
          cleanupError instanceof Error
            ? cleanupError.stack
            : undefined,
        );
      }

      throw error;
    }
  }

  /*
   * ============================================================
   * UPDATE EVENT
   * ============================================================
   */

  async update(
    id: number,
    updateEventDto: UpdateEventDto,
  ) {
    const existingEvent =
      await this.prisma.event.findUnique({
        where: { id },
      });

    if (!existingEvent) {
      throw new NotFoundException(
        "Event not found",
      );
    }

    let slug = existingEvent.slug;

    if (updateEventDto.title) {
      slug = this.createSlug(
        updateEventDto.title,
      );

      const eventWithSameSlug =
        await this.prisma.event.findFirst({
          where: {
            slug,

            NOT: {
              id,
            },
          },
        });

      if (eventWithSameSlug) {
        throw new ConflictException(
          "An event with a similar title already exists",
        );
      }
    }

    const updatedDate =
      updateEventDto.date !== undefined
        ? this.validateEventDate(
            updateEventDto.date,
          )
        : undefined;

    return this.prisma.event.update({
      where: { id },

      data: {
        ...updateEventDto,
        slug,

        ...(updatedDate !== undefined && {
          date: updatedDate,
        }),
      },
    });
  }

  /*
   * ============================================================
   * DELETE EVENT
   * ============================================================
   */

  async remove(id: number) {
    const existingEvent =
      await this.prisma.event.findUnique({
        where: { id },
      });

    if (!existingEvent) {
      throw new NotFoundException(
        "Event not found",
      );
    }

    await this.prisma.event.delete({
      where: { id },
    });

    if (
      existingEvent.heroImagePublicId
    ) {
      try {
        await this.cloudinaryService.deleteImage(
          existingEvent.heroImagePublicId,
        );
      } catch (error: unknown) {
        this.logger.warn(
          `The hero image for deleted event ${id} could not be deleted from Cloudinary.`,
          error instanceof Error
            ? error.stack
            : undefined,
        );
      }
    }

    return {
      message:
        "Event deleted successfully",
    };
  }

  /*
   * ============================================================
   * ADMIN EVENTS
   * ============================================================
   */

  findAllForAdmin() {
    return this.prisma.event.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async findOneForAdmin(id: number) {
    const event =
      await this.prisma.event.findUnique({
        where: { id },
      });

    if (!event) {
      throw new NotFoundException(
        "Event not found",
      );
    }

    return event;
  }

  /*
   * ============================================================
   * PRIVATE HOMEPAGE HELPERS
   * ============================================================
   */

  private async ensureWebsiteSettings() {
    return this.prisma.websiteSettings.upsert({
      where: {
        id: WEBSITE_SETTINGS_ID,
      },

      update: {},

      create: {
        id: WEBSITE_SETTINGS_ID,
      },
    });
  }

  private async resolveAutomaticHomepageEvent(
    autoSwitchHours: number,
  ) {
    const now = new Date();

    /*
     * Example:
     *
     * autoSwitchHours = 8
     * now = September 10 at 03:00
     *
     * cutoff = September 9 at 19:00
     *
     * Any event after the cutoff is either:
     * - currently inside its retention period, or
     * - a future event.
     *
     * Ordering ascending gives us the correct
     * current/next event.
     */
    const cutoff = new Date(
      now.getTime() -
        autoSwitchHours *
          60 *
          60 *
          1000,
    );

    const event =
      await this.prisma.event.findFirst({
        where: {
          status: EventStatus.PUBLISHED,

          date: {
            gt: cutoff,
          },
        },

        orderBy: {
          date: "asc",
        },
      });

    if (event) {
      const switchAt = new Date(
        event.date.getTime() +
          autoSwitchHours *
            60 *
            60 *
            1000,
      );

      return {
        event,
        switchAt:
          switchAt.toISOString(),
      };
    }

    /*
     * If there is no current or future published event,
     * keep the latest published event as a fallback.
     *
     * This prevents the homepage from suddenly having
     * no event at all.
     */
    const fallbackEvent =
      await this.prisma.event.findFirst({
        where: {
          status: EventStatus.PUBLISHED,
        },

        orderBy: {
          date: "desc",
        },
      });

    return {
      event: fallbackEvent,
      switchAt: null,
    };
  }

  /*
   * ============================================================
   * DATE VALIDATION
   * ============================================================
   */

  private validateEventDate(
    dateValue: string,
  ): Date {
    const eventDate = new Date(
      dateValue,
    );

    if (
      Number.isNaN(
        eventDate.getTime(),
      )
    ) {
      throw new BadRequestException(
        "Event date must be a valid date",
      );
    }

    const eventDay =
      this.getDateKeyInFestivalTimeZone(
        eventDate,
      );

    const currentDay =
      this.getDateKeyInFestivalTimeZone(
        new Date(),
      );

    if (eventDay < currentDay) {
      throw new BadRequestException(
        "Event date cannot be before the current day",
      );
    }

    return eventDate;
  }

  private getDateKeyInFestivalTimeZone(
    date: Date,
  ): string {
    const dateParts =
      new Intl.DateTimeFormat(
        "en-CA",
        {
          timeZone:
            FESTIVAL_TIME_ZONE,

          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        },
      ).formatToParts(date);

    const year =
      dateParts.find(
        (part) =>
          part.type === "year",
      )?.value;

    const month =
      dateParts.find(
        (part) =>
          part.type === "month",
      )?.value;

    const day =
      dateParts.find(
        (part) =>
          part.type === "day",
      )?.value;

    if (
      !year ||
      !month ||
      !day
    ) {
      throw new BadRequestException(
        "Event date could not be processed",
      );
    }

    return `${year}-${month}-${day}`;
  }

  /*
   * ============================================================
   * SLUG
   * ============================================================
   */

  private createSlug(
    title: string,
  ): string {
    return title
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        "",
      )
      .toLowerCase()
      .trim()
      .replace(
        /[^a-z0-9]+/g,
        "-",
      )
      .replace(
        /^-+|-+$/g,
        "",
      );
  }
}