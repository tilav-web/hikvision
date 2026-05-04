import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import { DeviceMode } from '../../entities/device.entity';

export class CreateDeviceDto {
  @ApiProperty({ example: 'Asosiy kirish' })
  @IsString()
  @Length(1, 120)
  name!: string;

  @ApiPropertyOptional({
    description: 'Kampaniya ID. super_admin uchun shart, company_admin avtomatik o\'z kampaniyasiga bog\'lanadi.',
  })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ description: 'Qaysi agentga biriktirilgan bo\'lsa shu agent boshqaradi' })
  @IsOptional()
  @IsUUID()
  agentId?: string;

  @ApiPropertyOptional({
    enum: ['entry', 'exit', 'both'],
    default: 'both',
    description: 'entry — kirish uchun, exit — chiqish uchun, both — qurilmada kirish/chiqish tugmasi chiqadi',
  })
  @IsOptional()
  @IsIn(['entry', 'exit', 'both'])
  mode?: DeviceMode;

  @ApiProperty({ example: '192.168.1.64' })
  @IsString()
  @Length(1, 64)
  host!: string;

  @ApiPropertyOptional({ example: 80, description: 'HTTP uchun 80, HTTPS uchun odatda 443' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional({ example: false, description: 'Aparat HTTPS\'da ishlayotgan bo\'lsa true' })
  @IsOptional()
  @IsBoolean()
  useHttps?: boolean;

  @ApiProperty({ example: 'admin' })
  @IsString()
  @Length(1, 64)
  username!: string;

  @ApiProperty({ example: 'StrongPass#2025' })
  @IsString()
  @Length(1, 128)
  password!: string;

  @ApiPropertyOptional({ example: 'Bosh ofis, 1-qavat' })
  @IsOptional()
  @IsString()
  @Length(0, 120)
  location?: string;
}
