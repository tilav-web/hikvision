import {
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { EventsService } from './events.service';
import { Public } from '../../auth/public.decorator';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../auth/current-user.decorator';

@ApiTags('Hikvision · Events')
@Controller('hikvision/events')
export class EventsController {
  private readonly logger = new Logger(EventsController.name);

  constructor(private readonly service: EventsService) {}

  /**
   * Aparat shu yerga POST yuboradi.
   * Format ikki xil bo'lishi mumkin:
   *   1) Content-Type: multipart/form-data
   *      Birinchi part: name="event_log" yoki "event" (JSON)
   *      Keyingi part(lar): rasm (image/jpeg)
   *   2) Content-Type: application/json — to'g'ridan-to'g'ri JSON
   */
  @Public()
  @Post('receiver')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  @UseInterceptors(AnyFilesInterceptor({ limits: { fileSize: 10 * 1024 * 1024 } }))
  async receive(
    @Req() req: Request,
    @Body() body: any,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ) {
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      req.ip;

    let payload: any = null;
    let picture: Buffer | undefined;

    // 1. multipart bo'lsa, body field'lari yoki files ichidan JSON izlaymiz
    if (files?.length) {
      const jsonFile = files.find(
        (f) =>
          /event/i.test(f.fieldname) ||
          /json/i.test(f.mimetype) ||
          /\.json$/i.test(f.originalname),
      );
      if (jsonFile) {
        payload = safeJson(jsonFile.buffer.toString('utf8'));
      }
      const imgFile = files.find((f) => /^image\//i.test(f.mimetype));
      if (imgFile) picture = imgFile.buffer;
    }

    // 2. body (multer text fields)
    if (!payload && body && typeof body === 'object') {
      const candidate = body.event_log || body.event || body.EventNotificationAlert || body;
      if (typeof candidate === 'string') {
        payload = safeJson(candidate);
      } else {
        payload = candidate;
      }
    }

    this.logger.log(
      `📥 receiver hit: ip=${clientIp}, files=${files?.length ?? 0}, hasPayload=${!!payload}`,
    );

    if (!payload) {
      this.logger.warn(`receiver: no parseable payload (ip=${clientIp})`);
      return { ok: true };
    }

    try {
      await this.service.ingest({ payload, picture, clientIp });
    } catch (e) {
      this.logger.error(`ingest failed: ${(e as Error).message}`);
    }
    // Aparatga doim 200 qaytaramiz, bo'lmasa retry qila boshlaydi
    return { ok: true };
  }

  @Get()
  @Roles('super_admin', 'company_admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Kirish-chiqish loglarini ko\'rish' })
  list(
    @CurrentUser() current: AuthUser,
    @Query('deviceId') deviceId?: string,
    @Query('personId') personId?: string,
    @Query('companyId') companyId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.service.list({
      current,
      deviceId,
      personId,
      companyId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      skip: skip ? Number.parseInt(skip, 10) : undefined,
      take: take ? Number.parseInt(take, 10) : undefined,
    });
  }
}

function safeJson(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
