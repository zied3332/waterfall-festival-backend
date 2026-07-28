import { Module } from '@nestjs/common';

import { MailModule } from '../mail/mail.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ContactController } from './contact.controller.js';
import { ContactService } from './contact.service.js';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    MailModule,
  ],
  controllers: [ContactController],
  providers: [ContactService],
})
export class ContactModule {}