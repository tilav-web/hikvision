import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PersonsService } from './persons.service';
import { DeviceSyncService } from '../devices/device-sync.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../auth/current-user.decorator';

@ApiTags('Hikvision · Persons')
@ApiBearerAuth()
@Controller('hikvision/persons')
export class PersonsController {
  constructor(
    private readonly service: PersonsService,
    private readonly deviceSync: DeviceSyncService,
  ) {}

  @Get(':id/device-status')
  @Roles('super_admin', 'company_admin')
  @ApiOperation({
    summary:
      'Hodim har bir kampaniya qurilmasida bormi tekshirish (sinxron statusi)',
  })
  deviceStatus(
    @CurrentUser() current: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.deviceSync.checkPersonOnDevices(current, id);
  }

  @Post()
  @Roles('super_admin', 'company_admin')
  @ApiOperation({
    summary: 'Yangi hodim qo\'shish (ixtiyoriy: yuz rasmi + auto sync)',
  })
  @ApiConsumes('application/json', 'multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  create(
    @CurrentUser() current: AuthUser,
    @Body() dto: CreatePersonDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file && !file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Faqat rasm fayllar qabul qilinadi');
    }
    return this.service.createWithFace(current, dto, file?.buffer);
  }

  @Get()
  @Roles('super_admin', 'company_admin')
  @ApiOperation({ summary: 'Hodimlar ro\'yxati (qidiruv + sahifalash)' })
  findAll(
    @CurrentUser() current: AuthUser,
    @Query('q') q?: string,
    @Query('companyId') companyId?: string,
    @Query('skip', new ParseIntPipe({ optional: true })) skip?: number,
    @Query('take', new ParseIntPipe({ optional: true })) take?: number,
  ) {
    return this.service.findAll(current, { q, skip, take, companyId });
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
    @Body() dto: UpdatePersonDto,
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

  @Post(':id/face')
  @Roles('super_admin', 'company_admin')
  @ApiOperation({ summary: 'Yuz rasmini yuklash (JPEG/PNG, ≤10MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadFace(
    @CurrentUser() current: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Fayl yuklanmadi');
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Faqat rasm fayllar qabul qilinadi');
    }
    const updated = await this.service.setFaceImage(current, id, file.buffer);
    return { ok: true, id: updated.id, faceImagePath: updated.faceImagePath };
  }

  @Post(':id/sync')
  @Roles('super_admin', 'company_admin')
  @ApiOperation({ summary: 'Hodimni biriktirilgan barcha aparatlarga sinxronlash' })
  sync(
    @CurrentUser() current: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.syncToDevices(current, id);
  }

  @Delete(':id/devices/:deviceId')
  @Roles('super_admin', 'company_admin')
  @ApiOperation({ summary: 'Faqat shu aparatdan o\'chirish (DB da qoladi)' })
  removeFromDevice(
    @CurrentUser() current: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
  ) {
    return this.service
      .removeFromDevice(current, id, deviceId)
      .then(() => ({ ok: true }));
  }
}
