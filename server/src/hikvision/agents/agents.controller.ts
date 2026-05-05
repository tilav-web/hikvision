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
    summary:
      'Yangi agent yaratish (kampaniya tokeni bo\'yicha auth qilinadi, agent uchun alohida token yo\'q)',
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

  @Get(':id/inspect')
  @Roles('super_admin', 'company_admin')
  @ApiOperation({
    summary:
      'Agent runtime holatini tekshirish: ko\'rayotgan qurilmalar + ping. DB bilan solishtirib qaytariladi.',
  })
  inspect(
    @CurrentUser() current: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.inspect(current, id);
  }

  @Get(':id/discovered')
  @Roles('super_admin', 'company_admin')
  @ApiOperation({
    summary:
      'Agent SADP orqali aniqlagan qurilmalar (DB\'dagi qurilmalar bilan solishtirilib, hali qo\'shilmaganlari ham belgilanadi)',
  })
  discovered(
    @CurrentUser() current: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.discovered(current, id);
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
}
