import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';

import { EventStatus } from '../../generated/prisma/enums.js';

export class CreateEventDto {
  @ApiProperty({
    example:
      'Waterfall Full Moon Festival',
    description:
      'Public title displayed for the event.',
    minLength: 1,
  })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({
    example:
      'An immersive waterfall festival experience featuring music, performances and activities.',
    description:
      'Full public description of the event.',
    minLength: 1,
  })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({
    example:
      '2026-08-15T18:00:00.000Z',
    description:
      'Event date and time in ISO 8601 format. The date cannot be before the current festival day.',
    format: 'date-time',
  })
  @IsDateString()
  date!: string;

  @ApiProperty({
    example:
      'Koh Phangan, Thailand',
    description:
      'Location displayed for the event.',
    minLength: 1,
  })
  @IsString()
  @IsNotEmpty()
  location!: string;

  @ApiPropertyOptional({
    example:
      'https://res.cloudinary.com/example/image/upload/waterfall-festival/events/event.jpg',
    description:
      'Optional hero-image URL. Normally this is assigned through the dedicated hero-image upload endpoint.',
    format: 'uri',
  })
  @IsOptional()
  @IsUrl()
  heroImageUrl?: string;

  @ApiPropertyOptional({
    example: 1000,
    minimum: 1,
    description:
      'Maximum number of visitors allowed for the event.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional({
    example: 800,
    minimum: 0,
    description:
      'Current number of tickets remaining. It cannot exceed the event capacity.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  remainingTickets?: number;

  @ApiPropertyOptional({
    enum: EventStatus,
    enumName: 'EventStatus',
    example: EventStatus.DRAFT,
    default: EventStatus.DRAFT,
    description:
      'Publishing and lifecycle status of the event.',
  })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;
}