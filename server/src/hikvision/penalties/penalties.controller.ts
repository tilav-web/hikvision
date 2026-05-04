import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PenaltiesService } from './penalties.service';
import { CreatePenaltyDto } from './dto/create-penalty.dto';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../auth/current-user.decorator';

@ApiTags('Hikvision · Penalties')
@ApiBearerAuth()
@Controller('hikvision/penalties')
export class PenaltiesController {
  constructor(private readonly service: PenaltiesService) {}

  @Get()
  @Roles('company_admin')
  list(
    @CurrentUser() current: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('personId') personId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('type') type?: 'penalty' | 'bonus',
  ) {
    return this.service.list({ current, companyId, personId, from, to, type });
  }

  @Post()
  @Roles('company_admin')
  create(@CurrentUser() current: AuthUser, @Body() dto: CreatePenaltyDto) {
    return this.service.create(current, dto);
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
