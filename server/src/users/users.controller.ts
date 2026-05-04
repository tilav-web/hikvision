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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Roles('super_admin', 'company_admin')
  @ApiOperation({
    summary: 'List users (super_admin: all; company_admin: own company)',
  })
  list(
    @CurrentUser() current: AuthUser,
    @Query('companyId') companyId?: string,
  ) {
    if (current.role === 'super_admin') {
      return companyId
        ? this.users.listByCompany(companyId)
        : this.users.listAll();
    }
    return this.users.listByCompany(current.companyId!);
  }

  @Post()
  @Roles('super_admin')
  @ApiOperation({ summary: 'Create user (super_admin only)' })
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Get(':id')
  @Roles('super_admin', 'company_admin')
  async getOne(@CurrentUser() current: AuthUser, @Param('id') id: string) {
    const user = await this.users.findById(id);
    if (!user) throw new ForbiddenException('user not found');
    if (
      current.role === 'company_admin' &&
      user.companyId !== current.companyId
    ) {
      throw new ForbiddenException('forbidden');
    }
    return user;
  }

  @Patch(':id')
  @Roles('super_admin', 'company_admin')
  @ApiOperation({ summary: 'Update user (own data or super_admin)' })
  async update(
    @CurrentUser() current: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    if (current.role === 'company_admin' && current.id !== id) {
      throw new ForbiddenException('company_admin can update only self');
    }
    return this.users.update(id, dto);
  }

  @Delete(':id')
  @Roles('super_admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.users.remove(id);
  }
}
