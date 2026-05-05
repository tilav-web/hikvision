import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { TelegramChannelEntity } from './entities/telegram-channel.entity';
import { TelegramBotService } from './telegram-bot.service';
import { EventType, formatEvent } from './templates';

/**
 * Bildirishnoma dispatch'i. Boshqa servislardan event bo'yicha chaqiriladi
 * — kompaniya kanallari + super_admin global kanallariga yetkazadi.
 *
 * Qo'shimcha xato bermaydi (notification kanali asosiy oqimni buzmasligi shart):
 * yuborishda xato bo'lsa log qiladi va davom etadi.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(TelegramChannelEntity)
    private readonly channelRepo: Repository<TelegramChannelEntity>,
    private readonly bot: TelegramBotService,
  ) {}

  /**
   * Event'ni mos kanallarga yuborish.
   *
   * @param eventType  Event turi (late, blacklist, agent_offline)
   * @param companyId  Kampaniya ID (super_admin global kanallar ham qo'shimcha tarzda oladi).
   *                   null bo'lsa — faqat global kanallarga yuboriladi.
   * @param payload    Template'ga yuboriladigan ma'lumot
   */
  async dispatch(
    eventType: EventType,
    companyId: string | null,
    payload: Record<string, any>,
  ): Promise<void> {
    if (!this.bot.isReady()) {
      this.logger.debug(
        `notification skipped: bot ready emas (event=${eventType})`,
      );
      return;
    }

    let channels: TelegramChannelEntity[];
    try {
      // companyId belgilangan bo'lsa: o'sha kampaniya kanallari + global kanallar
      // null bo'lsa: faqat global
      const where = companyId
        ? [
            { companyId, isMember: true, isActive: true },
            { companyId: IsNull(), isMember: true, isActive: true },
          ]
        : [{ companyId: IsNull(), isMember: true, isActive: true }];
      channels = await this.channelRepo.find({ where });
    } catch (e) {
      this.logger.warn(
        `notification kanal so'rovi xato: ${(e as Error).message}`,
      );
      return;
    }

    if (channels.length === 0) return;

    // enabledEvents bo'sh — barcha event'lar; yoki shu event'ni o'z ichiga olsa
    const matching = channels.filter(
      (c) =>
        !c.enabledEvents ||
        c.enabledEvents.length === 0 ||
        c.enabledEvents.includes(eventType),
    );
    if (matching.length === 0) return;

    const text = formatEvent(eventType, payload);

    // Parallel — birining xatosi boshqalarni bloklash kerak emas
    await Promise.allSettled(
      matching.map(async (ch) => {
        const res = await this.bot.sendMessage(ch.chatId, text);
        if (!res.ok) {
          this.logger.warn(
            `notification yuborilmadi (${ch.title ?? ch.chatId}): ${res.error}`,
          );
          // Xato "chat not found" yoki "bot was kicked" bo'lsa — isMember false qilamiz
          if (
            res.error?.match(/not found|kicked|forbidden|chat_id is empty/i)
          ) {
            await this.channelRepo
              .update(ch.id, { isMember: false, botStatus: 'kicked' })
              .catch(() => undefined);
          }
        } else {
          await this.channelRepo
            .update(ch.id, { lastSeenAt: new Date() })
            .catch(() => undefined);
        }
      }),
    );
  }
}

