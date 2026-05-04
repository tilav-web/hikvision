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
 * Bayram/dam olish kunlari. Davomatda shu sanada hodim kelmasa "absent" emas
 * "holiday" deb belgilaymiz, jarima ham yozilmaydi.
 */
@Entity('hik_holidays')
@Index('uniq_company_date', ['companyId', 'date'], { unique: true })
export class HolidayEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  companyId!: string;

  @ManyToOne(() => CompanyEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company!: CompanyEntity;

  @Column({ type: 'date' })
  date!: string;

  @Column({ length: 160 })
  name!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
