import {
  Controller,
  Get,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

import { PublicWebsiteSettingsResponseDto } from "./dto/public-website-settings-response.dto.js";
import { SettingsService } from "./settings.service.js";

@ApiTags("Public Settings")
@Controller("settings")
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
  ) {}

  @Get("public")
  @ApiOperation({
    summary:
      "Get public website settings",
    description:
      "Returns the global configuration used by the public Waterfall Festival website.",
  })
  @ApiOkResponse({
    description:
      "Public website settings returned successfully.",
    type: PublicWebsiteSettingsResponseDto,
  })
  getPublicSettings() {
    return this.settingsService.getPublicSettings();
  }
}