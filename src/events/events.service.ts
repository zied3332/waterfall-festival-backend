import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";

import { CloudinaryService } from "../cloudinary/cloudinary.service.js";
import { EventStatus } from "../generated/prisma/enums.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { CreateEventDto } from "./dto/create-event.dto.js";
import { UpdateEventDto } from "./dto/update-event.dto.js";

const FESTIVAL_TIME_ZONE = "Asia/Bangkok";

@Injectable()
export class EventsService {
  private readonly logger = new Logger(
    EventsService.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

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

      if (existingEvent.heroImagePublicId) {
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

    if (existingEvent.heroImagePublicId) {
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

  private validateEventDate(
    dateValue: string,
  ): Date {
    const eventDate = new Date(dateValue);

    if (
      Number.isNaN(eventDate.getTime())
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
      new Intl.DateTimeFormat("en-CA", {
        timeZone: FESTIVAL_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(date);

    const year = dateParts.find(
      (part) => part.type === "year",
    )?.value;

    const month = dateParts.find(
      (part) => part.type === "month",
    )?.value;

    const day = dateParts.find(
      (part) => part.type === "day",
    )?.value;

    if (!year || !month || !day) {
      throw new BadRequestException(
        "Event date could not be processed",
      );
    }

    return `${year}-${month}-${day}`;
  }

  private createSlug(
    title: string,
  ): string {
    return title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
}