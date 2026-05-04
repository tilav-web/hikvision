import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { UserEntity } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repo: Repository<UserEntity>,
  ) {}

  async findById(id: string): Promise<UserEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.repo.findOne({ where: { email: email.toLowerCase() } });
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.repo.update(id, { lastLoginAt: new Date() });
  }

  async listAll(): Promise<UserEntity[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async listByCompany(companyId: string): Promise<UserEntity[]> {
    return this.repo.find({
      where: { companyId },
      order: { createdAt: 'DESC' },
    });
  }

  async create(dto: CreateUserDto): Promise<UserEntity> {
    const email = dto.email.toLowerCase();
    const existing = await this.findByEmail(email);
    if (existing) throw new ConflictException('email already in use');

    if (dto.role === 'company_admin' && !dto.companyId) {
      throw new BadRequestException('companyId is required for company_admin');
    }
    if (dto.role === 'super_admin' && dto.companyId) {
      throw new BadRequestException('super_admin cannot belong to a company');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.repo.create({
      email,
      passwordHash,
      fullName: dto.fullName,
      role: dto.role,
      companyId: dto.companyId ?? null,
      isActive: dto.isActive ?? true,
    });
    return this.repo.save(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserEntity> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('user not found');

    if (dto.fullName !== undefined) user.fullName = dto.fullName;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    if (dto.password) user.passwordHash = await bcrypt.hash(dto.password, 10);

    return this.repo.save(user);
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete(id);
    if (!res.affected) throw new NotFoundException('user not found');
  }

  async ensureSuperAdmin(
    email: string,
    password: string,
    fullName: string,
  ): Promise<void> {
    const existing = await this.findByEmail(email);
    if (existing) return;
    const passwordHash = await bcrypt.hash(password, 10);
    await this.repo.save(
      this.repo.create({
        email: email.toLowerCase(),
        passwordHash,
        fullName,
        role: 'super_admin',
        companyId: null,
        isActive: true,
      }),
    );
  }
}
