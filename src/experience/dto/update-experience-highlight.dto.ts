import { PartialType } from "@nestjs/swagger";

import { CreateExperienceHighlightDto } from "./create-experience-highlight.dto.js";

export class UpdateExperienceHighlightDto extends PartialType(
  CreateExperienceHighlightDto,
) {}