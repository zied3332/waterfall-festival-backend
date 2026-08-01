import { PartialType } from "@nestjs/swagger";

import { CreateExperiencePageDto } from "./create-experience-page.dto.js";

export class UpdateExperiencePageDto extends PartialType(
  CreateExperiencePageDto,
) {}