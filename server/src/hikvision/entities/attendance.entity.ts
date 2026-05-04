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
import { ScheduleEntity } from './schedule.entity';

export type AttendanceStatus =
  | 'present'
  | 'late'
  | 'absent'
  | 'leave'
  | 'partial'
  | 'holiday';

/**
 * Kunlik agregat: hodim qachon kirgan/chiqqan, kechikkanmi.
 * Har kun + har hodim uchun bitta yozuv.
 */
@Entity('hik_attendance')
@Index(['companyId', 'date'])
@Index(['personId', 'date'], { unique: true })
export class AttendanceEntity {
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

  @Column({ type: 'uuid', nullable: true })
  scheduleId!: string | null;

  @ManyToOne(() => ScheduleEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'scheduleId' })
  schedule!: ScheduleEntity | null;

  @Column({ type: 'date' })
  date!: string; // 'YYYY-MM-DD'

  @Column({ type: 'timestamptz', nullable: true })
  firstInAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastOutAt!: Date | null;

  @Column({ type: 'int', default: 0 })
  lateMinutes!: number;

  @Column({ type: 'int', default: 0 })
  earlyLeaveMinutes!: number;

  /** Tushlik chegarasidan oshib chiqib ketgan daqiqalar (jarimaga sabab) */
  @Column({ type: 'int', default: 0 })
  lunchOverstayMinutes!: number;

  @Column({ type: 'int', default: 0 })
  workedMinutes!: number;

  @Column({ type: 'varchar', length: 16, default: 'absent' })
  status!: AttendanceStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
