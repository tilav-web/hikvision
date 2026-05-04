import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScheduleEntity } from '../entities/schedule.entity';
import { AuthUser } from '../../auth/current-user.decorator';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

@Injectable()
export class SchedulesService {
  constructor(
    @InjectRepository(ScheduleEntity)
    private readonly repo: Repository<ScheduleEntity>,
  ) {}

  async list(current: AuthUser, companyId?: string): Promise<ScheduleEntity[]> {
    const where: Record<string, any> = {};
    if (current.role === 'company_admin') {
      where.companyId = current.companyId!;
    } else if (companyId) {
      where.companyId = companyId;
    }
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  async findOne(current: AuthUser, id: string): Promise<ScheduleEntity> {
    const s = await this.repo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('jadval topilmadi');
    this.assertAccess(current, s.companyId);
    return s;
  }

  async create(
    current: AuthUser,
    dto: CreateScheduleDto,
  ): Promise<ScheduleEntity> {
    const companyId =
      current.role === 'company_admin' ? current.companyId : dto.companyId;
    if (!companyId) throw new BadRequestException('companyId shart');

    const entity = this.repo.create({
      companyId,
      name: dto.name,
      startTime: dto.startTime,
      endTime: dto.endTime,
      workingDays: dto.workingDays ?? 31,
      graceMinutes: dto.graceMinutes ?? 5,
      lateThresholdMinutes: dto.lateThresholdMinutes ?? 10,
      earlyLeaveThresholdMinutes: dto.earlyLeaveThresholdMinutes ?? 10,
      penaltyPerLateMinute: dto.penaltyPerLateMinute ?? '0',
      bonusPerEarlyMinute: dto.bonusPerEarlyMinute ?? '0',
      lunchMode: dto.lunchMode ?? 'none',
      lunchStart: dto.lunchStart ?? null,
      lunchEnd: dto.lunchEnd ?? null,
      lunchDurationMinutes: dto.lunchDurationMinutes ?? 0,
      isActive: dto.isActive ?? true,
    });
    return this.repo.save(entity);
  }

  async update(
    current: AuthUser,
    id: string,
    dto: UpdateScheduleDto,
  ): Promise<ScheduleEntity> {
    const s = await this.findOne(current, id);
    Object.assign(s, dto);
    return this.repo.save(s);
  }

  async remove(current: AuthUser, id: string): Promise<void> {
    const s = await this.findOne(current, id);
    await this.repo.remove(s);
  }

  private assertAccess(current: AuthUser, companyId: string | null): void {
    if (current.role === 'company_admin' && companyId !== current.companyId) {
      throw new ForbiddenException();
    }
  }
}
