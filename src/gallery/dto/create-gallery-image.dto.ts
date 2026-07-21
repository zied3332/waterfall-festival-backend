import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from "class-validator";

import { GalleryStatus } from "../../generated/prisma/client.js";

export class CreateGalleryImageDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty()
  @IsUrl()
  imageUrl!: string;

  @IsOptional()
  @IsString()
  altText?: string;

  @IsOptional()
  @IsEnum(GalleryStatus)
  status?: GalleryStatus;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  eventId?: number;
}