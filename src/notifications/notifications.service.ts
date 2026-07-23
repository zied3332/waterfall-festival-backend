import { Injectable, NotFoundException } from '@nestjs/common';

import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateNotificationDto } from './dto/create-notification.dto.js';
import { QueryNotificationsDto } from './dto/query-notifications.dto.js';
import { UpdateNotificationDto } from './dto/update-notification.dto.js';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createNotificationDto: CreateNotificationDto) {
    return this.prisma.notification.create({
      data: {
        title: createNotificationDto.title,
        message: createNotificationDto.message,
        type: createNotificationDto.type,
        priority: createNotificationDto.priority,
        link: createNotificationDto.link,
        contactMessageId: createNotificationDto.contactMessageId,
      },
    });
  }

  async findAll(query: QueryNotificationsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = {
      ...(query.type && {
        type: query.type,
      }),

      ...(query.priority && {
        priority: query.priority,
      }),

      ...(query.isRead !== undefined && {
        isRead: query.isRead,
      }),

      ...(query.search && {
        OR: [
          {
            title: {
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
          {
            link: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
        ],
      }),
    };

    const [notifications, total, unreadCount] =
      await this.prisma.$transaction([
        this.prisma.notification.findMany({
          where,
          orderBy: {
            createdAt: 'desc',
          },
          skip,
          take: limit,
        }),

        this.prisma.notification.count({
          where,
        }),

        this.prisma.notification.count({
          where: {
            isRead: false,
          },
        }),
      ]);

    return {
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      unreadCount,
    };
  }

  async findOne(id: number) {
    const notification = await this.prisma.notification.findUnique({
      where: {
        id,
      },
    });

    if (!notification) {
      throw new NotFoundException(
        `Notification with ID ${id} was not found`,
      );
    }

    return notification;
  }

  async update(
    id: number,
    updateNotificationDto: UpdateNotificationDto,
  ) {
    await this.findOne(id);

    const data: Prisma.NotificationUpdateInput = {
      ...(updateNotificationDto.title !== undefined && {
        title: updateNotificationDto.title,
      }),

      ...(updateNotificationDto.message !== undefined && {
        message: updateNotificationDto.message,
      }),

      ...(updateNotificationDto.type !== undefined && {
        type: updateNotificationDto.type,
      }),

      ...(updateNotificationDto.priority !== undefined && {
        priority: updateNotificationDto.priority,
      }),

      ...(updateNotificationDto.link !== undefined && {
        link: updateNotificationDto.link,
      }),
    };

    if (updateNotificationDto.isRead !== undefined) {
      data.isRead = updateNotificationDto.isRead;
      data.readAt = updateNotificationDto.isRead ? new Date() : null;
    }

    return this.prisma.notification.update({
      where: {
        id,
      },
      data,
    });
  }

  async markAllAsRead() {
    const result = await this.prisma.notification.updateMany({
      where: {
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return {
      message: 'All notifications marked as read',
      updatedCount: result.count,
    };
  }

  async remove(id: number) {
    await this.findOne(id);

    await this.prisma.notification.delete({
      where: {
        id,
      },
    });

    return {
      message: 'Notification deleted successfully',
    };
  }
}