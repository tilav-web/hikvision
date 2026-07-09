import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { VacationEntity } from '../entities/vacation.entity';
import { PersonEntity } from '../entities/person.entity';
import { AuthUser } from '../../auth/current-user.decorator';
import { CreateVacationDto } from './dto/create-vacation.dto';
import { UpdateVacationDto } from './dto/update-vacation.dto';

function assertDateOrder(fromDate: string, toDate: string): void {
  if (fromDate > toDate) {
    throw new BadRequestException(
      `boshlanish (${fromDate}) tugash (${toDate})'dan keyin bo'la olmaydi`,
    );
  }
}

@Injectable()
export class VacationsService {
  constructor(
    @InjectRepository(VacationEntity)
    private readonly repo: Repository<VacationEntity>,
    @InjectRepository(PersonEntity)
    private readonly personRepo: Repository<PersonEntity>,
  ) {}

  async list(opts: {
    current: AuthUser;
    companyId?: string;
    personId?: string;
    activeOn?: string;
  }): Promise<VacationEntity[]> {
    const where: any = {};
    if (opts.current.role === 'company_admin') {
      where.companyId = opts.current.companyId;
    } else if (opts.companyId) {
      where.companyId = opts.companyId;
    }
    if (opts.personId) where.personId = opts.personId;
    if (opts.activeOn) {
      where.fromDate = LessThanOrEqual(opts.activeOn);
      where.toDate = MoreThanOrEqual(opts.activeOn);
    }
    return this.repo.find({
      where,
      order: { fromDate: 'DESC' },
      relations: { person: true },
    });
  }

  async findOne(current: AuthUser, id: string): Promise<VacationEntity> {
    const v = await this.repo.findOne({ where: { id }, relations: { person: true } });
    if (!v) throw new NotFoundException('ta\'til topilmadi');
    if (current.role === 'company_admin' && v.companyId !== current.companyId) {
      throw new ForbiddenException();
    }
    return v;
  }

  /**
   * Belgilangan sanada hodim ta'tildami? (approved status'da bo'lishi shart)
   */
  async isOnLeave(personId: string, date: string): Promise<boolean> {
    const v = await this.repo.findOne({
      where: {
        personId,
        status: 'approved',
        fromDate: LessThanOrEqual(date),
        toDate: MoreThanOrEqual(date),
      },
    });
    return !!v;
  }

  async create(
    current: AuthUser,
    dto: CreateVacationDto,
  ): Promise<VacationEntity> {
    const person = await this.personRepo.findOne({
      where: { id: dto.personId },
    });
    if (!person) throw new NotFoundException('hodim topilmadi');
    if (
      current.role === 'company_admin' &&
      person.companyId !== current.companyId
    ) {
      throw new ForbiddenException();
    }

    const fromDate = dto.fromDate.slice(0, 10);
    const toDate = dto.toDate.slice(0, 10);
    assertDateOrder(fromDate, toDate);

    const entity = this.repo.create({
      companyId: person.companyId!,
      personId: person.id,
      fromDate,
      toDate,
      type: dto.type,
      status: dto.status ?? 'approved',
      reason: dto.reason ?? null,
      createdByUserId: current.id,
    });
    return this.repo.save(entity);
  }

  async update(
    current: AuthUser,
    id: string,
    dto: UpdateVacationDto,
  ): Promise<VacationEntity> {
    const v = await this.findOne(current, id);
    if (dto.fromDate !== undefined) v.fromDate = dto.fromDate.slice(0, 10);
    if (dto.toDate !== undefined) v.toDate = dto.toDate.slice(0, 10);
    assertDateOrder(v.fromDate, v.toDate);
    if (dto.type !== undefined) v.type = dto.type;
    if (dto.status !== undefined) v.status = dto.status;
    if (dto.reason !== undefined) v.reason = dto.reason;
    return this.repo.save(v);
  }

  async remove(current: AuthUser, id: string): Promise<void> {
    const v = await this.findOne(current, id);
    await this.repo.remove(v);
  }
}
