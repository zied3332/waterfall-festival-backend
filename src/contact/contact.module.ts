import { Module } from '@nestjs/common';

import { AdminMessagesController } from './admin-messages.controller.js';
import { ContactController } from './contact.controller.js';
import { ContactService } from './contact.service.js';

@Module({
  controllers: [ContactController, AdminMessagesController],
  providers: [ContactService],
})
export class ContactModule {}
