import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class CreateDeviceDto {
  @ApiProperty({ example: 'Asosiy kirish' })
  @IsString()
  @Length(1, 120)
  name!: string;

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
