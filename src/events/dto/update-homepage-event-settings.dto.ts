import {
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

import {
  HomepageEventMode,
} from '../../generated/prisma/enums.js';

export class UpdateHomepageEventSettingsDto {
  @ApiPropertyOptional({
    enum: HomepageEventMode,
    enumName: 'HomepageEventMode',
    example: HomepageEventMode.AUTO,
    description:
      'AUTO automatically selects the current or next published event. MANUAL uses the event selected by the administrator.',
  })
  @IsOptional()
  @IsEnum(HomepageEventMode)
  homepageEventMode?: HomepageEventMode;

  @ApiPropertyOptional({
    example: 8,
    minimum: 0,
    maximum: 72,
    description:
      'Number of hours after an event starts before automatic mode switches to the next published event.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(72)
  homepageAutoSwitchHours?: number;

  @ApiPropertyOptional({
    example: 12,
    nullable: true,
    description:
      'Event ID used in MANUAL mode. Send null to clear the manual event.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  homepageManualEventId?: number | null;
}