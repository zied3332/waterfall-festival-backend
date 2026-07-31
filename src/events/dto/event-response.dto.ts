import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

import { EventStatus } from '../../generated/prisma/enums.js';

export class EventResponseDto {
  @ApiProperty({
    example: 12,
    description:
      'Unique numeric identifier of the event.',
  })
  id!: number;

  @ApiProperty({
    example:
      'Waterfall Full Moon Festival',
  })
  title!: string;

  @ApiProperty({
    example:
      'waterfall-full-moon-festival',
    description:
      'Unique URL-friendly identifier.',
  })
  slug!: string;

  @ApiProperty({
    example:
      'An immersive waterfall festival experience featuring music and performances.',
  })
  description!: string;

  @ApiProperty({
    example:
      '2026-08-15T18:00:00.000Z',
    format: 'date-time',
  })
  date!: Date;

  @ApiProperty({
    example:
      'Koh Phangan, Thailand',
  })
  location!: string;

  @ApiPropertyOptional({
    example:
      'https://res.cloudinary.com/example/image/upload/waterfall-festival/events/event.jpg',
    nullable: true,
    format: 'uri',
  })
  heroImageUrl!: string | null;

  @ApiPropertyOptional({
    example:
      'waterfall-festival/events/event-public-id',
    nullable: true,
    description:
      'Cloudinary public identifier associated with the hero image.',
  })
  heroImagePublicId!: string | null;

  @ApiPropertyOptional({
    example: 1000,
    nullable: true,
    minimum: 1,
  })
  capacity!: number | null;

  @ApiPropertyOptional({
    example: 800,
    nullable: true,
    minimum: 0,
  })
  remainingTickets!: number | null;

  @ApiProperty({
    enum: EventStatus,
    enumName: 'EventStatus',
    example: EventStatus.PUBLISHED,
  })
  status!: EventStatus;

  @ApiProperty({
    example:
      '2026-07-31T08:00:00.000Z',
    format: 'date-time',
  })
  createdAt!: Date;

  @ApiProperty({
    example:
      '2026-07-31T08:30:00.000Z',
    format: 'date-time',
  })
  updatedAt!: Date;
}