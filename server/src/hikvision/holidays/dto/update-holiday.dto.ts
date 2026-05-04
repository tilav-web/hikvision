import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateHolidayDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;
}
