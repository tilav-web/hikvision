import {
  IsDateString,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreatePenaltyDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsUUID()
  personId!: string;

  @IsDateString()
  date!: string;

  @IsIn(['penalty', 'bonus'])
  type!: 'penalty' | 'bonus';

  @IsNumberString()
  amount!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
