import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AdminMessagesController } from './admin-messages.controller.js';
import { ContactController } from './contact.controller.js';
import { ContactService } from './contact.service.js';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    AuthModule,
  ],
  controllers: [ContactController, AdminMessagesController],
  providers: [ContactService],
  exports: [ContactService],
})
export class ContactModule {}