import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import {
  FileInterceptor,
} from '@nestjs/platform-express';

import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import {
  Roles,
} from '../auth/decorators/roles.decorator.js';

import {
  JwtAuthGuard,
} from '../auth/guards/jwt-auth.guard.js';

import {
  RolesGuard,
} from '../auth/guards/roles.guard.js';

import {
  UserRole,
} from '../generated/prisma/enums.js';

import {
  CreateEventDto,
} from './dto/create-event.dto.js';

import {
  EventResponseDto,
} from './dto/event-response.dto.js';

import {
  UpdateEventDto,
} from './dto/update-event.dto.js';

import {
  UpdateHomepageEventSettingsDto,
} from './dto/update-homepage-event-settings.dto.js';

import {
  EventsService,
} from './events.service.js';

const MAX_HERO_IMAGE_SIZE =
  5 * 1024 * 1024;

const ALLOWED_HERO_IMAGE_MIME_TYPES =
  new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
  ]);

@ApiTags('Admin Events')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  description:
    'A valid administrator JWT access token is required.',
})
@ApiForbiddenResponse({
  description:
    'The authenticated user does not have administrator permission.',
})
@Controller('admin/events')
@UseGuards(
  JwtAuthGuard,
  RolesGuard,
)
@Roles(UserRole.ADMIN)
export class AdminEventsController {
  constructor(
    private readonly eventsService: EventsService,
  ) {}

  /*
   * ============================================================
   * CREATE EVENT
   * ============================================================
   */

  @Post()
  @ApiOperation({
    summary: 'Create an event',
    description:
      'Creates a new festival event. The event date cannot be before the current festival day, and remaining tickets cannot exceed capacity.',
  })
  @ApiCreatedResponse({
    description:
      'Event created successfully.',
    type: EventResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'The request body is invalid or violates an event business rule.',
  })
  create(
    @Body()
    createEventDto: CreateEventDto,
  ) {
    return this.eventsService.create(
      createEventDto,
    );
  }

  /*
   * ============================================================
   * LIST EVENTS
   * ============================================================
   */

  @Get()
  @ApiOperation({
    summary:
      'List all events for administration',
    description:
      'Returns all events, including draft, published, cancelled and completed events.',
  })
  @ApiOkResponse({
    description:
      'Admin event list returned successfully.',
    type: EventResponseDto,
    isArray: true,
  })
  findAll() {
    return this.eventsService.findAllForAdmin();
  }

  /*
   * ============================================================
   * HOMEPAGE EVENT SETTINGS
   * ============================================================
   *
   * IMPORTANT:
   * These static routes must stay before @Get(':id').
   *
   * Otherwise Nest could interpret "homepage-settings"
   * as an event ID.
   * ============================================================
   */

  @Get('homepage-settings')
  @ApiOperation({
    summary:
      'Get homepage event settings',
    description:
      'Returns the configured homepage event mode, automatic switch delay, manually selected event and the event currently resolved for the homepage.',
  })
  @ApiOkResponse({
    description:
      'Homepage event settings returned successfully.',
  })
  getHomepageEventSettings() {
    return this.eventsService.getHomepageEventSettingsForAdmin();
  }

  @Patch('homepage-settings')
  @ApiOperation({
    summary:
      'Update homepage event settings',
    description:
      'Changes the homepage event mode between AUTO and MANUAL, changes the automatic switch delay, or selects the event used in MANUAL mode.',
  })
  @ApiOkResponse({
    description:
      'Homepage event settings updated successfully.',
  })
  @ApiBadRequestResponse({
    description:
      'The homepage settings are invalid, or MANUAL mode does not have a valid published event.',
  })
  @ApiNotFoundResponse({
    description:
      'The manually selected event does not exist.',
  })
  updateHomepageEventSettings(
    @Body()
    dto: UpdateHomepageEventSettingsDto,
  ) {
    return this.eventsService.updateHomepageEventSettings(
      dto,
    );
  }

  /*
   * ============================================================
   * GET ONE EVENT
   * ============================================================
   */

  @Get(':id')
  @ApiOperation({
    summary:
      'Get an event by numeric ID',
    description:
      'Returns one event for viewing or editing in the administration dashboard.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
    example: 12,
    description:
      'Unique numeric event identifier.',
  })
  @ApiOkResponse({
    description:
      'Event returned successfully.',
    type: EventResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'The supplied event ID is not a valid integer.',
  })
  @ApiNotFoundResponse({
    description:
      'No event exists with the supplied ID.',
  })
  findOne(
    @Param(
      'id',
      ParseIntPipe,
    )
    id: number,
  ) {
    return this.eventsService.findOneForAdmin(
      id,
    );
  }

  /*
   * ============================================================
   * HERO IMAGE
   * ============================================================
   */

  @Patch(':id/hero-image')
  @ApiOperation({
    summary:
      'Upload or replace an event hero image',
    description:
      'Uploads a JPG, PNG, WebP or AVIF image. The maximum allowed file size is 5 MB. If the event already has a hero image, the existing image is replaced.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
    example: 12,
    description:
      'Unique numeric event identifier.',
  })
  @ApiConsumes(
    'multipart/form-data',
  )
  @ApiBody({
    required: true,
    schema: {
      type: 'object',
      required: [
        'image',
      ],
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description:
            'JPG, PNG, WebP or AVIF hero image. Maximum size: 5 MB.',
        },
      },
    },
  })
  @ApiOkResponse({
    description:
      'Hero image uploaded successfully.',
    type: EventResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'No image was supplied, the ID is invalid, or the image format is unsupported.',
  })
  @ApiPayloadTooLargeResponse({
    description:
      'The uploaded image exceeds the 5 MB size limit.',
  })
  @ApiNotFoundResponse({
    description:
      'No event exists with the supplied ID.',
  })
  @UseInterceptors(
    FileInterceptor(
      'image',
      {
        limits: {
          fileSize:
            MAX_HERO_IMAGE_SIZE,
          files: 1,
        },

        fileFilter: (
          _request,
          file,
          callback,
        ) => {
          if (
            !ALLOWED_HERO_IMAGE_MIME_TYPES.has(
              file.mimetype,
            )
          ) {
            callback(
              new BadRequestException(
                'Only JPG, PNG, WebP and AVIF images are allowed.',
              ),
              false,
            );

            return;
          }

          callback(
            null,
            true,
          );
        },
      },
    ),
  )
  uploadHeroImage(
    @Param(
      'id',
      ParseIntPipe,
    )
    id: number,

    @UploadedFile()
    file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        'An event hero image is required.',
      );
    }

    return this.eventsService.uploadHeroImage(
      id,
      file,
    );
  }

  /*
   * ============================================================
   * UPDATE EVENT
   * ============================================================
   */

  @Patch(':id')
  @ApiOperation({
    summary:
      'Update an event',
    description:
      'Updates one or more event fields. Fields not included in the request body remain unchanged.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
    example: 12,
    description:
      'Unique numeric event identifier.',
  })
  @ApiOkResponse({
    description:
      'Event updated successfully.',
    type: EventResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'The supplied ID, request body or event values are invalid.',
  })
  @ApiNotFoundResponse({
    description:
      'No event exists with the supplied ID.',
  })
  update(
    @Param(
      'id',
      ParseIntPipe,
    )
    id: number,

    @Body()
    updateEventDto: UpdateEventDto,
  ) {
    return this.eventsService.update(
      id,
      updateEventDto,
    );
  }

  /*
   * ============================================================
   * DELETE EVENT
   * ============================================================
   */

  @Delete(':id')
  @ApiOperation({
    summary:
      'Delete an event',
    description:
      'Deletes the event from the database and performs any configured hero-image cleanup.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
    example: 12,
    description:
      'Unique numeric event identifier.',
  })
  @ApiOkResponse({
    description:
      'Event deleted successfully.',
  })
  @ApiBadRequestResponse({
    description:
      'The supplied event ID is not a valid integer.',
  })
  @ApiNotFoundResponse({
    description:
      'No event exists with the supplied ID.',
  })
  remove(
    @Param(
      'id',
      ParseIntPipe,
    )
    id: number,
  ) {
    return this.eventsService.remove(
      id,
    );
  }
}