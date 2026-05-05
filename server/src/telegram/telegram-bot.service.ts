import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Telegraf } from 'telegraf';
import {
  TelegramChannelEntity,
  TgBotStatus,
} from './entities/telegram-channel.entity';

/**
 * Yagona global Telegram bot. Token .env'dan: TELEGRAM_BOT_TOKEN.
 * Token kiritilmasa bot ishga tushmaydi va `sendMessage` no-op qiladi
 * (bildirishnomalar yo'q, lekin server crash bo'lmaydi — dev convenient).
 *
 * Funksiyalar:
 *  - my_chat_member event'ini eshitadi va kanaldagi bot statusini yangilaydi
 *  - sendMessage(chatId, text) — boshqa servislarga umumiy interfeys
 *  - chat'da bot bor-yo'qligini DB'da kuzatib boradi
 */
@Injectable()
export class TelegramBotService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(TelegramBotService.name);
  private bot: Telegraf | null = null;
  private botUsername: string | null = null;

  constructor(
    private readonly cfg: ConfigService,
    @InjectRepository(TelegramChannelEntity)
    private readonly channelRepo: Repository<TelegramChannelEntity>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const token = this.cfg.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.logger.warn(
        'TELEGRAM_BOT_TOKEN .env\'da yo\'q — bot ishga tushmaydi. Bildirishnomalar yuborilmaydi.',
      );
      return;
    }

    this.bot = new Telegraf(token);

    // my_chat_member: bot kanalga qo'shilganda/chiqarilganda yetib keladi.
    this.bot.on('my_chat_member', async (ctx) => {
      try {
        await this.onMyChatMember(ctx.update.my_chat_member);
      } catch (e) {
        this.logger.warn(
          `my_chat_member processing xato: ${(e as Error).message}`,
        );
      }
    });

    // Polling boshlash. Promise blocklamaydi — fonda davom etadi.
    this.bot
      .launch({ dropPendingUpdates: true })
      .catch((e) =>
        this.logger.error(`Telegram bot launch xato: ${e.message}`),
      );

    try {
      const me = await this.bot.telegram.getMe();
      this.botUsername = me.username;
      this.logger.log(`📨 Telegram bot ishga tushdi: @${me.username}`);
    } catch (e) {
      this.logger.error(`Telegram getMe xato: ${(e as Error).message}`);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.bot) {
      this.bot.stop('app shutdown');
      this.bot = null;
    }
  }

  /** Test/dispatch uchun. Bot ishlamasa silently rad etadi. */
  async sendMessage(
    chatId: string,
    text: string,
    opts: { parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML' } = {},
  ): Promise<{ ok: boolean; error?: string }> {
    if (!this.bot) {
      return { ok: false, error: 'bot ishga tushmagan (token .env\'da yo\'qmi?)' };
    }
    try {
      await this.bot.telegram.sendMessage(chatId, text, {
        parse_mode: opts.parseMode ?? 'HTML',
        disable_web_page_preview: true,
      } as any);
      return { ok: true };
    } catch (e) {
      const msg = (e as Error).message;
      this.logger.warn(`sendMessage xato (${chatId}): ${msg}`);
      return { ok: false, error: msg };
    }
  }

  /** Hozirgi @bot_username (UI'da ko'rsatish uchun). */
  getUsername(): string | null {
    return this.botUsername;
  }

  isReady(): boolean {
    return this.bot !== null;
  }

  // ───── ichki ─────

  private async onMyChatMember(update: any): Promise<void> {
    const chat = update.chat;
    const newStatus: TgBotStatus = update.new_chat_member?.status ?? 'unknown';
    const chatId = String(chat?.id ?? '');
    if (!chatId) return;

    const channel = await this.channelRepo.findOne({ where: { chatId } });
    if (!channel) {
      // Ro'yxatga olinmagan kanal — log faqat (hech kim track qilmasin)
      this.logger.debug(
        `my_chat_member: registered emas chatId=${chatId} status=${newStatus}`,
      );
      return;
    }

    const isMember =
      newStatus === 'administrator' ||
      newStatus === 'creator' ||
      newStatus === 'member';

    channel.botStatus = newStatus;
    channel.isMember = isMember;
    channel.lastSeenAt = new Date();
    if (chat.title && chat.title !== channel.title) {
      channel.title = chat.title;
    }
    await this.channelRepo.save(channel);

    this.logger.log(
      `📡 kanal status yangilandi: ${channel.title ?? chatId} → ${newStatus} (isMember=${isMember})`,
    );
  }
}
