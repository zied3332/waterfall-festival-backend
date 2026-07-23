import { Injectable, NotFoundException } from '@nestjs/common';

import { Prisma } from '../generated/prisma/client.js';
import {
  NotificationPriority,
  NotificationType,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateNotificationDto } from './dto/create-notification.dto.js';
import { QueryNotificationsDto } from './dto/query-notifications.dto.js';
import { UpdateNotificationDto } from './dto/update-notification.dto.js';

type CreateContactNotificationInput = {
  contactMessageId: number;
  senderName: string;
  subject?: string | null;
  priority?: NotificationPriority;
};

type CreateEventNotificationInput = {
  eventId: number;
  eventTitle: string;
  action: 'created' | 'updated' | 'published' | 'cancelled';
  priority?: NotificationPriority;
};

type CreateGalleryNotificationInput = {
  galleryImageId: number;
  imageTitle: string;
  action: 'uploaded' | 'updated' | 'published' | 'archived';
  priority?: NotificationPriority;
};

type CreateFaqNotificationInput = {
  faqId: number;
  question: string;
  action: 'created' | 'updated' | 'published' | 'archived';
  priority?: NotificationPriority;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createNotificationDto: CreateNotificationDto) {
    return this.createNotification(createNotificationDto);
  }

  createNotification(createNotificationDto: CreateNotificationDto) {
    return this.prisma.notification.create({
      data: {
        title: createNotificationDto.title,
        message: createNotificationDto.message,
        type: createNotificationDto.type,
        priority:
          createNotificationDto.priority ?? NotificationPriority.NORMAL,
        link: createNotificationDto.link,
        contactMessageId: createNotificationDto.contactMessageId,
      },
    });
  }

  createContactNotification(input: CreateContactNotificationInput) {
    const subjectText = input.subject
      ? ` Subject: ${input.subject}.`
      : '';

    return this.createNotification({
      title: 'New contact message',
      message: `${input.senderName} submitted a new contact message.${subjectText}`,
      type: NotificationType.CONTACT_MESSAGE,
      priority: input.priority ?? NotificationPriority.NORMAL,
      link: `/admin/messages/${input.contactMessageId}`,
      contactMessageId: input.contactMessageId,
    });
  }

  createEventNotification(input: CreateEventNotificationInput) {
    return this.createNotification({
      title: `Event ${input.action}`,
      message: `The event "${input.eventTitle}" was ${input.action}.`,
      type: NotificationType.EVENT,
      priority: input.priority ?? NotificationPriority.NORMAL,
      link: `/admin/events/${input.eventId}`,
    });
  }

  createGalleryNotification(input: CreateGalleryNotificationInput) {
    return this.createNotification({
      title: `Gallery image ${input.action}`,
      message: `The gallery image "${input.imageTitle}" was ${input.action}.`,
      type: NotificationType.GALLERY,
      priority: input.priority ?? NotificationPriority.NORMAL,
      link: `/admin/gallery/${input.galleryImageId}`,
    });
  }

  createFaqNotification(input: CreateFaqNotificationInput) {
    return this.createNotification({
      title: `FAQ ${input.action}`,
      message: `The FAQ "${input.question}" was ${input.action}.`,
      type: NotificationType.FAQ,
      priority: input.priority ?? NotificationPriority.NORMAL,
      link: `/admin/faq/${input.faqId}`,
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
  async getUnreadCount() {
  const unreadCount = await this.prisma.notification.count({
    where: {
      isRead: false,
    },
  });

  return {
    unreadCount,
  };
}

async getRecent(limit = 10) {
  const safeLimit = Math.min(Math.max(limit, 1), 20);

  const notifications = await this.prisma.notification.findMany({
    orderBy: {
      createdAt: 'desc',
    },
    take: safeLimit,
  });

  const unreadCount = await this.prisma.notification.count({
    where: {
      isRead: false,
    },
  });

  return {
    data: notifications,
    unreadCount,
  };
}

async markAsRead(id: number) {
  await this.findOne(id);

  return this.prisma.notification.update({
    where: {
      id,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
}
}