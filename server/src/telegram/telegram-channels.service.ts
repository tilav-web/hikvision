import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { TelegramChannelEntity } from './entities/telegram-channel.entity';
import { TelegramBotService } from './telegram-bot.service';
import { CompanyEntity } from '../companies/company.entity';
import { AuthUser } from '../auth/current-user.decorator';
import { CreateTelegramChannelDto } from './dto/create-channel.dto';
import { UpdateTelegramChannelDto } from './dto/update-channel.dto';
import { testTemplate } from './templates';

/**
 * Telegram kanallar CRUD + verifikatsiya.
 *
 * Multi-tenant qoidalar:
 *   - super_admin: barcha kanallar (har qanday companyId yoki global)
 *   - company_admin: faqat o'z kampaniyasi kanallari (companyId guard)
 *
 * Yaratish:
 *   - Yangi kanal ID kiritilganda server "✅ Bog'landi" test xabarini yuboradi
 *   - Muvaffaqiyatli bo'lsa botStatus 'member', isMember=true sifatida saqlanadi
 *   - Xato bo'lsa 400 va kanal saqlanmaydi (admin nima bo'lganini ko'radi)
 */
@Injectable()
export class TelegramChannelsService {
  constructor(
    @InjectRepository(TelegramChannelEntity)
    private readonly repo: Repository<TelegramChannelEntity>,
    @InjectRepository(CompanyEntity)
    private readonly companyRepo: Repository<CompanyEntity>,
    private readonly bot: TelegramBotService,
  ) {}

  async list(opts: {
    current: AuthUser;
    companyId?: string;
    onlyGlobal?: boolean;
  }): Promise<TelegramChannelEntity[]> {
    const where: Record<string, any> = {};
    if (opts.current.role === 'company_admin') {
      where.companyId = opts.current.companyId;
    } else if (opts.onlyGlobal) {
      where.companyId = IsNull();
    } else if (opts.companyId) {
      where.companyId = opts.companyId;
    }
    return this.repo.find({
      where,
      order: { createdAt: 'DESC' },
      relations: { company: true },
    });
  }

  async findOne(
    current: AuthUser,
    id: string,
  ): Promise<TelegramChannelEntity> {
    const ch = await this.repo.findOne({
      where: { id },
      relations: { company: true },
    });
    if (!ch) throw new NotFoundException('kanal topilmadi');
    this.assertAccess(current, ch.companyId);
    return ch;
  }

  async create(
    current: AuthUser,
    dto: CreateTelegramChannelDto,
  ): Promise<TelegramChannelEntity> {
    if (!this.bot.isReady()) {
      throw new BadRequestException(
        'Telegram bot ishga tushmagan (TELEGRAM_BOT_TOKEN kiritilmagan)',
      );
    }

    // companyId — RBAC tushuntiruvi:
    //   super_admin: dto.companyId nima berilsa shu (bo'sh = global)
    //   company_admin: doim o'z kampaniyasi (dto.companyId e'tiborga olinmaydi)
    const companyId =
      current.role === 'company_admin'
        ? current.companyId
        : (dto.companyId ?? null);

    if (companyId) {
      const exists = await this.companyRepo.findOne({
        where: { id: companyId },
      });
      if (!exists) {
        throw new BadRequestException(`kampaniya ${companyId} topilmadi`);
      }
    }

    // Duplikat tekshiruvi
    const existing = await this.repo.findOne({ where: { chatId: dto.chatId } });
    if (existing) {
      throw new ConflictException(
        `Bu chat_id (${dto.chatId}) allaqachon ro'yxatda`,
      );
    }

    // Test xabar yuboramiz — bot kanalda admin bo'lib turishi va xabar yuborish huquqiga ega bo'lishini tekshiradi
    const testText = testTemplate({
      channelTitle: dto.title,
    });
    const send = await this.bot.sendMessage(dto.chatId, testText);
    if (!send.ok) {
      throw new BadRequestException(
        `Test xabar yuborilmadi: ${send.error}. Bot kanalda admin qilinganmi va xabar yuborish huquqi bormi?`,
      );
    }

    const entity = this.repo.create({
      companyId,
      chatId: dto.chatId,
      title: dto.title ?? null,
      botStatus: 'member',
      isMember: true,
      enabledEvents: dto.enabledEvents ?? [],
      isActive: dto.isActive ?? true,
      lastSeenAt: new Date(),
      createdByUserId: current.id,
    });
    return this.repo.save(entity);
  }

  async update(
    current: AuthUser,
    id: string,
    dto: UpdateTelegramChannelDto,
  ): Promise<TelegramChannelEntity> {
    const ch = await this.findOne(current, id);
    if (dto.title !== undefined) ch.title = dto.title || null;
    if (dto.enabledEvents !== undefined) ch.enabledEvents = dto.enabledEvents;
    if (dto.isActive !== undefined) ch.isActive = dto.isActive;
    return this.repo.save(ch);
  }

  async remove(current: AuthUser, id: string): Promise<void> {
    const ch = await this.findOne(current, id);
    await this.repo.remove(ch);
  }

  /** Test xabar yuborish — UI tugmasi orqali. */
  async sendTest(
    current: AuthUser,
    id: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const ch = await this.findOne(current, id);
    const text = testTemplate({
      channelTitle: ch.title ?? undefined,
      companyName: ch.company?.name,
    });
    const res = await this.bot.sendMessage(ch.chatId, text);
    if (res.ok) {
      await this.repo.update(ch.id, { lastSeenAt: new Date() });
    }
    return res;
  }

  // ───── ichki ─────

  private assertAccess(
    current: AuthUser,
    companyId: string | null,
  ): void {
    if (current.role !== 'company_admin') return;
    if (companyId !== current.companyId) {
      throw new ForbiddenException('boshqa kampaniya kanaliga ruxsat yo\'q');
    }
  }
}
