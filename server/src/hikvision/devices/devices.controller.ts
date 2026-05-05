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
import { DevicesService } from './devices.service';
import { DeviceSyncService } from './device-sync.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../auth/current-user.decorator';

@ApiTags('Hikvision · Devices')
@ApiBearerAuth()
@Controller('hikvision/devices')
export class DevicesController {
  constructor(
    private readonly service: DevicesService,
    private readonly sync: DeviceSyncService,
  ) {}

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

  // Kamera stream — endi WebSocket asosida (events.gateway). HTTP endpoint'lar
  // olib tashlandi; brauzer to'g'ridan socket orqali subscribe bo'ladi.

  // ───── User sinxronlash (DB ↔ aparat) ─────

  @Get(':id/sync/compare')
  @Roles('super_admin', 'company_admin')
  @ApiOperation({
    summary: 'Aparat va DB user\'larini solishtirish (diff)',
  })
  compare(
    @CurrentUser() current: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sync.compare(current, id);
  }

  @Post(':id/sync/import')
  @Roles('super_admin', 'company_admin')
  @ApiOperation({
    summary: 'Aparat user\'larini DB\'ga import qilish (employeeNo ro\'yxati)',
  })
  importFromDevice(
    @CurrentUser() current: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { employeeNos: string[] },
  ) {
    return this.sync.importFromDevice(current, id, body.employeeNos ?? []);
  }

  @Post(':id/sync/push')
  @Roles('super_admin', 'company_admin')
  @ApiOperation({
    summary: 'DB person\'larini aparatga yuborish (personId ro\'yxati)',
  })
  pushToDevice(
    @CurrentUser() current: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { personIds: string[] },
  ) {
    return this.sync.pushToDevice(current, id, body.personIds ?? []);
  }

  @Post(':id/sync/delete')
  @Roles('super_admin', 'company_admin')
  @ApiOperation({
    summary: 'Faqat aparatdan o\'chirish (DB tegmaydi)',
  })
  deleteFromDevice(
    @CurrentUser() current: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { employeeNos: string[] },
  ) {
    return this.sync.deleteFromDevice(current, id, body.employeeNos ?? []);
  }
}
