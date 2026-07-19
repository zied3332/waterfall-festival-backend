import { Injectable, NotFoundException } from '@nestjs/common';

import { MessageStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateContactMessageDto } from './dto/create-contact-message.dto.js';
import { UpdateMessageStatusDto } from './dto/update-message-status.dto.js';

@Injectable()
export class ContactService {
  constructor(private readonly prisma: PrismaService) {}

  create(createContactMessageDto: CreateContactMessageDto) {
    return this.prisma.contactMessage.create({
      data: {
        name: createContactMessageDto.name.trim(),
        email: createContactMessageDto.email.trim().toLowerCase(),
        phone: createContactMessageDto.phone?.trim(),
        subject: createContactMessageDto.subject?.trim(),
        message: createContactMessageDto.message.trim(),
      },
    });
  }

  findAll(status?: MessageStatus) {
    return this.prisma.contactMessage.findMany({
      where: status ? { status } : undefined,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: number) {
    const contactMessage = await this.prisma.contactMessage.findUnique({
      where: { id },
    });

    if (!contactMessage) {
      throw new NotFoundException('Contact message not found');
    }

    return contactMessage;
  }

  async updateStatus(
    id: number,
    updateMessageStatusDto: UpdateMessageStatusDto,
  ) {
    await this.findOne(id);

    return this.prisma.contactMessage.update({
      where: { id },
      data: {
        status: updateMessageStatusDto.status,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    await this.prisma.contactMessage.delete({
      where: { id },
    });

    return {
      message: 'Contact message deleted successfully',
    };
  }
}
