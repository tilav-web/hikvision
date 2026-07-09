import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'node:crypto';
import { UsersService } from '../users/users.service';
import { UserEntity } from '../users/user.entity';
import { JwtPayload } from './jwt.strategy';
import { TokenBlocklistService } from './token-blocklist.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly blocklist: TokenBlocklistService,
  ) {}

  /** Logout — token'ni bekor qilish (blocklist'ga qo'shish). */
  async logout(jti: string, expUnix: number): Promise<void> {
    await this.blocklist.revoke(jti, expUnix);
  }

  async validate(email: string, password: string): Promise<UserEntity> {
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedException('invalid credentials');
    if (!user.isActive) throw new UnauthorizedException('user disabled');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('invalid credentials');
    return user;
  }

  async login(email: string, password: string) {
    const user = await this.validate(email, password);
    await this.users.updateLastLogin(user.id);
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      jti: crypto.randomUUID(),
    };
    const accessToken = await this.jwt.signAsync(payload);
    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        companyId: user.companyId,
      },
    };
  }
}
