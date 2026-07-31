import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
} from "@nestjs/common";

import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";

import { FaqResponseDto } from "./dto/faq-response.dto.js";
import { FaqService } from "./faq.service.js";

@ApiTags("Public FAQ")
@Controller("faq")
export class FaqController {
  constructor(
    private readonly faqService: FaqService,
  ) {}

  @Get()
  @ApiOperation({
    summary: "List published FAQs",
    description:
      "Returns all published FAQ entries displayed on the public website. Results are ordered by sort order and then creation date.",
  })
  @ApiOkResponse({
    description:
      "Published FAQ entries returned successfully.",
    type: FaqResponseDto,
    isArray: true,
  })
  findPublished() {
    return this.faqService.findPublished();
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get a published FAQ by ID",
    description:
      "Returns one published FAQ entry. Draft and archived entries are not accessible from this public endpoint.",
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
      "Published FAQ entry returned successfully.",
    type: FaqResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "The supplied FAQ ID is not a valid integer.",
  })
  @ApiNotFoundResponse({
    description:
      "The FAQ does not exist or is not published.",
  })
  findOnePublished(
    @Param("id", ParseIntPipe)
    id: number,
  ) {
    return this.faqService.findOnePublished(
      id,
    );
  }
}