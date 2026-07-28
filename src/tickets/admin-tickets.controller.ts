import {
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';

import { UserRole } from '../generated/prisma/enums.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CreateTicketPreviewDto } from './dto/create-ticket-preview.dto.js';
import { TicketsService } from './tickets.service.js';

@Controller('admin/tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminTicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
  ) {}

  @Post()
  create(
    @Body() dto: CreateTicketPreviewDto,
  ) {
    return this.ticketsService.create(dto);
  }
}