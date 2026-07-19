import { IsEnum } from 'class-validator';

import { MessageStatus } from '../../generated/prisma/enums.js';

export class UpdateMessageStatusDto {
  @IsEnum(MessageStatus)
  status!: MessageStatus;
}
