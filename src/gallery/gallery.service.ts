import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { CloudinaryService } from "../cloudinary/cloudinary.service.js";
import { PrismaService } from "../prisma/prisma.service.js";

import { CreateGalleryImageDto } from "./dto/create-gallery-image.dto.js";
import { UpdateGalleryImageDto } from "./dto/update-gallery-image.dto.js";

@Injectable()
export class GalleryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
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

  async findPublishedImages() {
    return this.prisma.galleryImage.findMany({
      where: {
        status: "PUBLISHED",
        mediaType: "IMAGE",
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

  async findPublishedVideos() {
    return this.prisma.galleryImage.findMany({
      where: {
        status: "PUBLISHED",
        mediaType: "VIDEO",
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

  async findHomepageVideos() {
    return this.prisma.galleryImage.findMany({
      where: {
        mediaType: "VIDEO",
        status: "PUBLISHED",
        showOnHomepage: true,
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
          homepageSortOrder: "asc",
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
    const galleryItem =
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

    if (!galleryItem) {
      throw new NotFoundException(
        `Gallery media item with ID ${id} was not found.`,
      );
    }

    return galleryItem;
  }

  async create(
    createGalleryImageDto: CreateGalleryImageDto,
  ) {
    const {
      eventId,
      ...galleryData
    } = createGalleryImageDto;

    await this.validateEvent(eventId);

    return this.prisma.galleryImage.create({
      data: {
        ...galleryData,

        mediaType:
          galleryData.mediaType ??
          "IMAGE",

        eventId:
          eventId ?? null,
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
    await this.ensureGalleryItemExists(id);

    const {
      eventId,
      ...galleryData
    } = updateGalleryImageDto;

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
    const galleryItem =
      await this.prisma.galleryImage.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          mediaType: true,
          publicId: true,
        },
      });

    if (!galleryItem) {
      throw new NotFoundException(
        `Gallery media item with ID ${id} was not found.`,
      );
    }

    if (galleryItem.publicId) {
      if (
        galleryItem.mediaType ===
        "VIDEO"
      ) {
        await this.cloudinaryService.deleteVideo(
          galleryItem.publicId,
        );
      } else {
        await this.cloudinaryService.deleteImage(
          galleryItem.publicId,
        );
      }
    }

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

    const event =
      await this.prisma.event.findUnique({
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

  private async ensureGalleryItemExists(
    id: number,
  ): Promise<void> {
    const galleryItem =
      await this.prisma.galleryImage.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
        },
      });

    if (!galleryItem) {
      throw new NotFoundException(
        `Gallery media item with ID ${id} was not found.`,
      );
    }
  }
}