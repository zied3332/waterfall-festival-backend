import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';

import { TicketQueryDto } from './dto/ticket-query.dto.js';
import { TicketsService } from './tickets.service.js';

@Controller('tickets')
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
  ) {}

  @Get()
  findAll(
    @Query() query: TicketQueryDto,
  ) {
    return this.ticketsService.findAll(query);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.ticketsService.findOne(id);
  }
}