import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../auth/current-user.decorator';

@ApiTags('Hikvision · Attendance')
@ApiBearerAuth()
@Controller('hikvision/attendance')
export class AttendanceController {
  constructor(private readonly service: AttendanceService) {}

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
}
