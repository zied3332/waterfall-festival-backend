import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  TicketCategory,
  TicketStatus,
} from '../../generated/prisma/enums.js';

export enum TicketSortField {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  NAME = 'name',
  PRICE = 'price',
  SALE_STARTS_AT = 'saleStartsAt',
  SALE_ENDS_AT = 'saleEndsAt',
  SORT_ORDER = 'sortOrder',
}

export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

function transformBoolean({
  value,
}: {
  value: unknown;
}): unknown {
  if (value === true || value === 'true') {
    return true;
  }

  if (value === false || value === 'false') {
    return false;
  }

  return value;
}

export class TicketQueryDto {
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsEnum(TicketCategory)
  category?: TicketCategory;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  eventId?: number;

  @IsOptional()
  @Transform(transformBoolean)
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @IsEnum(TicketSortField)
  sortBy: TicketSortField = TicketSortField.SORT_ORDER;

  @IsOptional()
  @IsEnum(SortDirection)
  sortDirection: SortDirection = SortDirection.ASC;
}