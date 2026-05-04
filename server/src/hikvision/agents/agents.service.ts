import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'node:crypto';
import { AgentEntity } from '../entities/agent.entity';
import { AuthUser } from '../../auth/current-user.decorator';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';

function newToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

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

  async findByToken(token: string): Promise<AgentEntity | null> {
    return this.repo.findOne({ where: { token } });
  }

  async create(current: AuthUser, dto: CreateAgentDto): Promise<AgentEntity> {
    const companyId =
      current.role === 'company_admin' ? current.companyId : dto.companyId;
    if (!companyId) {
      throw new BadRequestException('companyId shart');
    }

    const entity = this.repo.create({
      companyId,
      name: dto.name,
      hostInfo: dto.hostInfo ?? null,
      token: newToken(),
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
    if (dto.name !== undefined) agent.name = dto.name;
    if (dto.hostInfo !== undefined) agent.hostInfo = dto.hostInfo;
    return this.repo.save(agent);
  }

  async remove(current: AuthUser, id: string): Promise<void> {
    const agent = await this.findOne(current, id);
    await this.repo.remove(agent);
  }

  async rotateToken(
    current: AuthUser,
    id: string,
  ): Promise<{ id: string; token: string }> {
    const agent = await this.findOne(current, id);
    agent.token = newToken();
    agent.isOnline = false;
    agent.lastSeenAt = null;
    const saved = await this.repo.save(agent);
    return { id: saved.id, token: saved.token };
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
