import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DeviceEntity } from './device.entity';
import { PersonEntity } from './person.entity';

export type SyncStatus = 'pending' | 'synced' | 'failed';

@Entity('hik_person_devices')
@Index(['personId', 'deviceId'], { unique: true })
export class PersonDeviceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  personId!: string;

  @Column('uuid')
  deviceId!: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: SyncStatus;

  @Column({ default: false })
  faceSynced!: boolean;

  @Column({ default: false })
  cardSynced!: boolean;

  @Column({ default: false })
  fingerprintSynced!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  syncedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  lastError!: string | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => PersonEntity, (p) => p.deviceLinks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'personId' })
  person!: PersonEntity;

  @ManyToOne(() => DeviceEntity, (d) => d.personLinks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deviceId' })
  device!: DeviceEntity;
}
