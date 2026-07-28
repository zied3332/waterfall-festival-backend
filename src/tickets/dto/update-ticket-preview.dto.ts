import { PartialType } from '@nestjs/mapped-types';

import { CreateTicketPreviewDto } from './create-ticket-preview.dto.js';

export class UpdateTicketPreviewDto extends PartialType(
  CreateTicketPreviewDto,
) {}