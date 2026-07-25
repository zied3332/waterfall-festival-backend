import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateExperienceImageDto {
  @IsOptional()
  @IsUrl({
    require_protocol: true,
  })
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  altText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}