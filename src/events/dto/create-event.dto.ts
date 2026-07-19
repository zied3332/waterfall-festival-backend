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
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsDateString()
  date!: string;

  @IsString()
  @IsNotEmpty()
  location!: string;

  @IsOptional()
  @IsUrl()
  heroImageUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  remainingTickets?: number;

  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;
}
