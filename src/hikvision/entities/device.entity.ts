import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PersonDeviceEntity } from './person-device.entity';
import { AccessEventEntity } from './access-event.entity';

@Entity('hik_devices')
export class DeviceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 120 })
  name!: string;

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

  @Column({ type: 'varchar', length: 128, nullable: true })
  agentToken!: string | null;

  @Column({ default: false })
  agentOnline!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  agentLastSeenAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => PersonDeviceEntity, (pd) => pd.device)
  personLinks!: PersonDeviceEntity[];

  @OneToMany(() => AccessEventEntity, (e) => e.device)
  events!: AccessEventEntity[];
}
