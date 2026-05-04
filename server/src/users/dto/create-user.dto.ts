import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '../user.entity';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  @MaxLength(160)
  fullName!: string;

  @IsIn(['super_admin', 'company_admin'])
  role!: UserRole;

  @IsOptional()
  @IsUUID()
  companyId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
