import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { MailModule } from '../mail/mail.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AdminMessagesController } from './admin-messages.controller.js';
import { ContactController } from './contact.controller.js';
import { ContactService } from './contact.service.js';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    MailModule,
    AuthModule,
  ],
  controllers: [
    ContactController,
    AdminMessagesController,
  ],
  providers: [ContactService],
})
export class ContactModule {}