import {
  Controller,
  Get,
} from "@nestjs/common";

import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

import { ExperiencePageResponseDto } from "./dto/experience-response.dto.js";
import { ExperienceService } from "./experience.service.js";

@ApiTags("Public Experience")
@Controller("experience")
export class ExperienceController {
  constructor(
    private readonly experienceService: ExperienceService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      "Get the published Experience page",
    description:
      "Returns the latest published Experience page with visible highlights and visible images. Featured images are returned first.",
  })
  @ApiOkResponse({
    description:
      "Published Experience page returned successfully.",
    type: ExperiencePageResponseDto,
  })
  @ApiNotFoundResponse({
    description:
      "No published Experience page exists.",
  })
  findPublicPage() {
    return this.experienceService.findPublicPage();
  }
}