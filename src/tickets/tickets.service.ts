import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { CreateTicketPreviewDto } from './dto/create-ticket-preview.dto.js';
import {
  SortDirection,
  TicketQueryDto,
  TicketSortField,
} from './dto/ticket-query.dto.js';

type PrismaErrorLike = {
  code?: unknown;
};

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTicketPreviewDto) {
    this.validatePricing(dto);
    this.validateQuantities(dto);
    this.validateOrderLimits(dto);
    this.validateSaleDates(dto);

    await this.ensureEventExists(dto.eventId);
    await this.ensureSlugIsAvailable(
      dto.eventId,
      dto.slug,
    );

    try {
      return await this.prisma.ticketPreview.create({
        data: {
          eventId: dto.eventId,
          name: dto.name.trim(),
          slug: this.normalizeSlug(dto.slug),

          shortDescription: this.normalizeOptionalText(
            dto.shortDescription,
          ),
          description: this.normalizeOptionalText(
            dto.description,
          ),

          category: dto.category,
          status: dto.status,

          price: dto.price,
          originalPrice: dto.originalPrice,
          currency:
            dto.currency?.trim().toUpperCase(),

          availabilityMode: dto.availabilityMode,
          totalQuantity: dto.totalQuantity,
          remainingQuantity: dto.remainingQuantity,
          availabilityLabel:
            this.normalizeOptionalText(
              dto.availabilityLabel,
            ),

          saleStartsAt: dto.saleStartsAt
            ? new Date(dto.saleStartsAt)
            : undefined,
          saleEndsAt: dto.saleEndsAt
            ? new Date(dto.saleEndsAt)
            : undefined,

          minimumPerOrder: dto.minimumPerOrder,
          maximumPerOrder: dto.maximumPerOrder,

          externalPurchaseUrl:
            this.normalizeOptionalText(
              dto.externalPurchaseUrl,
            ),
          externalTicketId:
            this.normalizeOptionalText(
              dto.externalTicketId,
            ),

          badge: this.normalizeOptionalText(
            dto.badge,
          ),
          imageUrl: this.normalizeOptionalText(
            dto.imageUrl,
          ),

          isFeatured: dto.isFeatured,
          sortOrder: dto.sortOrder,

          benefits: dto.benefits?.length
            ? {
                create: dto.benefits.map(
                  (benefit, index) => ({
                    text: benefit.text.trim(),
                    sortOrder:
                      benefit.sortOrder ?? index,
                  }),
                ),
              }
            : undefined,
        },
        include: {
          event: {
            select: {
              id: true,
              title: true,
              slug: true,
              date: true,
              status: true,
              ticketProvider: true,
              ticketPurchaseUrl: true,
            },
          },
          benefits: {
            orderBy: {
              sortOrder: 'asc',
            },
          },
        },
      });
    } catch (error: unknown) {
      const errorCode =
        this.getPrismaErrorCode(error);

      if (errorCode === 'P2002') {
        throw new ConflictException(
          'A ticket with this slug already exists for the selected event.',
        );
      }

      if (errorCode === 'P2003') {
        throw new BadRequestException(
          'The selected event does not exist.',
        );
      }

      throw error;
    }
  }

  async findAll(query: TicketQueryDto) {
    const {
      status,
      category,
      eventId,
      isFeatured,
      search,
      page,
      limit,
      sortBy,
      sortDirection,
    } = query;

    const normalizedSearch = search?.trim();

    const where = {
      ...(status !== undefined && {
        status,
      }),

      ...(category !== undefined && {
        category,
      }),

      ...(eventId !== undefined && {
        eventId,
      }),

      ...(isFeatured !== undefined && {
        isFeatured,
      }),

      ...(normalizedSearch && {
        OR: [
          {
            name: {
              contains: normalizedSearch,
              mode: 'insensitive' as const,
            },
          },
          {
            slug: {
              contains: normalizedSearch,
              mode: 'insensitive' as const,
            },
          },
          {
            shortDescription: {
              contains: normalizedSearch,
              mode: 'insensitive' as const,
            },
          },
          {
            description: {
              contains: normalizedSearch,
              mode: 'insensitive' as const,
            },
          },
          {
            badge: {
              contains: normalizedSearch,
              mode: 'insensitive' as const,
            },
          },
        ],
      }),
    };

    const skip = (page - 1) * limit;
    const orderBy = this.buildOrderBy(
      sortBy,
      sortDirection,
    );

    const [tickets, totalItems] =
      await this.prisma.$transaction([
        this.prisma.ticketPreview.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            event: {
              select: {
                id: true,
                title: true,
                slug: true,
                date: true,
                location: true,
                status: true,
                ticketProvider: true,
                ticketPurchaseUrl: true,
              },
            },
            benefits: {
              orderBy: {
                sortOrder: 'asc',
              },
            },
          },
        }),

        this.prisma.ticketPreview.count({
          where,
        }),
      ]);

    const totalPages = Math.ceil(
      totalItems / limit,
    );

    return {
      data: tickets,
      meta: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(id: number) {
    const ticket =
      await this.prisma.ticketPreview.findUnique({
        where: {
          id,
        },
        include: {
          event: {
            select: {
              id: true,
              title: true,
              slug: true,
              description: true,
              date: true,
              location: true,
              status: true,
              ticketProvider: true,
              ticketPurchaseUrl: true,
              externalEventId: true,
            },
          },
          benefits: {
            orderBy: {
              sortOrder: 'asc',
            },
          },
        },
      });

    if (!ticket) {
      throw new NotFoundException(
        `Ticket with ID ${id} was not found.`,
      );
    }

    return ticket;
  }

  private async ensureEventExists(
    eventId: number,
  ): Promise<void> {
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

  private async ensureSlugIsAvailable(
    eventId: number,
    slug: string,
  ): Promise<void> {
    const normalizedSlug =
      this.normalizeSlug(slug);

    const existingTicket =
      await this.prisma.ticketPreview.findFirst({
        where: {
          eventId,
          slug: normalizedSlug,
        },
        select: {
          id: true,
        },
      });

    if (existingTicket) {
      throw new ConflictException(
        'A ticket with this slug already exists for the selected event.',
      );
    }
  }

  private validatePricing(
    dto: CreateTicketPreviewDto,
  ): void {
    if (
      dto.originalPrice !== undefined &&
      dto.originalPrice < dto.price
    ) {
      throw new BadRequestException(
        'Original price must be greater than or equal to the current price.',
      );
    }
  }

  private validateQuantities(
    dto: CreateTicketPreviewDto,
  ): void {
    if (
      dto.totalQuantity !== undefined &&
      dto.remainingQuantity !== undefined &&
      dto.remainingQuantity >
        dto.totalQuantity
    ) {
      throw new BadRequestException(
        'Remaining quantity cannot be greater than total quantity.',
      );
    }
  }

  private validateOrderLimits(
    dto: CreateTicketPreviewDto,
  ): void {
    if (
      dto.minimumPerOrder !== undefined &&
      dto.maximumPerOrder !== undefined &&
      dto.minimumPerOrder >
        dto.maximumPerOrder
    ) {
      throw new BadRequestException(
        'Minimum tickets per order cannot be greater than the maximum.',
      );
    }

    if (
      dto.totalQuantity !== undefined &&
      dto.maximumPerOrder !== undefined &&
      dto.maximumPerOrder >
        dto.totalQuantity
    ) {
      throw new BadRequestException(
        'Maximum tickets per order cannot exceed the total quantity.',
      );
    }
  }

  private validateSaleDates(
    dto: CreateTicketPreviewDto,
  ): void {
    if (
      !dto.saleStartsAt ||
      !dto.saleEndsAt
    ) {
      return;
    }

    const saleStartsAt = new Date(
      dto.saleStartsAt,
    );
    const saleEndsAt = new Date(
      dto.saleEndsAt,
    );

    if (saleStartsAt >= saleEndsAt) {
      throw new BadRequestException(
        'Sale end date must be later than the sale start date.',
      );
    }
  }

  private buildOrderBy(
    sortBy: TicketSortField,
    sortDirection: SortDirection,
  ) {
    switch (sortBy) {
      case TicketSortField.CREATED_AT:
        return {
          createdAt: sortDirection,
        };

      case TicketSortField.UPDATED_AT:
        return {
          updatedAt: sortDirection,
        };

      case TicketSortField.NAME:
        return {
          name: sortDirection,
        };

      case TicketSortField.PRICE:
        return {
          price: sortDirection,
        };

      case TicketSortField.SALE_STARTS_AT:
        return {
          saleStartsAt: sortDirection,
        };

      case TicketSortField.SALE_ENDS_AT:
        return {
          saleEndsAt: sortDirection,
        };

      case TicketSortField.SORT_ORDER:
      default:
        return {
          sortOrder: sortDirection,
        };
    }
  }

  private normalizeSlug(value: string): string {
    return value.trim().toLowerCase();
  }

  private normalizeOptionalText(
    value: string | undefined,
  ): string | undefined {
    const normalizedValue = value?.trim();

    return normalizedValue || undefined;
  }

  private getPrismaErrorCode(
    error: unknown,
  ): string | undefined {
    if (
      typeof error !== 'object' ||
      error === null ||
      !('code' in error)
    ) {
      return undefined;
    }

    const prismaError =
      error as PrismaErrorLike;

    return typeof prismaError.code ===
      'string'
      ? prismaError.code
      : undefined;
  }
}