import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Max,
  Min,
} from 'class-validator';

export class CreateScheduleDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @Matches(/^\d{2}:\d{2}$/)
  startTime!: string;

  @Matches(/^\d{2}:\d{2}$/)
  endTime!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(127)
  workingDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  graceMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  lateThresholdMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  earlyLeaveThresholdMinutes?: number;

  @IsOptional()
  @IsNumberString()
  penaltyPerLateMinute?: string;

  @IsOptional()
  @IsNumberString()
  bonusPerEarlyMinute?: string;

  @IsOptional()
  @IsIn(['none', 'fixed', 'flexible'])
  lunchMode?: 'none' | 'fixed' | 'flexible';

  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/)
  lunchStart?: string;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/)
  lunchEnd?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(480)
  lunchDurationMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
