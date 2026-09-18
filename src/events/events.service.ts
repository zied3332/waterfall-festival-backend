import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";

import {
  LocalImageStorageService,
} from "../storage/local-image-storage.service.js";

import {
  EventStatus,
  HomepageEventMode,
} from "../generated/prisma/enums.js";

import {
  PrismaService,
} from "../prisma/prisma.service.js";

import {
  CreateEventDto,
} from "./dto/create-event.dto.js";

import {
  UpdateEventDto,
} from "./dto/update-event.dto.js";

import {
  UpdateHomepageEventSettingsDto,
} from "./dto/update-homepage-event-settings.dto.js";

const FESTIVAL_TIME_ZONE =
  "Asia/Bangkok";

const WEBSITE_SETTINGS_ID =
  1;

@Injectable()
export class EventsService {
  private readonly logger =
    new Logger(
      EventsService.name,
    );

  constructor(
    private readonly prisma:
      PrismaService,

    private readonly localImageStorageService:
      LocalImageStorageService,
  ) {}

  /*
   * ============================================================
   * PUBLIC EVENTS
   * ============================================================
   */

  findAll() {
    return this.prisma.event.findMany({
      where: {
        status:
          EventStatus.PUBLISHED,
      },

      orderBy: {
        date:
          "asc",
      },
    });
  }

  async findBySlug(
    slug: string,
  ) {
    const event =
      await this.prisma.event.findUnique({
        where: {
          slug,
        },
      });

    if (
      !event ||
      event.status !==
        EventStatus.PUBLISHED
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
   * MANUAL:
   * The administrator explicitly selects a published event.
   * That event remains the homepage event until the
   * administrator changes the selection or switches back to AUTO.
   *
   * AUTO:
   * Published events are ordered by date.
   *
   * An event remains the homepage event until 21:00
   * Asia/Bangkok on its event date.
   *
   * The switch will never happen before the event's actual
   * start time.
   *
   * After the switch time passes, the next published event
   * automatically becomes the homepage event.
   * ============================================================
   */

  async getHomepageEvent() {
    const settings =
      await this.ensureWebsiteSettings();

    /*
     * MANUAL MODE
     */

    if (
      settings.homepageEventMode ===
        HomepageEventMode.MANUAL &&
      settings.homepageManualEventId
    ) {
      const manualEvent =
        await this.prisma.event.findFirst({
          where: {
            id:
              settings.homepageManualEventId,

            status:
              EventStatus.PUBLISHED,
          },
        });

      if (manualEvent) {
        return {
          mode:
            HomepageEventMode.MANUAL,

          event:
            manualEvent,

          switchAt:
            null,
        };
      }
    }

    /*
     * AUTO MODE
     */

    const automatic =
      await this.resolveAutomaticHomepageEvent();

    return {
      mode:
        HomepageEventMode.AUTO,

      event:
        automatic.event,

      switchAt:
        automatic.switchAt,
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
              id:
                settings.homepageManualEventId,
            },
          })
        : null;

    const resolved =
      await this.getHomepageEvent();

    return {
      homepageEventMode:
        settings.homepageEventMode,

      homepageManualEventId:
        settings.homepageManualEventId,

      homepageManualEvent:
        manualEvent,

      resolvedMode:
        resolved.mode,

      resolvedEvent:
        resolved.event,

      switchAt:
        resolved.switchAt,
    };
  }

  async updateHomepageEventSettings(
    dto: UpdateHomepageEventSettingsDto,
  ) {
    const current =
      await this.ensureWebsiteSettings();

    const nextMode =
      dto.homepageEventMode ??
      current.homepageEventMode;

    const manualEventId =
      dto.homepageManualEventId !==
      undefined
        ? dto.homepageManualEventId
        : current.homepageManualEventId;

    /*
     * Validate manually selected event.
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
            id:
              manualEventId,
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
     * MANUAL requires an event.
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
        id:
          WEBSITE_SETTINGS_ID,
      },

      data: {
        ...(dto.homepageEventMode !==
          undefined && {
          homepageEventMode:
            dto.homepageEventMode,
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

    const slug =
      this.createSlug(
        createEventDto.title,
      );

    const existingEvent =
      await this.prisma.event.findUnique({
        where: {
          slug,
        },
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

        date:
          eventDate,
      },
    });
  }

  /*
   * ============================================================
   * HERO IMAGE - LOCAL STORAGE
   * ============================================================
   */

  async uploadHeroImage(
    id: number,
    file: Express.Multer.File,
  ) {
    const existingEvent =
      await this.prisma.event.findUnique({
        where: {
          id,
        },
      });

    if (!existingEvent) {
      throw new NotFoundException(
        "Event not found",
      );
    }

    /*
     * First save the NEW image to disk.
     *
     * We do not delete the previous poster yet.
     * This means a failed upload cannot destroy
     * the event's existing poster.
     */

    const uploadedImage =
      await this.localImageStorageService.saveEventPoster(
        id,
        file,
      );

    try {
      /*
       * Save the local URL in PostgreSQL.
       *
       * Example:
       *
       * /uploads/events/event-12-xxxxx.jpg
       *
       * heroImagePublicId belonged to Cloudinary,
       * so event posters no longer need it.
       */

      const updatedEvent =
        await this.prisma.event.update({
          where: {
            id,
          },

          data: {
            heroImageUrl:
              uploadedImage.url,

            heroImagePublicId:
              null,
          },
        });

      /*
       * The database now references the new poster.
       *
       * It is safe to remove the previous LOCAL
       * poster.
       *
       * LocalImageStorageService ignores old
       * Cloudinary/external URLs.
       */

      try {
        await this.localImageStorageService.deleteEventPoster(
          existingEvent.heroImageUrl,
        );
      } catch (
        error: unknown
      ) {
        this.logger.warn(
          `The previous local hero image for event ${id} could not be deleted.`,

          error instanceof Error
            ? error.stack
            : undefined,
        );
      }

      return updatedEvent;
    } catch (
      error: unknown
    ) {
      /*
       * The image was written successfully,
       * but updating PostgreSQL failed.
       *
       * Remove the newly created file so that
       * it does not become an orphan.
       */

      try {
        await this.localImageStorageService.deleteEventPoster(
          uploadedImage.url,
        );
      } catch (
        cleanupError: unknown
      ) {
        this.logger.error(
          `The new local poster could not be cleaned up after the database update failed for event ${id}.`,

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
        where: {
          id,
        },
      });

    if (!existingEvent) {
      throw new NotFoundException(
        "Event not found",
      );
    }

    let slug =
      existingEvent.slug;

    if (
      updateEventDto.title
    ) {
      slug =
        this.createSlug(
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

      if (
        eventWithSameSlug
      ) {
        throw new ConflictException(
          "An event with a similar title already exists",
        );
      }
    }

    const updatedDate =
      updateEventDto.date !==
      undefined
        ? this.validateEventDate(
            updateEventDto.date,
          )
        : undefined;

    return this.prisma.event.update({
      where: {
        id,
      },

      data: {
        ...updateEventDto,

        slug,

        ...(updatedDate !==
          undefined && {
          date:
            updatedDate,
        }),
      },
    });
  }

  /*
   * ============================================================
   * DELETE EVENT
   * ============================================================
   */

  async remove(
    id: number,
  ) {
    const existingEvent =
      await this.prisma.event.findUnique({
        where: {
          id,
        },
      });

    if (!existingEvent) {
      throw new NotFoundException(
        "Event not found",
      );
    }

    /*
     * Delete the database event first.
     *
     * If Prisma fails, we keep the poster because
     * the event still exists.
     */

    await this.prisma.event.delete({
      where: {
        id,
      },
    });

    /*
     * Database deletion succeeded.
     *
     * Delete its local poster.
     *
     * Old Cloudinary URLs are ignored automatically.
     */

    try {
      await this.localImageStorageService.deleteEventPoster(
        existingEvent.heroImageUrl,
      );
    } catch (
      error: unknown
    ) {
      /*
       * Do not turn an already-successful database
       * deletion into an API failure just because
       * filesystem cleanup failed.
       */

      this.logger.warn(
        `The local hero image for deleted event ${id} could not be deleted.`,

        error instanceof Error
          ? error.stack
          : undefined,
      );
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
        createdAt:
          "desc",
      },
    });
  }

  async findOneForAdmin(
    id: number,
  ) {
    const event =
      await this.prisma.event.findUnique({
        where: {
          id,
        },
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
        id:
          WEBSITE_SETTINGS_ID,
      },

      update: {},

      create: {
        id:
          WEBSITE_SETTINGS_ID,
      },
    });
  }

  /*
   * AUTO homepage selection.
   *
   * Events are ordered chronologically.
   *
   * Every event remains active until 21:00
   * Thailand time on its event date.
   *
   * However, the switch can never happen
   * before the actual event start time.
   */

  private async resolveAutomaticHomepageEvent() {
    const now =
      new Date();

    const publishedEvents =
      await this.prisma.event.findMany({
        where: {
          status:
            EventStatus.PUBLISHED,
        },

        orderBy: {
          date:
            "asc",
        },
      });

    if (
      publishedEvents.length ===
      0
    ) {
      return {
        event:
          null,

        switchAt:
          null,
      };
    }

    for (
      const event of
      publishedEvents
    ) {
      /*
       * Fixed automatic switch time:
       * 21:00 Asia/Bangkok on event day.
       */

      const configuredSwitchAt =
        this.getHomepageSwitchTime(
          event.date,
        );

      /*
       * Safety:
       *
       * Never switch before the actual
       * event start time.
       */

      const switchAt =
        configuredSwitchAt.getTime() <
        event.date.getTime()
          ? event.date
          : configuredSwitchAt;

      if (
        now.getTime() <
        switchAt.getTime()
      ) {
        return {
          event,

          switchAt:
            switchAt.toISOString(),
        };
      }
    }

    /*
     * No current/future events remain.
     *
     * Keep the latest published event
     * instead of making the homepage empty.
     */

    const fallbackEvent =
      publishedEvents[
        publishedEvents.length -
        1
      ];

    return {
      event:
        fallbackEvent,

      switchAt:
        null,
    };
  }

  /*
   * Calculate 21:00 on the event's
   * calendar date in Thailand.
   */

  private getHomepageSwitchTime(
    eventDate: Date,
  ): Date {
    const dateParts =
      new Intl.DateTimeFormat(
        "en-CA",
        {
          timeZone:
            FESTIVAL_TIME_ZONE,

          year:
            "numeric",

          month:
            "2-digit",

          day:
            "2-digit",
        },
      ).formatToParts(
        eventDate,
      );

    const year =
      dateParts.find(
        (part) =>
          part.type ===
          "year",
      )?.value;

    const month =
      dateParts.find(
        (part) =>
          part.type ===
          "month",
      )?.value;

    const day =
      dateParts.find(
        (part) =>
          part.type ===
          "day",
      )?.value;

    if (
      !year ||
      !month ||
      !day
    ) {
      throw new BadRequestException(
        "Homepage event switch date could not be calculated",
      );
    }

    return new Date(
      `${year}-${month}-${day}T21:00:00+07:00`,
    );
  }

  /*
   * ============================================================
   * DATE VALIDATION
   * ============================================================
   */

  private validateEventDate(
    dateValue: string,
  ): Date {
    const eventDate =
      new Date(
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

    if (
      eventDay <
      currentDay
    ) {
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

          year:
            "numeric",

          month:
            "2-digit",

          day:
            "2-digit",
        },
      ).formatToParts(
        date,
      );

    const year =
      dateParts.find(
        (part) =>
          part.type ===
          "year",
      )?.value;

    const month =
      dateParts.find(
        (part) =>
          part.type ===
          "month",
      )?.value;

    const day =
      dateParts.find(
        (part) =>
          part.type ===
          "day",
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
      .normalize(
        "NFD",
      )
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