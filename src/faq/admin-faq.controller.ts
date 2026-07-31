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

import { Roles } from "../auth/decorators/roles.decorator.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { UserRole } from "../generated/prisma/enums.js";

import { CreateFaqDto } from "./dto/create-faq.dto.js";
import { FaqResponseDto } from "./dto/faq-response.dto.js";
import { UpdateFaqDto } from "./dto/update-faq.dto.js";
import { FaqService } from "./faq.service.js";

@ApiTags("Admin FAQ")
@ApiBearerAuth("access-token")
@ApiUnauthorizedResponse({
  description:
    "A valid administrator JWT access token is required.",
})
@ApiForbiddenResponse({
  description:
    "The authenticated user does not have administrator permission.",
})
@Controller("admin/faq")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminFaqController {
  constructor(
    private readonly faqService: FaqService,
  ) {}

  @Get()
  @ApiOperation({
    summary: "List all FAQs",
    description:
      "Returns all FAQ entries for administration, including draft, published, and archived entries.",
  })
  @ApiOkResponse({
    description:
      "FAQ entries returned successfully.",
    type: FaqResponseDto,
    isArray: true,
  })
  findAll() {
    return this.faqService.findAll();
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get an FAQ by ID",
    description:
      "Returns one FAQ entry for viewing or editing in the administration dashboard.",
  })
  @ApiParam({
    name: "id",
    type: Number,
    required: true,
    example: 1,
    description:
      "Unique numeric identifier of the FAQ entry.",
  })
  @ApiOkResponse({
    description:
      "FAQ entry returned successfully.",
    type: FaqResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "The supplied FAQ ID is not a valid integer.",
  })
  @ApiNotFoundResponse({
    description:
      "No FAQ entry exists with the supplied ID.",
  })
  findOne(
    @Param("id", ParseIntPipe)
    id: number,
  ) {
    return this.faqService.findOne(id);
  }

  @Post()
  @ApiOperation({
    summary: "Create an FAQ",
    description:
      "Creates a new FAQ entry. New entries default to DRAFT status and sort order 0 when those fields are not supplied.",
  })
  @ApiCreatedResponse({
    description:
      "FAQ entry created successfully.",
    type: FaqResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "The request body contains invalid FAQ values.",
  })
  create(
    @Body()
    createFaqDto: CreateFaqDto,
  ) {
    return this.faqService.create(
      createFaqDto,
    );
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Update an FAQ",
    description:
      "Updates one or more FAQ fields. Fields that are not included remain unchanged.",
  })
  @ApiParam({
    name: "id",
    type: Number,
    required: true,
    example: 1,
    description:
      "Unique numeric identifier of the FAQ entry.",
  })
  @ApiOkResponse({
    description:
      "FAQ entry updated successfully.",
    type: FaqResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "The supplied ID or request body is invalid.",
  })
  @ApiNotFoundResponse({
    description:
      "No FAQ entry exists with the supplied ID.",
  })
  update(
    @Param("id", ParseIntPipe)
    id: number,
    @Body()
    updateFaqDto: UpdateFaqDto,
  ) {
    return this.faqService.update(
      id,
      updateFaqDto,
    );
  }

  @Delete(":id")
  @ApiOperation({
    summary: "Delete an FAQ",
    description:
      "Permanently deletes an FAQ entry from the database.",
  })
  @ApiParam({
    name: "id",
    type: Number,
    required: true,
    example: 1,
    description:
      "Unique numeric identifier of the FAQ entry.",
  })
  @ApiOkResponse({
    description:
      "FAQ entry deleted successfully.",
    type: FaqResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "The supplied FAQ ID is not a valid integer.",
  })
  @ApiNotFoundResponse({
    description:
      "No FAQ entry exists with the supplied ID.",
  })
  remove(
    @Param("id", ParseIntPipe)
    id: number,
  ) {
    return this.faqService.remove(id);
  }
}