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

export type UserType = 'normal' | 'visitor' | 'blackList' | 'patient' | 'maintenance';
export type Gender = 'male' | 'female' | 'unknown';

@Entity('hik_persons')
export class PersonEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // ISAPI'dagi employeeNo — aparatdagi unikal user ID (string, raqam ham bo'lishi mumkin)
  @Index({ unique: true })
  @Column({ length: 32 })
  employeeNo!: string;

  @Column({ length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 16, default: 'normal' })
  userType!: UserType;

  @Column({ type: 'varchar', length: 8, default: 'unknown' })
  gender!: Gender;

  @Column({ type: 'timestamptz', nullable: true })
  beginTime!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  endTime!: Date | null;

  // Yuz rasmining lokal serverdagi nusxasi (uploads/faces/<id>.jpg)
  @Column({ type: 'text', nullable: true })
  faceImagePath!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  cardNo!: string | null;

  // PIN faqat hash qilingan ko'rinishda saqlanadi (aparatga aslida yuboriladi)
  @Column({ type: 'text', nullable: true })
  pinHash!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  email!: string | null;

  // Tashqi tizim bilan bog'lash uchun (masalan full_food users.id)
  @Column({ type: 'varchar', length: 64, nullable: true })
  externalUserId!: string | null;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => PersonDeviceEntity, (pd) => pd.person, { cascade: true })
  deviceLinks!: PersonDeviceEntity[];

  @OneToMany(() => AccessEventEntity, (e) => e.person)
  events!: AccessEventEntity[];
}
