import {
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CompanyStatus } from '../company.entity';

export class CreateCompanyDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug must contain only lowercase letters, numbers and dashes',
  })
  slug!: string;

  @IsOptional()
  @IsIn(['active', 'disabled'])
  status?: CompanyStatus;

  @IsOptional()
  @IsDateString()
  paidFrom?: string;

  @IsOptional()
  @IsDateString()
  paidUntil?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxDevices?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxEmployees?: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  contactPhone?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
