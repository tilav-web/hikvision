import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DevicesService } from './devices.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';

@ApiTags('Hikvision · Devices')
@Controller('hikvision/devices')
export class DevicesController {
  constructor(private readonly service: DevicesService) {}

  @Post()
  @ApiOperation({ summary: 'Yangi aparat qo\'shish' })
  create(@Body() dto: CreateDeviceDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Barcha aparatlar ro\'yxati' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta aparat ma\'lumoti' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Aparat ma\'lumotini yangilash' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDeviceDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Aparatni o\'chirish' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Aparatga ulanishni tekshirish (deviceInfo)' })
  testConnection(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.testConnection(id);
  }

  @Post(':id/setup-listener')
  @ApiOperation({
    summary: 'Aparatga event listener URL sozlash (PUBLIC_BASE_URL ishlatadi)',
  })
  setupListener(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.setupListener(id);
  }

  @Post(':id/open-door')
  @ApiOperation({ summary: 'Eshikni masofadan ochish' })
  openDoor(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.openDoor(id).then(() => ({ ok: true }));
  }

  @Post(':id/reboot')
  @ApiOperation({ summary: 'Aparatni qayta yuklash' })
  reboot(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.reboot(id).then(() => ({ ok: true }));
  }

  @Post(':id/sync-time')
  @ApiOperation({ summary: 'Aparat vaqtini server vaqtiga moslash' })
  syncTime(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.syncTime(id).then(() => ({ ok: true }));
  }
}
