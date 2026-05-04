import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CompanyEntity } from '../../companies/company.entity';
import { DeviceEntity } from './device.entity';

/**
 * Agent — bitta jismoniy qurilmadagi (Windows/RPI/Linux) bridge dastur.
 * Auth: Company.apiToken + AGENT_NAME (har kampaniya ichida unikal).
 * Agent-token kerak emas — kampaniya tokeni bilan tasdiqlanadi.
 */
@Entity('hik_agents')
@Index('uniq_company_agent_name', ['companyId', 'name'], { unique: true })
export class AgentEntity {
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

  @Column({ type: 'varchar', length: 64, nullable: true })
  hostInfo!: string | null;

  @Column({ default: false })
  isOnline!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastSeenAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => DeviceEntity, (d) => d.agent)
  devices!: DeviceEntity[];
}
