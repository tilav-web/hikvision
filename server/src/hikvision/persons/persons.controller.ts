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
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PersonsService } from './persons.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';

@ApiTags('Hikvision · Persons')
@Controller('hikvision/persons')
export class PersonsController {
  constructor(private readonly service: PersonsService) {}

  @Post()
  @ApiOperation({
    summary: 'Yangi user qo\'shish (ixtiyoriy: yuz rasmi + auto sync)',
    description:
      'JSON yoki multipart/form-data bilan yuborish mumkin. ' +
      'Multipart bilan `file` field — yuz rasmi (JPEG/PNG, ≤10MB). ' +
      '`autoSync=true` bo\'lsa, yaratish bilan birga aparatlarga yuboriladi.',
  })
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        employeeNo: { type: 'string', example: '1001' },
        name: { type: 'string', example: 'Ali Valiyev' },
        userType: { type: 'string', enum: ['normal', 'visitor', 'blackList'] },
        gender: { type: 'string', enum: ['male', 'female', 'unknown'] },
        beginTime: { type: 'string', format: 'date-time' },
        endTime: { type: 'string', format: 'date-time' },
        cardNo: { type: 'string' },
        pin: { type: 'string', example: '0000' },
        phone: { type: 'string', example: '+998901234567' },
        email: { type: 'string', format: 'email' },
        externalUserId: { type: 'string' },
        deviceIds: {
          type: 'string',
          description: 'JSON-array yoki vergul bilan ajratilgan UUID list',
          example: '["uuid1","uuid2"]',
        },
        autoSync: { type: 'boolean', default: false },
        file: { type: 'string', format: 'binary', description: 'Yuz rasmi (JPEG/PNG)' },
      },
      required: ['employeeNo', 'name'],
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  create(
    @Body() dto: CreatePersonDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file && !file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Faqat rasm fayllar qabul qilinadi');
    }
    return this.service.createWithFace(dto, file?.buffer);
  }

  @Get()
  @ApiOperation({ summary: 'Userlar ro\'yxati (qidiruv + sahifalash)' })
  findAll(
    @Query('q') q?: string,
    @Query('skip', new ParseIntPipe({ optional: true })) skip?: number,
    @Query('take', new ParseIntPipe({ optional: true })) take?: number,
  ) {
    return this.service.findAll({ q, skip, take });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta user (sinxronlanish holati bilan)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Userni tahrirlash' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePersonDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Userni o\'chirish (barcha aparatdan ham)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }

  @Post(':id/face')
  @ApiOperation({ summary: 'Yuz rasmini yuklash (JPEG/PNG, ≤10MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadFace(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Fayl yuklanmadi');
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Faqat rasm fayllar qabul qilinadi');
    }
    const updated = await this.service.setFaceImage(id, file.buffer);
    return { ok: true, id: updated.id, faceImagePath: updated.faceImagePath };
  }

  @Post(':id/sync')
  @ApiOperation({ summary: 'Userni o\'ziga biriktirilgan barcha aparatlarga sinxronlash' })
  sync(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.syncToDevices(id);
  }

  @Delete(':id/devices/:deviceId')
  @ApiOperation({ summary: 'Faqat shu aparatdan o\'chirish (DB da qoladi)' })
  removeFromDevice(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
  ) {
    return this.service.removeFromDevice(id, deviceId).then(() => ({ ok: true }));
  }
}
