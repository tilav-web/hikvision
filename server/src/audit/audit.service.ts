import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { AuditLogEntity } from './audit-log.entity';
import { AuthUser } from '../auth/current-user.decorator';

export interface AuditEntry {
  current?: AuthUser | null;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, any>;
  ip?: string;
  /** current bo'lmaganda (masalan agent) — companyId'ni to'g'ridan berish. */
  companyId?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly repo: Repository<AuditLogEntity>,
  ) {}

  /**
   * Audit yozuvini yozadi. Fire-and-forget — hech qachon asosiy oqimni buzmaydi
   * (xato bo'lsa log qilinadi, exception tashlanmaydi).
   */
  log(entry: AuditEntry): void {
    const row = this.repo.create({
      // Target kompaniya birinchi — super_admin boshqa kompaniya ustida amal
      // qilsa, yozuv o'sha kompaniyaga biriktiriladi (uning admini ko'radi).
      companyId: entry.companyId ?? entry.current?.companyId ?? null,
      userId: entry.current?.id ?? null,
      userEmail: entry.current?.email ?? null,
      action: entry.action,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      details: entry.details ?? null,
      ip: entry.ip ?? null,
    });
    this.repo
      .save(row)
      .catch((e) =>
        this.logger.warn(`audit yozib bo'lmadi (${entry.action}): ${e.message}`),
      );
  }

  /** Jurnalni ko'rish — super_admin barchasini, company_admin faqat o'zinikini. */
  async list(opts: {
    current: AuthUser;
    companyId?: string;
    action?: string;
    from?: string;
    to?: string;
    skip?: number;
    take?: number;
  }): Promise<{ items: AuditLogEntity[]; total: number }> {
    const where: Record<string, any> = {};
    if (opts.current.role === 'company_admin') {
      where.companyId = opts.current.companyId;
    } else if (opts.companyId) {
      where.companyId = opts.companyId;
    }
    if (opts.action) where.action = opts.action;
    if (opts.from && opts.to) {
      where.createdAt = Between(new Date(opts.from), new Date(opts.to));
    }
    const [items, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: opts.skip ?? 0,
      take: Math.min(opts.take ?? 50, 200),
    });
    return { items, total };
  }
}
