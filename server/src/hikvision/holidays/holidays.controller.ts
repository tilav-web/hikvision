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
import { HolidaysService } from './holidays.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../auth/current-user.decorator';

@ApiTags('Hikvision · Holidays')
@ApiBearerAuth()
@Controller('hikvision/holidays')
export class HolidaysController {
  constructor(private readonly service: HolidaysService) {}

  @Get()
  @Roles('company_admin')
  list(
    @CurrentUser() current: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.list(current, { companyId, from, to });
  }

  @Post()
  @Roles('company_admin')
  create(@CurrentUser() current: AuthUser, @Body() dto: CreateHolidayDto) {
    return this.service.create(current, dto);
  }

  @Patch(':id')
  @Roles('company_admin')
  update(
    @CurrentUser() current: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHolidayDto,
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
