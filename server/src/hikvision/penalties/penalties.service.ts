import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { PenaltyEntity } from '../entities/penalty.entity';
import { PersonEntity } from '../entities/person.entity';
import { AuthUser } from '../../auth/current-user.decorator';
import { CreatePenaltyDto } from './dto/create-penalty.dto';

@Injectable()
export class PenaltiesService {
  constructor(
    @InjectRepository(PenaltyEntity)
    private readonly repo: Repository<PenaltyEntity>,
    @InjectRepository(PersonEntity)
    private readonly personRepo: Repository<PersonEntity>,
  ) {}

  async list(opts: {
    current: AuthUser;
    companyId?: string;
    personId?: string;
    from?: string;
    to?: string;
    type?: 'penalty' | 'bonus';
  }) {
    const where: any = {};
    if (opts.current.role === 'company_admin') {
      where.companyId = opts.current.companyId;
    } else if (opts.companyId) {
      where.companyId = opts.companyId;
    }
    if (opts.personId) where.personId = opts.personId;
    if (opts.from && opts.to) where.date = Between(opts.from, opts.to);
    if (opts.type) where.type = opts.type;

    const items = await this.repo.find({
      where,
      order: { date: 'DESC' },
      relations: { person: true },
    });
    const totalPenalty = items
      .filter((i) => i.type === 'penalty')
      .reduce((s, i) => s + parseFloat(i.amount), 0);
    const totalBonus = items
      .filter((i) => i.type === 'bonus')
      .reduce((s, i) => s + parseFloat(i.amount), 0);
    return { items, totalPenalty, totalBonus, net: totalBonus - totalPenalty };
  }

  async create(
    current: AuthUser,
    dto: CreatePenaltyDto,
  ): Promise<PenaltyEntity> {
    const person = await this.personRepo.findOne({
      where: { id: dto.personId },
    });
    if (!person) throw new NotFoundException('hodim topilmadi');

    const companyId =
      current.role === 'company_admin' ? current.companyId : person.companyId;
    if (current.role === 'company_admin' && person.companyId !== companyId) {
      throw new ForbiddenException();
    }
    if (!companyId) throw new BadRequestException('companyId aniqlanmadi');

    const entity = this.repo.create({
      companyId,
      personId: person.id,
      date: dto.date.slice(0, 10),
      type: dto.type,
      kind: 'manual',
      amount: dto.amount,
      reason: dto.reason ?? null,
      attendanceId: null,
      createdByUserId: current.id,
    });
    return this.repo.save(entity);
  }

  async remove(current: AuthUser, id: string): Promise<void> {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException();
    if (current.role === 'company_admin' && p.companyId !== current.companyId) {
      throw new ForbiddenException();
    }
    if (p.kind !== 'manual') {
      throw new BadRequestException(
        'avtomatik yozuvni o\'chira olmaysiz (jadval qaytarib hisoblaydi)',
      );
    }
    await this.repo.remove(p);
  }
}
