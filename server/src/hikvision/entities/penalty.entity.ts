import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CompanyEntity } from '../../companies/company.entity';
import { PersonEntity } from './person.entity';

export type PenaltyType = 'penalty' | 'bonus';
export type PenaltyKind = 'late' | 'early_leave' | 'absent' | 'manual' | 'early_arrival';

/**
 * Mukofot yoki jarima yozuvi.
 * Ikki yo'l bilan yaratiladi:
 *   1. Avtomatik — attendance hisobidan (cron yoki real-time)
 *   2. Qo'lda — admin yaratadi (kind=manual)
 */
@Entity('hik_penalties')
@Index(['companyId', 'date'])
@Index(['personId', 'date'])
export class PenaltyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  companyId!: string;

  @ManyToOne(() => CompanyEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company!: CompanyEntity;

  @Column({ type: 'uuid' })
  personId!: string;

  @ManyToOne(() => PersonEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'personId' })
  person!: PersonEntity;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'varchar', length: 8 })
  type!: PenaltyType;

  @Column({ type: 'varchar', length: 24 })
  kind!: PenaltyKind;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount!: string;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  // Auto-yaratilgan bo'lsa, qaysi attendance dan
  @Column({ type: 'uuid', nullable: true })
  attendanceId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdByUserId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
