import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  TicketAvailabilityMode,
  TicketCategory,
  TicketStatus,
} from '../../generated/prisma/enums.js';

import { CreateTicketBenefitDto } from './create-ticket-benefit.dto.js';

export class CreateTicketPreviewDto {
  @IsInt()
  @IsPositive()
  eventId!: number;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(150)
  slug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  shortDescription?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(TicketCategory)
  category?: TicketCategory;

  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Price must have at most 2 decimal places.' },
  )
  @Min(0)
  price!: number;

  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Original price must have at most 2 decimal places.' },
  )
  @Min(0)
  originalPrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @IsEnum(TicketAvailabilityMode)
  availabilityMode?: TicketAvailabilityMode;

  @IsOptional()
  @IsInt()
  @Min(0)
  totalQuantity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  remainingQuantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  availabilityLabel?: string;

  @IsOptional()
  @IsDateString()
  saleStartsAt?: string;

  @IsOptional()
  @IsDateString()
  saleEndsAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  minimumPerOrder?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maximumPerOrder?: number;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  externalPurchaseUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  externalTicketId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  badge?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CreateTicketBenefitDto)
  benefits?: CreateTicketBenefitDto[];
}