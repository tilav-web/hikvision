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

export type VacationType = 'vacation' | 'sick' | 'unpaid' | 'business_trip' | 'other';
export type VacationStatus = 'pending' | 'approved' | 'rejected';

/**
 * Hodimning ta'tili / kasal kuni / xizmat safari va h.k.
 * Davomatda shu sanalarda hodim "absent" emas, "leave" deb ko'rsatiladi va jarima yozilmaydi.
 */
@Entity('hik_vacations')
@Index(['companyId', 'fromDate', 'toDate'])
@Index(['personId', 'fromDate', 'toDate'])
export class VacationEntity {
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
  fromDate!: string;

  @Column({ type: 'date' })
  toDate!: string;

  @Column({ type: 'varchar', length: 24 })
  type!: VacationType;

  @Column({ type: 'varchar', length: 16, default: 'approved' })
  status!: VacationStatus;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdByUserId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
