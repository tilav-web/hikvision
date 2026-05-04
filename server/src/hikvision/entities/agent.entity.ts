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

@Entity('hik_agents')
export class AgentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  companyId!: string | null;

  @ManyToOne(() => CompanyEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'companyId' })
  company!: CompanyEntity | null;

  @Column({ length: 120 })
  name!: string;

  @Index({ unique: true })
  @Column({ length: 128 })
  token!: string;

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
