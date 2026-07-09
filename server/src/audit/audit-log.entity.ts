import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Audit jurnali — muhim amallar (eshik ochish, hodim/qurilma CRUD, sinxronlash)
 * kim tomonidan qachon bajarilganini yozib boradi. Xavfsizlik/compliance uchun.
 */
@Entity('audit_logs')
@Index(['companyId', 'createdAt'])
@Index(['action', 'createdAt'])
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  companyId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  userEmail!: string | null;

  /** Masalan: 'door.open', 'device.create', 'person.delete'. */
  @Column({ type: 'varchar', length: 48 })
  action!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  entityType!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  entityId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  details!: Record<string, any> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
