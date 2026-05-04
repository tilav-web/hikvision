import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type CompanyStatus = 'active' | 'disabled';

@Entity('companies')
export class CompanyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 160 })
  name!: string;

  @Index({ unique: true })
  @Column({ length: 80 })
  slug!: string;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status!: CompanyStatus;

  @Column({ type: 'date', nullable: true })
  paidFrom!: Date | null;

  @Column({ type: 'date', nullable: true })
  paidUntil!: Date | null;

  @Column({ type: 'int', default: 0 })
  maxDevices!: number;

  @Column({ type: 'int', default: 0 })
  maxEmployees!: number;

  @Column({ type: 'varchar', length: 32, nullable: true })
  contactPhone!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  contactEmail!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
