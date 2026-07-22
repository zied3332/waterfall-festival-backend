import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service.js";
import { CreateGalleryImageDto } from "./dto/create-gallery-image.dto.js";
import { UpdateGalleryImageDto } from "./dto/update-gallery-image.dto.js";

@Injectable()
export class GalleryService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async findPublished() {
    return this.prisma.galleryImage.findMany({
      where: {
        status: "PUBLISHED",
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
      orderBy: [
        {
          sortOrder: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
    });
  }

  async findAll() {
    return this.prisma.galleryImage.findMany({
      include: {
        event: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
      orderBy: [
        {
          sortOrder: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
    });
  }

  async findOne(id: number) {
    const galleryImage =
      await this.prisma.galleryImage.findUnique({
        where: {
          id,
        },
        include: {
          event: {
            select: {
              id: true,
              title: true,
              slug: true,
            },
          },
        },
      });

    if (!galleryImage) {
      throw new NotFoundException(
        `Gallery image with ID ${id} was not found.`,
      );
    }

    return galleryImage;
  }

  async create(
    createGalleryImageDto: CreateGalleryImageDto,
  ) {
    const { eventId, ...galleryData } =
      createGalleryImageDto;

    await this.validateEvent(eventId);

    return this.prisma.galleryImage.create({
      data: {
        ...galleryData,
        eventId: eventId ?? null,
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });
  }

  async update(
    id: number,
    updateGalleryImageDto: UpdateGalleryImageDto,
  ) {
    await this.ensureGalleryImageExists(id);

    const { eventId, ...galleryData } =
      updateGalleryImageDto;

    await this.validateEvent(eventId);

    return this.prisma.galleryImage.update({
      where: {
        id,
      },
      data: {
        ...galleryData,
        eventId:
          eventId === undefined
            ? undefined
            : eventId,
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });
  }

  async remove(id: number) {
    await this.ensureGalleryImageExists(id);

    return this.prisma.galleryImage.delete({
      where: {
        id,
      },
    });
  }

  private async validateEvent(
    eventId?: number | null,
  ): Promise<void> {
    if (eventId == null) {
      return;
    }

    const event = await this.prisma.event.findUnique({
      where: {
        id: eventId,
      },
      select: {
        id: true,
      },
    });

    if (!event) {
      throw new NotFoundException(
        `Event with ID ${eventId} was not found.`,
      );
    }
  }

  private async ensureGalleryImageExists(
    id: number,
  ): Promise<void> {
    const galleryImage =
      await this.prisma.galleryImage.findUnique({
        where: {
          id,
        },
        select: {
          id: true,
        },
      });

    if (!galleryImage) {
      throw new NotFoundException(
        `Gallery image with ID ${id} was not found.`,
      );
    }
  }
}