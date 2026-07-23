import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';

import { ContactService } from './contact.service.js';
import { CreateContactMessageDto } from './dto/create-contact-message.dto.js';

@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createContactMessageDto: CreateContactMessageDto,
  ) {
    const contactMessage = await this.contactService.create(
      createContactMessageDto,
    );

    return {
      message: 'Your message was sent successfully',
      data: {
        id: contactMessage.id,
        createdAt: contactMessage.createdAt,
      },
    };
  }
}