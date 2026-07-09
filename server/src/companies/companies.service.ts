import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'node:crypto';
import { CompanyEntity } from './company.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

function generateApiToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/** Server mahalliy sanasi (YYYY-MM-DD). */
function todayStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(CompanyEntity)
    private readonly repo: Repository<CompanyEntity>,
  ) {}

  list(): Promise<CompanyEntity[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<CompanyEntity> {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('company not found');
    return c;
  }

  async findByApiToken(token: string): Promise<CompanyEntity | null> {
    return this.repo.findOne({ where: { apiToken: token } });
  }

  /**
   * Kompaniya faol va to'lovi amal qilmoqdami? status='active' bo'lishi va
   * paidUntil (agar belgilangan bo'lsa) o'tmaganligi shart.
   */
  isActive(company: CompanyEntity): boolean {
    if (company.status !== 'active') return false;
    if (company.paidUntil) {
      const until = String(company.paidUntil).slice(0, 10);
      if (todayStr() > until) return false; // to'lov muddati o'tgan
    }
    return true;
  }

  async create(dto: CreateCompanyDto): Promise<CompanyEntity> {
    const slug = dto.slug.toLowerCase();
    const exists = await this.repo.findOne({ where: { slug } });
    if (exists) throw new ConflictException('slug already in use');

    const company = this.repo.create({
      name: dto.name,
      slug,
      apiToken: generateApiToken(),
      status: dto.status ?? 'active',
      paidFrom: dto.paidFrom ? new Date(dto.paidFrom) : null,
      paidUntil: dto.paidUntil ? new Date(dto.paidUntil) : null,
      maxDevices: dto.maxDevices ?? 0,
      maxEmployees: dto.maxEmployees ?? 0,
      contactPhone: dto.contactPhone ?? null,
      contactEmail: dto.contactEmail ?? null,
      notes: dto.notes ?? null,
    });
    return this.repo.save(company);
  }

  async update(id: string, dto: UpdateCompanyDto): Promise<CompanyEntity> {
    const company = await this.findById(id);
    if (dto.name !== undefined) company.name = dto.name;
    if (dto.status !== undefined) company.status = dto.status;
    if (dto.paidFrom !== undefined) {
      company.paidFrom = dto.paidFrom ? new Date(dto.paidFrom) : null;
    }
    if (dto.paidUntil !== undefined) {
      company.paidUntil = dto.paidUntil ? new Date(dto.paidUntil) : null;
    }
    if (dto.maxDevices !== undefined) company.maxDevices = dto.maxDevices;
    if (dto.maxEmployees !== undefined) company.maxEmployees = dto.maxEmployees;
    if (dto.contactPhone !== undefined) company.contactPhone = dto.contactPhone;
    if (dto.contactEmail !== undefined) company.contactEmail = dto.contactEmail;
    if (dto.notes !== undefined) company.notes = dto.notes;
    return this.repo.save(company);
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete(id);
    if (!res.affected) throw new NotFoundException('company not found');
  }

  /**
   * Tokenni yangilash. Eski token darhol bekor bo'ladi va shu kampaniya
   * agentlari qayta ulana olmaydi (yangi tokenni .env ga joylash kerak).
   */
  async rotateApiToken(id: string): Promise<{ apiToken: string }> {
    const company = await this.findById(id);
    company.apiToken = generateApiToken();
    await this.repo.save(company);
    return { apiToken: company.apiToken };
  }
}
