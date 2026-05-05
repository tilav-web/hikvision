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
   * Stream sessiyasini boshlash. Dialog ochilganda chaqiriladi.
   * Birinchi viewer kelganda agent qurilmadan kadrlarni keshlashni
   * boshlaydi. Bir nechta admin bir kameraga qarasa hisoblagich oshadi.
   */
  @Post(':id/stream/start')
  @Roles('super_admin', 'company_admin')
  @ApiOperation({ summary: 'Kamera stream sessiyasini boshlash' })
  startStream(
    @CurrentUser() current: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('fps', new ParseIntPipe({ optional: true })) fps: number | undefined,
  ) {
    return this.service.startStream(current, id, fps ?? 3);
  }

  /**
   * Stream sessiyasidan chiqish. Dialog yopilganda chaqiriladi.
   * Hisoblagich 0'ga tushganda agent stream'ni to'xtatadi.
   */
  @Post(':id/stream/stop')
  @Roles('super_admin', 'company_admin')
  @ApiOperation({ summary: 'Kamera stream sessiyasidan chiqish' })
  stopStream(
    @CurrentUser() current: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.stopStream(current, id);
  }

  /**
   * Stream'dan oxirgi keshlangan kadr. Browser polling shu endpoint'ni
   * chaqiradi — agent qurilmaga to'g'ridan-to'g'ri ulamasdan keshdan beradi
   * (tez). Throttle: 30 req/s — 5 fps × 6 viewer chegarasi.
   * Sessiya yo'q yoki kadr hali tayyor emas bo'lsa 404.
   */
  @Get(':id/stream/frame')
  @Roles('super_admin', 'company_admin')
  @Throttle({ default: { limit: 30, ttl: 1_000 } })
  @ApiOperation({ summary: 'Stream sessiyasidan oxirgi JPEG kadrni olish' })
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  @Header('Pragma', 'no-cache')
  async streamFrame(
    @CurrentUser() current: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const buf = await this.service.getStreamFrame(current, id);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', buf.length.toString());
    res.end(buf);
  }
}
