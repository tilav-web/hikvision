import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateHolidayDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsDateString()
  date!: string;

  @IsString()
  @MaxLength(160)
  name!: string;
}
