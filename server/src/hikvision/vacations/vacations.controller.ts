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
import { VacationsService } from './vacations.service';
import { CreateVacationDto } from './dto/create-vacation.dto';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../auth/current-user.decorator';

@ApiTags('Hikvision · Vacations')
@ApiBearerAuth()
@Controller('hikvision/vacations')
export class VacationsController {
  constructor(private readonly service: VacationsService) {}

  @Get()
  @Roles('super_admin', 'company_admin')
  list(
    @CurrentUser() current: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('personId') personId?: string,
    @Query('activeOn') activeOn?: string,
  ) {
    return this.service.list({ current, companyId, personId, activeOn });
  }

  @Post()
  @Roles('company_admin')
  create(@CurrentUser() current: AuthUser, @Body() dto: CreateVacationDto) {
    return this.service.create(current, dto);
  }

  @Patch(':id')
  @Roles('company_admin')
  update(
    @CurrentUser() current: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateVacationDto>,
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
