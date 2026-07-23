import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service.js";
import { CreateFaqDto } from "./dto/create-faq.dto.js";
import { UpdateFaqDto } from "./dto/update-faq.dto.js";

@Injectable()
export class FaqService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  findAll() {
    return this.prisma.faq.findMany({
      orderBy: [
        {
          sortOrder: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
    });
  }

  findPublished() {
    return this.prisma.faq.findMany({
      where: {
        status: "PUBLISHED",
      },
      orderBy: [
        {
          sortOrder: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
    });
  }

  async findOne(id: number) {
    const faq = await this.prisma.faq.findUnique({
      where: {
        id,
      },
    });

    if (!faq) {
      throw new NotFoundException(
        `FAQ with ID ${id} was not found.`,
      );
    }

    return faq;
  }

  async findOnePublished(id: number) {
    const faq = await this.prisma.faq.findFirst({
      where: {
        id,
        status: "PUBLISHED",
      },
    });

    if (!faq) {
      throw new NotFoundException(
        `Published FAQ with ID ${id} was not found.`,
      );
    }

    return faq;
  }

  create(createFaqDto: CreateFaqDto) {
    return this.prisma.faq.create({
      data: {
        question: createFaqDto.question.trim(),
        answer: createFaqDto.answer.trim(),
        category:
          createFaqDto.category?.trim() || null,
        status: createFaqDto.status ?? "DRAFT",
        sortOrder: createFaqDto.sortOrder ?? 0,
      },
    });
  }

  async update(
    id: number,
    updateFaqDto: UpdateFaqDto,
  ) {
    await this.findOne(id);

    return this.prisma.faq.update({
      where: {
        id,
      },
      data: {
        question:
          updateFaqDto.question !== undefined
            ? updateFaqDto.question.trim()
            : undefined,
        answer:
          updateFaqDto.answer !== undefined
            ? updateFaqDto.answer.trim()
            : undefined,
        category:
          updateFaqDto.category !== undefined
            ? updateFaqDto.category.trim() || null
            : undefined,
        status: updateFaqDto.status,
        sortOrder: updateFaqDto.sortOrder,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.faq.delete({
      where: {
        id,
      },
    });
  }
}