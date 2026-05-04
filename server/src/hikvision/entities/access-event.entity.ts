import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DeviceEntity } from './device.entity';
import { PersonEntity } from './person.entity';

export type EventCategory =
  | 'accessGranted'
  | 'accessDenied'
  | 'doorOpen'
  | 'doorClose'
  | 'tamper'
  | 'duress'
  | 'unknown';

export type VerifyMode =
  | 'face'
  | 'card'
  | 'fingerprint'
  | 'pin'
  | 'faceAndCard'
  | 'faceAndPin'
  | 'cardAndPin'
  | 'unknown';

@Entity('hik_access_events')
@Index(['deviceId', 'capturedAt'])
@Index(['personId', 'capturedAt'])
export class AccessEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  deviceId!: string;

  @Column({ type: 'uuid', nullable: true })
  personId!: string | null;

  // ISAPI dan kelgan employeeNo (agar aparatda bor bo'lsa)
  @Column({ type: 'varchar', length: 32, nullable: true })
  employeeNo!: string | null;

  @Column({ type: 'varchar', length: 32, default: 'unknown' })
  category!: EventCategory;

  @Column({ type: 'int', nullable: true })
  majorEvent!: number | null;

  @Column({ type: 'int', nullable: true })
  minorEvent!: number | null;

  @Column({ type: 'varchar', length: 24, default: 'unknown' })
  verifyMode!: VerifyMode;

  @Column({ type: 'varchar', length: 120, nullable: true })
  personName!: string | null;

  @Column({ type: 'timestamptz' })
  capturedAt!: Date;

  // Aparat yuborgan kichik snapshot rasmni saqlasak — uploads/events/<id>.jpg
  @Column({ type: 'text', nullable: true })
  pictureUrl!: string | null;

  @Column({ type: 'jsonb' })
  raw!: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => DeviceEntity, (d) => d.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deviceId' })
  device!: DeviceEntity;

  @ManyToOne(() => PersonEntity, (p) => p.events, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'personId' })
  person!: PersonEntity | null;
}
