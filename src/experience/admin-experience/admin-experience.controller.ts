import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";

import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { Roles } from "../../auth/decorators/roles.decorator.js";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../../auth/guards/roles.guard.js";

import { UserRole } from "../../generated/prisma/enums.js";

import { CreateExperienceHighlightDto } from "../dto/create-experience-highlight.dto.js";
import { CreateExperienceImageDto } from "../dto/create-experience-image.dto.js";
import { CreateExperiencePageDto } from "../dto/create-experience-page.dto.js";

import {
  DeleteExperienceResourceResponseDto,
  ExperienceHighlightResponseDto,
  ExperienceImageResponseDto,
  ExperiencePageResponseDto,
} from "../dto/experience-response.dto.js";

import { UpdateExperienceHighlightDto } from "../dto/update-experience-highlight.dto.js";
import { UpdateExperienceImageDto } from "../dto/update-experience-image.dto.js";
import { UpdateExperiencePageDto } from "../dto/update-experience-page.dto.js";

import { ExperienceService } from "../experience.service.js";

@ApiTags("Admin Experience")
@ApiBearerAuth("access-token")
@ApiUnauthorizedResponse({
  description:
    "A valid administrator JWT access token is required.",
})
@ApiForbiddenResponse({
  description:
    "The authenticated user does not have administrator permission.",
})
@Controller("admin/experience")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminExperienceController {
  constructor(
    private readonly experienceService: ExperienceService,
  ) {}

  /*
   * Experience page
   */

  @Get()
  @ApiOperation({
    summary:
      "Get the Experience page for administration",
    description:
      "Returns the latest Experience page with all highlights and images, including hidden content.",
  })
  @ApiOkResponse({
    description:
      "Experience page returned successfully. The response may be null when no page has been created.",
    type: ExperiencePageResponseDto,
  })
  findAdminPage() {
    return this.experienceService.findAdminPage();
  }

  @Post()
  @ApiOperation({
    summary: "Create an Experience page",
    description:
      "Creates a new Experience page. Highlights and images can be added through their dedicated endpoints after the page exists.",
  })
  @ApiCreatedResponse({
    description:
      "Experience page created successfully.",
    type: ExperiencePageResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "The request body contains invalid Experience page values.",
  })
  createPage(
    @Body()
    createExperiencePageDto: CreateExperiencePageDto,
  ) {
    return this.experienceService.createPage(
      createExperiencePageDto,
    );
  }

  @Patch()
  @ApiOperation({
    summary: "Update the Experience page",
    description:
      "Updates the latest Experience page. Fields not included in the body remain unchanged.",
  })
  @ApiOkResponse({
    description:
      "Experience page updated successfully.",
    type: ExperiencePageResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "The request body contains invalid Experience page values.",
  })
  @ApiNotFoundResponse({
    description:
      "No Experience page exists to update.",
  })
  updatePage(
    @Body()
    updateExperiencePageDto: UpdateExperiencePageDto,
  ) {
    return this.experienceService.updatePage(
      updateExperiencePageDto,
    );
  }

  /*
   * Experience highlights
   */

  @Get("highlights")
  @ApiOperation({
    summary:
      "List all Experience highlights",
    description:
      "Returns all highlights belonging to the current Experience page.",
  })
  @ApiOkResponse({
    description:
      "Experience highlights returned successfully.",
    type: ExperienceHighlightResponseDto,
    isArray: true,
  })
  @ApiNotFoundResponse({
    description:
      "No Experience page exists.",
  })
  findHighlights() {
    return this.experienceService.findHighlights();
  }

  @Get("highlights/:id")
  @ApiOperation({
    summary:
      "Get an Experience highlight by ID",
  })
  @ApiParam({
    name: "id",
    type: Number,
    required: true,
    example: 1,
    description:
      "Unique numeric highlight identifier.",
  })
  @ApiOkResponse({
    description:
      "Experience highlight returned successfully.",
    type: ExperienceHighlightResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "The supplied highlight ID is not a valid integer.",
  })
  @ApiNotFoundResponse({
    description:
      "No Experience highlight exists with the supplied ID.",
  })
  findHighlight(
    @Param("id", ParseIntPipe)
    id: number,
  ) {
    return this.experienceService.findHighlight(id);
  }

  @Post("highlights")
  @ApiOperation({
    summary:
      "Create an Experience highlight",
    description:
      "Creates a highlight and attaches it to the current Experience page.",
  })
  @ApiCreatedResponse({
    description:
      "Experience highlight created successfully.",
    type: ExperienceHighlightResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "The request body contains invalid highlight values.",
  })
  @ApiNotFoundResponse({
    description:
      "No Experience page exists. Create the page first.",
  })
  createHighlight(
    @Body()
    createExperienceHighlightDto:
      CreateExperienceHighlightDto,
  ) {
    return this.experienceService.createHighlight(
      createExperienceHighlightDto,
    );
  }

  @Patch("highlights/:id")
  @ApiOperation({
    summary:
      "Update an Experience highlight",
    description:
      "Updates one or more fields of an existing highlight.",
  })
  @ApiParam({
    name: "id",
    type: Number,
    required: true,
    example: 1,
  })
  @ApiOkResponse({
    description:
      "Experience highlight updated successfully.",
    type: ExperienceHighlightResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "The ID or request body is invalid.",
  })
  @ApiNotFoundResponse({
    description:
      "No Experience highlight exists with the supplied ID.",
  })
  updateHighlight(
    @Param("id", ParseIntPipe)
    id: number,
    @Body()
    updateExperienceHighlightDto:
      UpdateExperienceHighlightDto,
  ) {
    return this.experienceService.updateHighlight(
      id,
      updateExperienceHighlightDto,
    );
  }

  @Delete("highlights/:id")
  @ApiOperation({
    summary:
      "Delete an Experience highlight",
  })
  @ApiParam({
    name: "id",
    type: Number,
    required: true,
    example: 1,
  })
  @ApiOkResponse({
    description:
      "Experience highlight deleted successfully.",
    type: DeleteExperienceResourceResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "The supplied highlight ID is not a valid integer.",
  })
  @ApiNotFoundResponse({
    description:
      "No Experience highlight exists with the supplied ID.",
  })
  removeHighlight(
    @Param("id", ParseIntPipe)
    id: number,
  ) {
    return this.experienceService.removeHighlight(
      id,
    );
  }

  /*
   * Experience images
   */

  @Get("images")
  @ApiOperation({
    summary:
      "List all Experience images",
    description:
      "Returns all images belonging to the current Experience page. Featured images are returned first.",
  })
  @ApiOkResponse({
    description:
      "Experience images returned successfully.",
    type: ExperienceImageResponseDto,
    isArray: true,
  })
  @ApiNotFoundResponse({
    description:
      "No Experience page exists.",
  })
  findImages() {
    return this.experienceService.findImages();
  }

  @Get("images/:id")
  @ApiOperation({
    summary:
      "Get an Experience image by ID",
  })
  @ApiParam({
    name: "id",
    type: Number,
    required: true,
    example: 1,
    description:
      "Unique numeric image identifier.",
  })
  @ApiOkResponse({
    description:
      "Experience image returned successfully.",
    type: ExperienceImageResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "The supplied image ID is not a valid integer.",
  })
  @ApiNotFoundResponse({
    description:
      "No Experience image exists with the supplied ID.",
  })
  findImage(
    @Param("id", ParseIntPipe)
    id: number,
  ) {
    return this.experienceService.findImage(id);
  }

  @Post("images")
  @ApiOperation({
    summary:
      "Create an Experience image",
    description:
      "Creates an image record and attaches it to the current Experience page. When the image is featured, any previous featured image is cleared.",
  })
  @ApiCreatedResponse({
    description:
      "Experience image created successfully.",
    type: ExperienceImageResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "The request body contains invalid image values.",
  })
  @ApiNotFoundResponse({
    description:
      "No Experience page exists. Create the page first.",
  })
  createImage(
    @Body()
    createExperienceImageDto:
      CreateExperienceImageDto,
  ) {
    return this.experienceService.createImage(
      createExperienceImageDto,
    );
  }

  @Patch("images/:id")
  @ApiOperation({
    summary:
      "Update an Experience image",
    description:
      "Updates image metadata, visibility, ordering, or featured status.",
  })
  @ApiParam({
    name: "id",
    type: Number,
    required: true,
    example: 1,
  })
  @ApiOkResponse({
    description:
      "Experience image updated successfully.",
    type: ExperienceImageResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "The ID or request body is invalid.",
  })
  @ApiNotFoundResponse({
    description:
      "No Experience image exists with the supplied ID.",
  })
  updateImage(
    @Param("id", ParseIntPipe)
    id: number,
    @Body()
    updateExperienceImageDto:
      UpdateExperienceImageDto,
  ) {
    return this.experienceService.updateImage(
      id,
      updateExperienceImageDto,
    );
  }

  @Delete("images/:id")
  @ApiOperation({
    summary:
      "Delete an Experience image",
  })
  @ApiParam({
    name: "id",
    type: Number,
    required: true,
    example: 1,
  })
  @ApiOkResponse({
    description:
      "Experience image deleted successfully.",
    type: DeleteExperienceResourceResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "The supplied image ID is not a valid integer.",
  })
  @ApiNotFoundResponse({
    description:
      "No Experience image exists with the supplied ID.",
  })
  removeImage(
    @Param("id", ParseIntPipe)
    id: number,
  ) {
    return this.experienceService.removeImage(id);
  }
}