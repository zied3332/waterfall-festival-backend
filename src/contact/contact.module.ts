import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { AdminMessagesController } from './admin-messages.controller.js';
import { ContactController } from './contact.controller.js';
import { ContactService } from './contact.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ContactController, AdminMessagesController],
  providers: [ContactService],
})
export class ContactModule {}
