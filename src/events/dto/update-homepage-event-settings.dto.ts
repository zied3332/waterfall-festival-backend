import {
  ApiPropertyOptional,
} from "@nestjs/swagger";

import {
  IsEnum,
  IsInt,
  IsOptional,
  Min,
} from "class-validator";

import {
  HomepageEventMode,
} from "../../generated/prisma/enums.js";

export class UpdateHomepageEventSettingsDto {
  @ApiPropertyOptional({
    enum: HomepageEventMode,
    enumName: "HomepageEventMode",
    example:
      HomepageEventMode.AUTO,
    description:
      "AUTO selects the homepage event automatically. MANUAL uses the published event selected by the administrator.",
  })
  @IsOptional()
  @IsEnum(HomepageEventMode)
  homepageEventMode?: HomepageEventMode;

  @ApiPropertyOptional({
    example: 12,
    nullable: true,
    description:
      "Published event ID used in MANUAL mode. Send null to clear the manual event.",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  homepageManualEventId?: number | null;
}