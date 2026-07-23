import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
} from "@nestjs/common";

import { FaqService } from "./faq.service.js";

@Controller("faq")
export class FaqController {
  constructor(
    private readonly faqService: FaqService,
  ) {}

  @Get()
  findPublished() {
    return this.faqService.findPublished();
  }

  @Get(":id")
  findOnePublished(
    @Param("id", ParseIntPipe)
    id: number,
  ) {
    return this.faqService.findOnePublished(id);
  }
}