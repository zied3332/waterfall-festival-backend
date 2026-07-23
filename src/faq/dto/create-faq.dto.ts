import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export enum FaqStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
  ARCHIVED = "ARCHIVED",
}

export class CreateFaqDto {
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  question!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(5000)
  answer!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsEnum(FaqStatus)
  status?: FaqStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}