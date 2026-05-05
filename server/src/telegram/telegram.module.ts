import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegramChannelEntity } from './entities/telegram-channel.entity';
import { CompanyEntity } from '../companies/company.entity';
import { TelegramBotService } from './telegram-bot.service';
import { NotificationsService } from './notifications.service';
import { TelegramChannelsService } from './telegram-channels.service';
import { TelegramChannelsController } from './telegram-channels.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TelegramChannelEntity, CompanyEntity])],
  controllers: [TelegramChannelsController],
  providers: [TelegramBotService, NotificationsService, TelegramChannelsService],
  exports: [NotificationsService, TelegramBotService],
})
export class TelegramModule {}
