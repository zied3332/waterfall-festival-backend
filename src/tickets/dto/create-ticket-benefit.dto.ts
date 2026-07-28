import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTicketBenefitDto {
  @IsString()
  @MaxLength(150)
  text!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}