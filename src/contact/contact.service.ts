import { Injectable, NotFoundException } from '@nestjs/common';

import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateContactMessageDto } from './dto/create-contact-message.dto.js';
import { QueryContactMessagesDto } from './dto/query-contact-messages.dto.js';
import { UpdateContactMessageDto } from './dto/update-contact-message.dto.js';
import { NotificationsService } from '../notifications/notifications.service.js';
@Injectable()
export class ContactService {
constructor(
  private readonly prisma: PrismaService,
  private readonly notificationsService: NotificationsService,
) {}

async create(createContactMessageDto: CreateContactMessageDto) {
  const contactMessage = await this.prisma.contactMessage.create({
    data: {
      name: createContactMessageDto.name,
      email: createContactMessageDto.email,
      phone: createContactMessageDto.phone,
      subject: createContactMessageDto.subject,
      message: createContactMessageDto.message,
    },
  });

  await this.notificationsService.createContactNotification({
    contactMessageId: contactMessage.id,
    senderName: contactMessage.name,
    subject: contactMessage.subject,
  });

  return contactMessage;
}

  async findAll(query: QueryContactMessagesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ContactMessageWhereInput = {
      ...(query.status && {
        status: query.status,
      }),

      ...(query.category && {
        category: query.category,
      }),

      ...(query.priority && {
        priority: query.priority,
      }),

      ...(query.search && {
        OR: [
          {
            name: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
          {
            email: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
          {
            phone: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
          {
            subject: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
          {
            message: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
        ],
      }),
    };

    const [messages, total] = await this.prisma.$transaction([
      this.prisma.contactMessage.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),

      this.prisma.contactMessage.count({
        where,
      }),
    ]);

    return {
      data: messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number) {
    const contactMessage = await this.prisma.contactMessage.findUnique({
      where: {
        id,
      },
    });

    if (!contactMessage) {
      throw new NotFoundException(
        `Contact message with ID ${id} was not found`,
      );
    }

    return contactMessage;
  }

  async update(
    id: number,
    updateContactMessageDto: UpdateContactMessageDto,
  ) {
    await this.findOne(id);

    return this.prisma.contactMessage.update({
      where: {
        id,
      },
      data: updateContactMessageDto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    await this.prisma.contactMessage.delete({
      where: {
        id,
      },
    });

    return {
      message: 'Contact message deleted successfully',
    };
  }
}