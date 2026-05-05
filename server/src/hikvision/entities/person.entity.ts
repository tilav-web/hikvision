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
import { CompanyEntity } from '../../companies/company.entity';

export type UserType = 'normal' | 'visitor' | 'blackList' | 'patient' | 'maintenance';
export type Gender = 'male' | 'female' | 'unknown';

@Entity('hik_persons')
@Index('uniq_company_employee', ['companyId', 'employeeNo'], {
  unique: true,
  where: '"companyId" IS NOT NULL',
})
@Index('uniq_company_card', ['companyId', 'cardNo'], {
  unique: true,
  where: '"cardNo" IS NOT NULL AND "companyId" IS NOT NULL',
})
@Index('uniq_company_pin', ['companyId', 'pin'], {
  unique: true,
  where: '"pin" IS NOT NULL AND "companyId" IS NOT NULL',
})
export class PersonEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  companyId!: string | null;

  @ManyToOne(() => CompanyEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'companyId' })
  company!: CompanyEntity | null;

  // ISAPI'dagi employeeNo — aparatdagi unikal user ID (string, raqam ham bo'lishi mumkin)
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

  // 4-8 raqamli PIN. Aparatga plaintext yuboriladi (ISAPI'da boshqacha imkon yo'q).
  // Kompaniya ichida unikal bo'lishi shart (PIN-only mode'da farqlash uchun).
  @Column({ type: 'varchar', length: 16, nullable: true })
  pin!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  email!: string | null;

  // Tashqi tizim bilan bog'lash uchun (masalan full_food users.id)
  @Column({ type: 'varchar', length: 64, nullable: true })
  externalUserId!: string | null;

  @Column({ default: true })
  isActive!: boolean;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  scheduleId!: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  baseSalary!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  position!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => PersonDeviceEntity, (pd) => pd.person, { cascade: true })
  deviceLinks!: PersonDeviceEntity[];

  @OneToMany(() => AccessEventEntity, (e) => e.person)
  events!: AccessEventEntity[];
}
