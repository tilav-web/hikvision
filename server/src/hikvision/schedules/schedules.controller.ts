import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SchedulesService } from './schedules.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../auth/current-user.decorator';

@ApiTags('Hikvision · Schedules')
@ApiBearerAuth()
@Controller('hikvision/schedules')
export class SchedulesController {
  constructor(private readonly service: SchedulesService) {}

  @Get()
  @Roles('company_admin')
  list(
    @CurrentUser() current: AuthUser,
    @Query('companyId') companyId?: string,
  ) {
    return this.service.list(current, companyId);
  }

  @Post()
  @Roles('company_admin')
  create(@CurrentUser() current: AuthUser, @Body() dto: CreateScheduleDto) {
    return this.service.create(current, dto);
  }

  @Get(':id')
  @Roles('company_admin')
  findOne(
    @CurrentUser() current: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(current, id);
  }

  @Patch(':id')
  @Roles('company_admin')
  update(
    @CurrentUser() current: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.service.update(current, id, dto);
  }

  @Delete(':id')
  @Roles('company_admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() current: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(current, id);
  }
}
