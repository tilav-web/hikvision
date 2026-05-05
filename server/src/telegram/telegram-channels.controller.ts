import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TelegramChannelsService } from './telegram-channels.service';
import { TelegramBotService } from './telegram-bot.service';
import { CreateTelegramChannelDto } from './dto/create-channel.dto';
import { Roles } from '../auth/roles.decorator';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';

@ApiTags('Telegram · Channels')
@ApiBearerAuth()
@Controller('telegram/channels')
export class TelegramChannelsController {
  constructor(
    private readonly service: TelegramChannelsService,
    private readonly bot: TelegramBotService,
  ) {}

  @Get('bot-info')
  @Roles('super_admin', 'company_admin')
  @ApiOperation({ summary: 'Joriy bot username/holati' })
  botInfo() {
    return {
      ready: this.bot.isReady(),
      username: this.bot.getUsername(),
    };
  }

  @Get()
  @Roles('super_admin', 'company_admin')
  @ApiOperation({ summary: 'Telegram kanallari ro\'yxati' })
  list(
    @CurrentUser() current: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('onlyGlobal') onlyGlobal?: string,
  ) {
    return this.service.list({
      current,
      companyId,
      onlyGlobal: onlyGlobal === 'true',
    });
  }

  @Post()
  @Roles('super_admin', 'company_admin')
  @ApiOperation({
    summary: 'Yangi kanal qo\'shish (test xabar bilan tekshiriladi)',
  })
  create(
    @CurrentUser() current: AuthUser,
    @Body() dto: CreateTelegramChannelDto,
  ) {
    return this.service.create(current, dto);
  }

  @Patch(':id')
  @Roles('super_admin', 'company_admin')
  update(
    @CurrentUser() current: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateTelegramChannelDto>,
  ) {
    return this.service.update(current, id, dto);
  }

  @Delete(':id')
  @Roles('super_admin', 'company_admin')
  remove(
    @CurrentUser() current: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(current, id);
  }

  @Post(':id/test')
  @Roles('super_admin', 'company_admin')
  @ApiOperation({ summary: 'Kanalga test xabar yuborish' })
  test(
    @CurrentUser() current: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.sendTest(current, id);
  }
}
