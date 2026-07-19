import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { MessageStatus } from '../generated/prisma/enums.js';
import { ContactService } from './contact.service.js';
import { UpdateMessageStatusDto } from './dto/update-message-status.dto.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';

@Roles(UserRole.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/messages')
export class AdminMessagesController {
  constructor(private readonly contactService: ContactService) {}

  @Get()
  findAll(
    @Query(
      'status',
      new ParseEnumPipe(MessageStatus, {
        optional: true,
      }),
    )
    status?: MessageStatus,
  ) {
    return this.contactService.findAll(status);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.contactService.findOne(id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateMessageStatusDto: UpdateMessageStatusDto,
  ) {
    return this.contactService.updateStatus(id, updateMessageStatusDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.contactService.remove(id);
  }
}
