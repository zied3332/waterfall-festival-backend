import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { EventStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateEventDto } from './dto/create-event.dto.js';
import { UpdateEventDto } from './dto/update-event.dto.js';
@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.event.findMany({
      where: {
        status: EventStatus.PUBLISHED,
      },
      orderBy: {
        date: 'asc',
      },
    });
  }

  async findBySlug(slug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug },
    });

    if (!event || event.status !== EventStatus.PUBLISHED) {
      throw new NotFoundException('Event not found');
    }

    return event;
  }

  async create(createEventDto: CreateEventDto) {
    const slug = this.createSlug(createEventDto.title);

    const existingEvent = await this.prisma.event.findUnique({
      where: { slug },
    });

    if (existingEvent) {
      throw new ConflictException(
        'An event with a similar title already exists',
      );
    }

    return this.prisma.event.create({
      data: {
        ...createEventDto,
        slug,
        date: new Date(createEventDto.date),
      },
    });
  }

  private createSlug(title: string): string {
    return title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  async update(id: number, updateEventDto: UpdateEventDto) {
    const existingEvent = await this.prisma.event.findUnique({
      where: { id },
    });

    if (!existingEvent) {
      throw new NotFoundException('Event not found');
    }

    let slug = existingEvent.slug;

    if (updateEventDto.title) {
      slug = this.createSlug(updateEventDto.title);

      const eventWithSameSlug = await this.prisma.event.findFirst({
        where: {
          slug,
          NOT: {
            id,
          },
        },
      });

      if (eventWithSameSlug) {
        throw new ConflictException(
          'An event with a similar title already exists',
        );
      }
    }

    return this.prisma.event.update({
      where: { id },
      data: {
        ...updateEventDto,
        slug,
        ...(updateEventDto.date && {
          date: new Date(updateEventDto.date),
        }),
      },
    });
  }

  async remove(id: number) {
    const existingEvent = await this.prisma.event.findUnique({
      where: { id },
    });

    if (!existingEvent) {
      throw new NotFoundException('Event not found');
    }

    await this.prisma.event.delete({
      where: { id },
    });

    return {
      message: 'Event deleted successfully',
    };
  }
  findAllForAdmin() {
    return this.prisma.event.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
