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

/**
 * Hafta kunlari bitmask: dushanba=1, seshanba=2, chorshanba=4, payshanba=8,
 * juma=16, shanba=32, yakshanba=64. Misol: dush-juma = 1+2+4+8+16 = 31.
 */
export type WorkingDays = number;

@Entity('hik_schedules')
export class ScheduleEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  companyId!: string;

  @ManyToOne(() => CompanyEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company!: CompanyEntity;

  @Column({ length: 120 })
  name!: string;

  // 'HH:MM' formatida — kampaniya time-zone'ida
  @Column({ type: 'varchar', length: 5 })
  startTime!: string;

  @Column({ type: 'varchar', length: 5 })
  endTime!: string;

  @Column({ type: 'int', default: 31 })
  workingDays!: WorkingDays;

  // Kechikishni qabul qilish chegarasi (daqiqalarda)
  @Column({ type: 'int', default: 5 })
  graceMinutes!: number;

  // Kechikkanlikning eng kichik chegarasi (jarima boshlanadi)
  @Column({ type: 'int', default: 10 })
  lateThresholdMinutes!: number;

  // Erta ketganlikning chegarasi
  @Column({ type: 'int', default: 10 })
  earlyLeaveThresholdMinutes!: number;

  // Avtomatik jarima (so'm/foiz hisoblash logikasiga aralashmaymiz, faqat coefficient saqlaymiz)
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  penaltyPerLateMinute!: string; // "1500.00" — 1 daqiqa kechikish = 1500 so'm

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  bonusPerEarlyMinute!: string;

  /**
   * Tushlik rejimi:
   * - none: tushlik yo'q, ish vaqtida har chiqish jarima
   * - fixed: lunchStart..lunchEnd oralig'ida chiqish bepul. Boshqa vaqt chiqsa jarima
   * - flexible: lunchDurationMinutes umumiy budget, istalgan vaqtda ishlatish mumkin
   */
  @Column({ type: 'varchar', length: 16, default: 'none' })
  lunchMode!: 'none' | 'fixed' | 'flexible';

  @Column({ type: 'varchar', length: 5, nullable: true })
  lunchStart!: string | null;

  @Column({ type: 'varchar', length: 5, nullable: true })
  lunchEnd!: string | null;

  @Column({ type: 'int', default: 0 })
  lunchDurationMinutes!: number;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
