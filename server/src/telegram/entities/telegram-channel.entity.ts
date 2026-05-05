import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CompanyEntity } from '../../companies/company.entity';

export type TgBotStatus =
  | 'administrator'
  | 'creator'
  | 'member'
  | 'restricted'
  | 'left'
  | 'kicked'
  | 'unknown';

/**
 * Telegram kanal/guruh ulanishi.
 *
 *  - companyId NULL    → super_admin global kanali (cross-company alert oladi)
 *  - companyId = X     → faqat X kampaniyaga oid bildirishnomalar
 *
 * Bot kanalda admin holatidami yoki yo'qmi — `my_chat_member` event orqali
 * doim yangilab turamiz (botStatus + isMember).
 */
@Entity('hik_telegram_channels')
@Index(['companyId'])
export class TelegramChannelEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  companyId!: string | null;

  @ManyToOne(() => CompanyEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'companyId' })
  company!: CompanyEntity | null;

  /**
   * Telegram chat_id. Kanallar/guruhlar uchun salbiy son
   * (masalan -1001234567890). bigint string sifatida saqlanadi —
   * JS number safe-integer chegarasidan oshib ketishi mumkin.
   */
  @Column({ type: 'bigint', unique: true })
  chatId!: string;

  /** Kanal/guruh nomi (oxirgi ma'lum) */
  @Column({ type: 'varchar', length: 200, nullable: true })
  title!: string | null;

  /** Bot kanaldagi roli (Telegram terminologiyasi) */
  @Column({ type: 'varchar', length: 32, default: 'unknown' })
  botStatus!: TgBotStatus;

  /** Hozir bot kanalda bormi (botStatus='left'|'kicked' bo'lsa false) */
  @Column({ default: false })
  isMember!: boolean;

  /**
   * Qaysi event turlari yuborilsin:
   *   bo'sh array []  → barcha event'lar
   *   ['late','blacklist'] → faqat shularni filter qiladi
   */
  @Column({ type: 'jsonb', default: () => `'[]'::jsonb` })
  enabledEvents!: string[];

  @Column({ default: true })
  isActive!: boolean;

  /** Oxirgi muvaffaqiyatli o'zaro aloqa (test message yoki my_chat_member event) */
  @Column({ type: 'timestamptz', nullable: true })
  lastSeenAt!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  createdByUserId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
