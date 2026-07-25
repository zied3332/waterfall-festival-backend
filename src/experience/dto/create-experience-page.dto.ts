import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreateExperiencePageDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  heroBadge?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  heroTitle!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  heroSubtitle?: string;

  @IsOptional()
  @IsString()
  heroDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  storyEyebrow?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  storyTitle!: string;

  @IsString()
  @IsNotEmpty()
  storyDescription!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  buttonText?: string;

  @IsOptional()
  @IsUrl({
    require_protocol: false,
    require_tld: false,
  })
  buttonUrl?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}