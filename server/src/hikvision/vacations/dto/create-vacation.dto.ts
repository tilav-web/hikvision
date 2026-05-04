import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateVacationDto {
  @IsUUID()
  personId!: string;

  @IsDateString()
  fromDate!: string;

  @IsDateString()
  toDate!: string;

  @IsIn(['vacation', 'sick', 'unpaid', 'business_trip', 'other'])
  type!: 'vacation' | 'sick' | 'unpaid' | 'business_trip' | 'other';

  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected'])
  status?: 'pending' | 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  reason?: string;
}
