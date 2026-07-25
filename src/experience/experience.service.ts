import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

import { CreateExperienceHighlightDto } from './dto/create-experience-highlight.dto.js';
import { CreateExperienceImageDto } from './dto/create-experience-image.dto.js';
import { CreateExperiencePageDto } from './dto/create-experience-page.dto.js';
import { UpdateExperienceHighlightDto } from './dto/update-experience-highlight.dto.js';
import { UpdateExperienceImageDto } from './dto/update-experience-image.dto.js';
import { UpdateExperiencePageDto } from './dto/update-experience-page.dto.js';

@Injectable()
export class ExperienceService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async findPublicPage() {
    const experiencePage =
      await this.prisma.experiencePage.findFirst({
        where: {
          isPublished: true,
        },
        include: {
          highlights: {
            where: {
              isVisible: true,
            },
            orderBy: {
              sortOrder: 'asc',
            },
          },
          images: {
            where: {
              isVisible: true,
            },
            orderBy: [
              {
                isFeatured: 'desc',
              },
              {
                sortOrder: 'asc',
              },
            ],
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

    if (!experiencePage) {
      throw new NotFoundException(
        'Published experience page was not found',
      );
    }

    return experiencePage;
  }

  async findAdminPage() {
    const experiencePage =
      await this.prisma.experiencePage.findFirst({
        include: {
          highlights: {
            orderBy: {
              sortOrder: 'asc',
            },
          },
          images: {
            orderBy: [
              {
                isFeatured: 'desc',
              },
              {
                sortOrder: 'asc',
              },
            ],
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

    return experiencePage;
  }

  async createPage(
    createExperiencePageDto: CreateExperiencePageDto,
  ) {
    return this.prisma.experiencePage.create({
      data: createExperiencePageDto,
      include: {
        highlights: true,
        images: true,
      },
    });
  }

  async updatePage(
    updateExperiencePageDto: UpdateExperiencePageDto,
  ) {
    const experiencePage =
      await this.prisma.experiencePage.findFirst({
        orderBy: {
          updatedAt: 'desc',
        },
      });

    if (!experiencePage) {
      throw new NotFoundException(
        'Experience page was not found',
      );
    }

    return this.prisma.experiencePage.update({
      where: {
        id: experiencePage.id,
      },
      data: updateExperiencePageDto,
      include: {
        highlights: {
          orderBy: {
            sortOrder: 'asc',
          },
        },
        images: {
          orderBy: [
            {
              isFeatured: 'desc',
            },
            {
              sortOrder: 'asc',
            },
          ],
        },
      },
    });
  }

  async createHighlight(
    createExperienceHighlightDto:
      CreateExperienceHighlightDto,
  ) {
    const experiencePage =
      await this.getExperiencePageOrThrow();

    return this.prisma.experienceHighlight.create({
      data: {
        ...createExperienceHighlightDto,
        experiencePageId: experiencePage.id,
      },
    });
  }

  async findHighlights() {
    const experiencePage =
      await this.getExperiencePageOrThrow();

    return this.prisma.experienceHighlight.findMany({
      where: {
        experiencePageId: experiencePage.id,
      },
      orderBy: {
        sortOrder: 'asc',
      },
    });
  }

  async findHighlight(id: number) {
    const highlight =
      await this.prisma.experienceHighlight.findUnique({
        where: {
          id,
        },
      });

    if (!highlight) {
      throw new NotFoundException(
        `Experience highlight with ID ${id} was not found`,
      );
    }

    return highlight;
  }

  async updateHighlight(
    id: number,
    updateExperienceHighlightDto:
      UpdateExperienceHighlightDto,
  ) {
    await this.findHighlight(id);

    return this.prisma.experienceHighlight.update({
      where: {
        id,
      },
      data: updateExperienceHighlightDto,
    });
  }

  async removeHighlight(id: number) {
    await this.findHighlight(id);

    await this.prisma.experienceHighlight.delete({
      where: {
        id,
      },
    });

    return {
      message:
        'Experience highlight deleted successfully',
    };
  }

  async createImage(
    createExperienceImageDto:
      CreateExperienceImageDto,
  ) {
    const experiencePage =
      await this.getExperiencePageOrThrow();

    if (createExperienceImageDto.isFeatured) {
      await this.clearFeaturedImage(
        experiencePage.id,
      );
    }

    return this.prisma.experienceImage.create({
      data: {
        ...createExperienceImageDto,
        experiencePageId: experiencePage.id,
      },
    });
  }

  async findImages() {
    const experiencePage =
      await this.getExperiencePageOrThrow();

    return this.prisma.experienceImage.findMany({
      where: {
        experiencePageId: experiencePage.id,
      },
      orderBy: [
        {
          isFeatured: 'desc',
        },
        {
          sortOrder: 'asc',
        },
      ],
    });
  }

  async findImage(id: number) {
    const image =
      await this.prisma.experienceImage.findUnique({
        where: {
          id,
        },
      });

    if (!image) {
      throw new NotFoundException(
        `Experience image with ID ${id} was not found`,
      );
    }

    return image;
  }

  async updateImage(
    id: number,
    updateExperienceImageDto:
      UpdateExperienceImageDto,
  ) {
    const image = await this.findImage(id);

    if (updateExperienceImageDto.isFeatured) {
      await this.clearFeaturedImage(
        image.experiencePageId,
        id,
      );
    }

    return this.prisma.experienceImage.update({
      where: {
        id,
      },
      data: updateExperienceImageDto,
    });
  }

  async removeImage(id: number) {
    await this.findImage(id);

    await this.prisma.experienceImage.delete({
      where: {
        id,
      },
    });

    return {
      message:
        'Experience image deleted successfully',
    };
  }

  private async getExperiencePageOrThrow() {
    const experiencePage =
      await this.prisma.experiencePage.findFirst({
        orderBy: {
          updatedAt: 'desc',
        },
      });

    if (!experiencePage) {
      throw new NotFoundException(
        'Experience page was not found. Create the page first.',
      );
    }

    return experiencePage;
  }

  private async clearFeaturedImage(
    experiencePageId: number,
    excludedImageId?: number,
  ) {
    await this.prisma.experienceImage.updateMany({
      where: {
        experiencePageId,
        isFeatured: true,
        ...(excludedImageId && {
          id: {
            not: excludedImageId,
          },
        }),
      },
      data: {
        isFeatured: false,
      },
    });
  }
}