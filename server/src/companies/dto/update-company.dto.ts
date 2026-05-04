import {
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { CompanyStatus } from '../company.entity';

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

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
