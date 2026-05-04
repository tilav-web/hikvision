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
import { PersonDeviceEntity } from './person-device.entity';
import { AccessEventEntity } from './access-event.entity';
import { AgentEntity } from './agent.entity';
import { CompanyEntity } from '../../companies/company.entity';

export type DeviceMode = 'entry' | 'exit' | 'both';

@Entity('hik_devices')
export class DeviceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  companyId!: string | null;

  @ManyToOne(() => CompanyEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'companyId' })
  company!: CompanyEntity | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  agentId!: string | null;

  @ManyToOne(() => AgentEntity, (a) => a.devices, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'agentId' })
  agent!: AgentEntity | null;

  @Column({ length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 8, default: 'both' })
  mode!: DeviceMode;

  @Index()
  @Column({ length: 64 })
  host!: string;

  @Column({ type: 'int', default: 80 })
  port!: number;

  @Column({ default: false })
  useHttps!: boolean;

  @Column({ length: 64 })
  username!: string;

  @Column({ type: 'text' })
  passwordEnc!: string;

  @Column({ type: 'varchar', length: 64, nullable: true, unique: true })
  serialNo!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  model!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  firmwareVersion!: string | null;

  @Column({ type: 'varchar', length: 24, nullable: true })
  macAddress!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  location!: string | null;

  @Column({ default: false })
  isOnline!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastSeenAt!: Date | null;

  @Column({ default: false })
  listenerConfigured!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => PersonDeviceEntity, (pd) => pd.device)
  personLinks!: PersonDeviceEntity[];

  @OneToMany(() => AccessEventEntity, (e) => e.device)
  events!: AccessEventEntity[];
}
