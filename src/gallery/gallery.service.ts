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

  async findAllAdmin() {
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

  async create(
    createGalleryImageDto: CreateGalleryImageDto,
  ) {
    const { eventId, ...galleryData } =
      createGalleryImageDto;

    if (eventId !== undefined) {
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

    return this.prisma.galleryImage.create({
      data: {
        ...galleryData,
        event:
          eventId !== undefined
            ? {
                connect: {
                  id: eventId,
                },
              }
            : undefined,
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

    if (eventId !== undefined) {
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

    return this.prisma.galleryImage.update({
      where: {
        id,
      },
      data: {
        ...galleryData,
        event:
          eventId !== undefined
            ? {
                connect: {
                  id: eventId,
                },
              }
            : undefined,
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
  async findOneAdmin(id: number) {
  const galleryImage = await this.prisma.galleryImage.findUnique({
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
}