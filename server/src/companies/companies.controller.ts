import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@ApiTags('companies')
@ApiBearerAuth()
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get()
  @Roles('super_admin')
  list() {
    return this.companies.list();
  }

  @Post()
  @Roles('super_admin')
  @ApiOperation({ summary: 'Create company (super_admin only)' })
  create(@Body() dto: CreateCompanyDto) {
    return this.companies.create(dto);
  }

  @Get(':id')
  @Roles('super_admin', 'company_admin')
  getOne(@CurrentUser() current: AuthUser, @Param('id') id: string) {
    if (current.role === 'company_admin' && current.companyId !== id) {
      throw new ForbiddenException('forbidden');
    }
    return this.companies.findById(id);
  }

  @Patch(':id')
  @Roles('super_admin')
  update(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    return this.companies.update(id, dto);
  }

  @Delete(':id')
  @Roles('super_admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.companies.remove(id);
  }

  @Post(':id/rotate-token')
  @Roles('super_admin')
  @ApiOperation({
    summary: 'Kampaniya API tokenini yangilash (eski token darhol bekor bo\'ladi)',
  })
  rotateToken(@Param('id') id: string) {
    return this.companies.rotateApiToken(id);
  }
}
