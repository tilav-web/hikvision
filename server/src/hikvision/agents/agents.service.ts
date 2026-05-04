import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentEntity } from '../entities/agent.entity';
import { AuthUser } from '../../auth/current-user.decorator';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';

@Injectable()
export class AgentsService {
  constructor(
    @InjectRepository(AgentEntity)
    private readonly repo: Repository<AgentEntity>,
  ) {}

  /** super_admin barchasini, company_admin faqat o'z kampaniyasini ko'radi */
  async list(current: AuthUser, companyId?: string): Promise<AgentEntity[]> {
    const where: Record<string, any> = {};
    if (current.role === 'company_admin') {
      where.companyId = current.companyId!;
    } else if (companyId) {
      where.companyId = companyId;
    }
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  async findOne(current: AuthUser, id: string): Promise<AgentEntity> {
    const agent = await this.repo.findOne({ where: { id } });
    if (!agent) throw new NotFoundException('agent topilmadi');
    this.assertAccess(current, agent.companyId);
    return agent;
  }

  /**
   * Yangi agentni admin paneldan oldindan yaratish (qurilmalarni biriktirish uchun).
   * Agent qurilmasida AGENT_NAME shu yerdagi name bilan bir xil bo'lishi kerak.
   * Aks holda agent ulanganda avtomatik yangi yozuv yaratiladi (companyId, name).
   */
  async create(current: AuthUser, dto: CreateAgentDto): Promise<AgentEntity> {
    const companyId =
      current.role === 'company_admin' ? current.companyId : dto.companyId;
    if (!companyId) {
      throw new BadRequestException('companyId shart');
    }

    const existing = await this.repo.findOne({
      where: { companyId, name: dto.name.trim() },
    });
    if (existing) {
      throw new ConflictException(
        `bu kampaniyada "${dto.name}" nomli agent allaqachon mavjud`,
      );
    }

    const entity = this.repo.create({
      companyId,
      name: dto.name.trim(),
      hostInfo: dto.hostInfo ?? null,
      isOnline: false,
      lastSeenAt: null,
    });
    return this.repo.save(entity);
  }

  async update(
    current: AuthUser,
    id: string,
    dto: UpdateAgentDto,
  ): Promise<AgentEntity> {
    const agent = await this.findOne(current, id);
    if (dto.name !== undefined) agent.name = dto.name.trim();
    if (dto.hostInfo !== undefined) agent.hostInfo = dto.hostInfo;
    return this.repo.save(agent);
  }

  async remove(current: AuthUser, id: string): Promise<void> {
    const agent = await this.findOne(current, id);
    await this.repo.remove(agent);
  }

  /**
   * Agent ulanganida chaqiriladi — companyId + name bo'yicha topadi yoki yaratadi.
   * Bu auto-registration: mijoz oldindan admin panelda agent yaratmasdan ham
   * shunchaki AGENT_NAME bilan ulansa, yangi yozuv avtomatik paydo bo'ladi.
   */
  async findOrCreateForConnect(
    companyId: string,
    name: string,
  ): Promise<AgentEntity> {
    const existing = await this.repo.findOne({
      where: { companyId, name },
    });
    if (existing) return existing;
    const created = this.repo.create({
      companyId,
      name,
      isOnline: false,
      lastSeenAt: null,
    });
    return this.repo.save(created);
  }

  private assertAccess(current: AuthUser, companyId: string | null): void {
    if (
      current.role === 'company_admin' &&
      companyId !== current.companyId
    ) {
      throw new ForbiddenException('boshqa kampaniya agentiga ruxsat yo\'q');
    }
  }
}
