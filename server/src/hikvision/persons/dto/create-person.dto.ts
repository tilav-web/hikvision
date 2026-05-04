import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';
import { Gender, UserType } from '../../entities/person.entity';

// Multipart form-data dan kelganda hammasi string bo'ladi — array va boolean'larni qayta ishlash
const toBool = ({ value }: { value: any }): any => {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return value;
};

const toArray = ({ value }: { value: any }): any => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try { return JSON.parse(trimmed); } catch { return value; }
  }
  return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
};

export class CreatePersonDto {
  @ApiPropertyOptional({
    description: 'super_admin uchun shart, company_admin avtomatik o\'z kampaniyasiga bog\'lanadi',
  })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiProperty({ example: '1001', description: 'Aparatdagi unikal user ID (kampaniya ichida unikal)' })
  @IsString()
  @Length(1, 32)
  @Matches(/^[A-Za-z0-9_-]+$/, { message: 'employeeNo faqat alfanumeric, _ va -' })
  employeeNo!: string;

  @ApiProperty({ example: 'Ali Valiyev' })
  @IsString()
  @Length(1, 120)
  name!: string;

  @ApiPropertyOptional({ enum: ['normal', 'visitor', 'blackList', 'patient', 'maintenance'] })
  @IsOptional()
  @IsEnum(['normal', 'visitor', 'blackList', 'patient', 'maintenance'])
  userType?: UserType;

  @ApiPropertyOptional({ enum: ['male', 'female', 'unknown'] })
  @IsOptional()
  @IsEnum(['male', 'female', 'unknown'])
  gender?: Gender;

  @ApiPropertyOptional({ example: '2025-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  beginTime?: string;

  @ApiPropertyOptional({ example: '2030-12-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  endTime?: string;

  @ApiPropertyOptional({ example: '1234567890' })
  @IsOptional()
  @IsString()
  @Length(1, 32)
  cardNo?: string;

  @ApiPropertyOptional({ example: '0000', description: '4-8 raqamli PIN' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4,8}$/)
  pin?: string;

  @ApiPropertyOptional({ example: '+998901234567' })
  @IsOptional()
  @IsString()
  @Length(1, 32)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'ext-user-id' })
  @IsOptional()
  @IsString()
  externalUserId?: string;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Qaysi aparatlarga yuborish (id ro\'yxati). Bo\'sh bo\'lsa — barchasiga. ' +
      'Multipart so\'rovda JSON-string yoki vergul bilan ajratilgan ro\'yxat berish mumkin.',
  })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsUUID('4', { each: true })
  @Type(() => String)
  deviceIds?: string[];

  @ApiPropertyOptional({
    description: 'true bo\'lsa, yaratish bilan birga aparatlarga avtomatik sinxronlanadi',
    default: false,
  })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  autoSync?: boolean;
}
