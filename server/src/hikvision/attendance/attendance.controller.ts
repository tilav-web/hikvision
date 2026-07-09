import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AttendanceService } from './attendance.service';
import {
  ATTENDANCE_QUEUE,
  FINALIZE_DAY_JOB,
} from './attendance.processor';
import { FinalizeDayDto } from './dto/finalize-day.dto';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../auth/current-user.decorator';

@ApiTags('Hikvision · Attendance')
@ApiBearerAuth()
@Controller('hikvision/attendance')
export class AttendanceController {
  constructor(
    private readonly service: AttendanceService,
    @InjectQueue(ATTENDANCE_QUEUE) private readonly queue: Queue,
  ) {}

  @Post('finalize-day')
  @Roles('super_admin', 'company_admin')
  @ApiOperation({
    summary:
      'Kunni yakunlash — kelmagan hodimlarga absent yozadi (fon-vazifaga qo\'shiladi). date bo\'sh bo\'lsa kechagi kun.',
  })
  async finalizeDay(
    @CurrentUser() current: AuthUser,
    @Body() dto: FinalizeDayDto,
  ) {
    const companyId =
      current.role === 'company_admin' ? current.companyId! : undefined;
    await this.queue.add(
      FINALIZE_DAY_JOB,
      { date: dto.date, companyId },
      { removeOnComplete: true, removeOnFail: 50 },
    );
    return { queued: true, date: dto.date ?? 'yesterday' };
  }

  @Get()
  @Roles('super_admin', 'company_admin')
  list(
    @CurrentUser() current: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('personId') personId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.service.list({
      current,
      companyId,
      personId,
      from,
      to,
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
    });
  }

  @Get('stats')
  @Roles('super_admin', 'company_admin')
  stats(
    @CurrentUser() current: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.stats({ current, companyId, from, to });
  }

  @Get('per-person')
  @Roles('super_admin', 'company_admin')
  perPerson(
    @CurrentUser() current: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.perPerson({ current, companyId, from, to });
  }

  @Get('per-day')
  @Roles('super_admin', 'company_admin')
  perDay(
    @CurrentUser() current: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.perDay({ current, companyId, from, to });
  }

  @Get(':id/events')
  @Roles('super_admin', 'company_admin')
  @ApiOperation({
    summary:
      'Bitta attendance kunining barcha grant bo\'lgan event\'lari (kirish/chiqish timeline)',
  })
  events(
    @CurrentUser() current: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.dayEvents(current, id);
  }

  @Get('persons/:personId/stats')
  @Roles('super_admin', 'company_admin')
  @ApiOperation({
    summary:
      'Bitta hodim uchun to\'liq statistika (sana oralig\'i, kunlar agregati, jarima/bonus)',
  })
  personStats(
    @CurrentUser() current: AuthUser,
    @Param('personId', ParseUUIDPipe) personId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.personStats(current, personId, { from, to });
  }
}
