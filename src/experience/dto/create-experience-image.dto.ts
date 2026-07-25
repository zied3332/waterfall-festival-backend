import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateExperienceImageDto {
  @IsString()
  @IsNotEmpty()
  @IsUrl({
    require_protocol: true,
  })
  imageUrl!: string;

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