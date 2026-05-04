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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../auth/current-user.decorator';

@ApiTags('Hikvision · Agents')
@ApiBearerAuth()
@Controller('hikvision/agents')
export class AgentsController {
  constructor(private readonly service: AgentsService) {}

  @Get()
  @Roles('super_admin', 'company_admin')
  list(
    @CurrentUser() current: AuthUser,
    @Query('companyId') companyId?: string,
  ) {
    return this.service.list(current, companyId);
  }

  @Post()
  @Roles('super_admin', 'company_admin')
  @ApiOperation({
    summary: 'Yangi agent yaratish (token avtomatik generatsiya qilinadi)',
  })
  create(@CurrentUser() current: AuthUser, @Body() dto: CreateAgentDto) {
    return this.service.create(current, dto);
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
    @Body() dto: UpdateAgentDto,
  ) {
    return this.service.update(current, id, dto);
  }

  @Delete(':id')
  @Roles('super_admin', 'company_admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() current: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(current, id);
  }

  @Post(':id/rotate-token')
  @Roles('super_admin', 'company_admin')
  @ApiOperation({
    summary: 'Agent tokenini yangilash (eski token darhol bekor bo\'ladi)',
  })
  rotateToken(
    @CurrentUser() current: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.rotateToken(current, id);
  }
}
