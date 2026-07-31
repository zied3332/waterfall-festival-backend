import {
  Body,
  Controller,
  Get,
  Patch,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { Roles } from "../auth/decorators/roles.decorator.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { UserRole } from "../generated/prisma/enums.js";
import { UpdateWebsiteSettingsDto } from "./dto/update-website-settings.dto.js";
import { WebsiteSettingsResponseDto } from "./dto/website-settings-response.dto.js";
import { SettingsService } from "./settings.service.js";

@ApiTags("Admin Settings")
@ApiBearerAuth("access-token")
@ApiUnauthorizedResponse({
  description:
    "A valid administrator JWT access token is required.",
})
@ApiForbiddenResponse({
  description:
    "The authenticated user does not have administrator permission.",
})
@Controller("admin/settings")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminSettingsController {
  constructor(
    private readonly settingsService: SettingsService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      "Get complete website settings",
    description:
      "Returns the complete editable website configuration for the administration dashboard.",
  })
  @ApiOkResponse({
    description:
      "Website settings returned successfully.",
    type: WebsiteSettingsResponseDto,
  })
  getSettings() {
    return this.settingsService.getAdminSettings();
  }

  @Patch()
  @ApiOperation({
    summary:
      "Update website settings",
    description:
      "Updates one or more global website settings. Fields that are not supplied remain unchanged.",
  })
  @ApiOkResponse({
    description:
      "Website settings updated successfully.",
    type: WebsiteSettingsResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "One or more settings are invalid, or the festival end date is before the start date.",
  })
  updateSettings(
    @Body()
    updateWebsiteSettingsDto: UpdateWebsiteSettingsDto,
  ) {
    return this.settingsService.updateSettings(
      updateWebsiteSettingsDto,
    );
  }
}