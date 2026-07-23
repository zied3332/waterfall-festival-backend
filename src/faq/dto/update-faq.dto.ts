import { PartialType } from "@nestjs/mapped-types";

import { CreateFaqDto } from "./create-faq.dto.js";

export class UpdateFaqDto extends PartialType(
  CreateFaqDto,
) {}