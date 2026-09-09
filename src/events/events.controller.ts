import {
  Controller,
  Get,
  Param,
} from '@nestjs/common';

import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { EventResponseDto } from './dto/event-response.dto.js';

import { EventsService } from './events.service.js';

@ApiTags('Public Events')
@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'List all published events',
    description:
      'Returns the events that are available on the public website. Draft, cancelled and other non-public events are excluded according to the service rules.',
  })
  @ApiOkResponse({
    description:
      'Published events returned successfully.',
    type: EventResponseDto,
    isArray: true,
  })
  findAll() {
    return this.eventsService.findAll();
  }

  @Get('homepage')
  @ApiOperation({
    summary:
      'Get the event currently displayed on the homepage',
    description:
      'Returns the event that should currently be used by the homepage, including automatic or manual event-selection information.',
  })
  @ApiOkResponse({
    description:
      'Homepage event returned successfully.',
  })
  getHomepageEvent() {
    return this.eventsService.getHomepageEvent();
  }

  @Get(':slug')
  @ApiOperation({
    summary:
      'Get a published event by slug',
    description:
      'Returns one publicly available event using its URL-friendly slug.',
  })
  @ApiParam({
    name: 'slug',
    type: String,
    required: true,
    example:
      'waterfall-full-moon-festival',
    description:
      'Unique URL-friendly event identifier.',
  })
  @ApiOkResponse({
    description:
      'Published event returned successfully.',
    type: EventResponseDto,
  })
  @ApiNotFoundResponse({
    description:
      'The event does not exist or is not publicly available.',
  })
  findBySlug(
    @Param('slug')
    slug: string,
  ) {
    return this.eventsService.findBySlug(
      slug,
    );
  }
}