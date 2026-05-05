import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateTelegramChannelDto {
  @ApiProperty({
    example: '-1001234567890',
    description:
      "Telegram kanal/guruh chat_id'si. @userinfobot yoki Telegram API'dan oling. " +
      "Kanallar uchun -100 bilan boshlanadi (negative).",
  })
  @IsString()
  @Matches(/^-?\d+$/, { message: 'chatId raqamli bo\'lishi shart (masalan -1001234567890)' })
  @Length(1, 32)
  chatId!: string;

  @ApiPropertyOptional({ example: 'Hikvision Alerts' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    description:
      "super_admin uchun: companyId belgilash. Bo'sh qoldirilsa global kanal " +
      "bo'ladi (cross-company alert oladi). company_admin avtomatik o'z " +
      "kampaniyasiga bog'lanadi (bu maydon e'tiborga olinmaydi).",
  })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['late', 'blacklist'],
    description:
      "Qaysi event'lar yuboriladi. Bo'sh array yoki kiritilmasa — barcha event'lar.",
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledEvents?: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
