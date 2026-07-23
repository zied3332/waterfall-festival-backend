import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { UserRole } from '../generated/prisma/enums.js';
import { ContactService } from './contact.service.js';
import { QueryContactMessagesDto } from './dto/query-contact-messages.dto.js';
import { UpdateContactMessageDto } from './dto/update-contact-message.dto.js';

@Controller('admin/messages')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminMessagesController {
  constructor(private readonly contactService: ContactService) {}

  @Get()
  findAll(@Query() query: QueryContactMessagesDto) {
    return this.contactService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.contactService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateContactMessageDto: UpdateContactMessageDto,
  ) {
    return this.contactService.update(id, updateContactMessageDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.contactService.remove(id);
  }
}