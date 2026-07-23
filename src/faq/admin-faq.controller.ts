import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from "@nestjs/common";

import { CreateFaqDto } from "./dto/create-faq.dto.js";
import { UpdateFaqDto } from "./dto/update-faq.dto.js";
import { FaqService } from "./faq.service.js";

@Controller("admin/faq")
export class AdminFaqController {
  constructor(
    private readonly faqService: FaqService,
  ) {}

  @Get()
  findAll() {
    return this.faqService.findAll();
  }

  @Get(":id")
  findOne(
    @Param("id", ParseIntPipe)
    id: number,
  ) {
    return this.faqService.findOne(id);
  }

  @Post()
  create(
    @Body()
    createFaqDto: CreateFaqDto,
  ) {
    return this.faqService.create(createFaqDto);
  }

  @Patch(":id")
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
  remove(
    @Param("id", ParseIntPipe)
    id: number,
  ) {
    return this.faqService.remove(id);
  }
}