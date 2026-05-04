import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { HolidayEntity } from '../entities/holiday.entity';
import { AuthUser } from '../../auth/current-user.decorator';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';

@Injectable()
export class HolidaysService {
  constructor(
    @InjectRepository(HolidayEntity)
    private readonly repo: Repository<HolidayEntity>,
  ) {}

  async list(
    current: AuthUser,
    opts: { companyId?: string; from?: string; to?: string } = {},
  ): Promise<HolidayEntity[]> {
    const where: Record<string, any> = {};
    if (current.role === 'company_admin') {
      where.companyId = current.companyId!;
    } else if (opts.companyId) {
      where.companyId = opts.companyId;
    }
    if (opts.from && opts.to) where.date = Between(opts.from, opts.to);
    return this.repo.find({ where, order: { date: 'ASC' } });
  }

  async findOne(current: AuthUser, id: string): Promise<HolidayEntity> {
    const h = await this.repo.findOne({ where: { id } });
    if (!h) throw new NotFoundException('bayram topilmadi');
    this.assertAccess(current, h.companyId);
    return h;
  }

  async isHoliday(companyId: string, date: string): Promise<boolean> {
    const h = await this.repo.findOne({ where: { companyId, date } });
    return !!h;
  }

  async create(
    current: AuthUser,
    dto: CreateHolidayDto,
  ): Promise<HolidayEntity> {
    const companyId =
      current.role === 'company_admin' ? current.companyId : dto.companyId;
    if (!companyId) throw new BadRequestException('companyId shart');

    const date = dto.date.slice(0, 10);
    const exists = await this.repo.findOne({ where: { companyId, date } });
    if (exists) {
      throw new ConflictException('bu sanada allaqachon bayram bor');
    }

    const entity = this.repo.create({
      companyId,
      date,
      name: dto.name,
    });
    return this.repo.save(entity);
  }

  async update(
    current: AuthUser,
    id: string,
    dto: UpdateHolidayDto,
  ): Promise<HolidayEntity> {
    const h = await this.findOne(current, id);
    if (dto.name !== undefined) h.name = dto.name;
    return this.repo.save(h);
  }

  async remove(current: AuthUser, id: string): Promise<void> {
    const h = await this.findOne(current, id);
    await this.repo.remove(h);
  }

  private assertAccess(current: AuthUser, companyId: string | null): void {
    if (current.role === 'company_admin' && companyId !== current.companyId) {
      throw new ForbiddenException();
    }
  }
}
