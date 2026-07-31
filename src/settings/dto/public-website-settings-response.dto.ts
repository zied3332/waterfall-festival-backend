import {
  OmitType,
} from "@nestjs/swagger";

import { WebsiteSettingsResponseDto } from "./website-settings-response.dto.js";

export class PublicWebsiteSettingsResponseDto extends OmitType(
  WebsiteSettingsResponseDto,
  [
    "escalationEmail",
    "createdAt",
    "updatedAt",
  ] as const,
) {}