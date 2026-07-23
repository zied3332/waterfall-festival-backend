import { IsEnum, IsOptional } from 'class-validator';

import {
  MessageCategory,
  MessagePriority,
  MessageStatus,
} from '../../generated/prisma/enums.js';

export class UpdateContactMessageDto {
  @IsOptional()
  @IsEnum(MessageStatus)
  status?: MessageStatus;

  @IsOptional()
  @IsEnum(MessageCategory)
  category?: MessageCategory;

  @IsOptional()
  @IsEnum(MessagePriority)
  priority?: MessagePriority;
}