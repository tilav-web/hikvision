import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { DevicesService } from './devices.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../auth/current-user.decorator';

@ApiTags('Hikvision · Devices')
@ApiBearerAuth()
@Controller('hikvision/devices')
export class DevicesController {
  constructor(private readonly service: DevicesService) {}

  @Post()
  @Roles('super_admin', 'company_admin')
  @ApiOperation({ summary: 'Yangi aparat qo\'shish' })
  create(@CurrentUser() current: AuthUser, @Body() dto: CreateDeviceDto) {
    return this.service.create(current, dto);
  }

  @Get()
  @Roles('super_admin', 'company_admin')
  @ApiOperation({ summary: 'Aparatlar ro\'yxati' })
  findAll(
    @CurrentUser() current: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('agentId') agentId?: string,
  ) {
    return this.service.findAll(current, { companyId, agentId });
  }

  @Get(':id')
  @Roles('super_admin', 'company_admin')
  findOne(
    @CurrentUser() current: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(current, id);
  }

  @Patch(':id')
  @Roles('super_admin', 'company_admin')
  update(
    @CurrentUser() current: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeviceDto,
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
  @ApiOperation({ summary: 'Aparatga ulanishni tekshirish (deviceInfo)' })
  testConnection(
    @CurrentUser() current: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.testConnection(current, id);
  }

  @Post(':id/setup-listener')
  @Roles('super_admin', 'company_admin')
  @ApiOperation({
    summary: 'Aparatga event listener URL sozlash (PUBLIC_BASE_URL ishlatadi)',
  })
  setupListener(
    @CurrentUser() current: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.setupListener(current, id);
  }

  @Post(':id/open-door')
  @Roles('super_admin', 'company_admin')
  @ApiOperation({ summary: 'Eshikni masofadan ochish' })
  openDoor(
    @CurrentUser() current: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.openDoor(current, id).then(() => ({ ok: true }));
  }

  @Post(':id/reboot')
  @Roles('super_admin', 'company_admin')
  @ApiOperation({ summary: 'Aparatni qayta yuklash' })
  reboot(
    @CurrentUser() current: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.reboot(current, id).then(() => ({ ok: true }));
  }

  @Post(':id/sync-time')
  @Roles('super_admin', 'company_admin')
  @ApiOperation({ summary: 'Aparat vaqtini server vaqtiga moslash' })
  syncTime(
    @CurrentUser() current: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.syncTime(current, id).then(() => ({ ok: true }));
  }

  /**
   * Jonli kadr (JPEG). UI snapshot polling uchun.
   * Throttle: 10 req/s kifoya — 3-5 fps polling'ga yetadi, abuse'dan himoya.
   * Authorization: companyId guard `findOne` ichida (super_admin → barcha,
   * company_admin → faqat o'z kampaniyasi qurilmasi).
   */
  @Get(':id/snapshot')
  @Roles('super_admin', 'company_admin')
  @Throttle({ default: { limit: 10, ttl: 1_000 } })
  @ApiOperation({ summary: 'Aparatdan jonli JPEG kadr olish' })
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  @Header('Pragma', 'no-cache')
  async snapshot(
    @CurrentUser() current: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('channel', new ParseIntPipe({ optional: true })) channel: number | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const buf = await this.service.getSnapshot(current, id, channel ?? 1);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', buf.length.toString());
    res.end(buf);
  }
}
