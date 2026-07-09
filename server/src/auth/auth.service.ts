import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'node:crypto';
import { UsersService } from '../users/users.service';
import { UserEntity } from '../users/user.entity';
import { JwtPayload } from './jwt.strategy';
import { TokenBlocklistService } from './token-blocklist.service';

/** '15m' / '30d' kabi qatorni soniyaga aylantiradi. */
function parseDurationSec(s: string): number {
  const m = /^(\d+)\s*([smhd])$/.exec(s.trim());
  if (!m) return 30 * 24 * 3600;
  const n = parseInt(m[1], 10);
  const mult: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return n * (mult[m[2]] ?? 1);
}

@Injectable()
export class AuthService {
  private readonly accessTtl: string;
  private readonly refreshTtl: string;
  private readonly refreshTtlSec: number;

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly blocklist: TokenBlocklistService,
    private readonly cfg: ConfigService,
  ) {
    // Qisqa access (default 15m), uzoq refresh (default 30d). Refresh oqimi
    // uzluksizlikni ta'minlaydi, shuning uchun eski JWT_EXPIRES_IN=7d'ga
    // ATAYLAB fallback qilmaymiz — aks holda access qisqa bo'lmay qoladi.
    this.accessTtl = cfg.get<string>('ACCESS_EXPIRES_IN', '15m');
    this.refreshTtl = cfg.get<string>('REFRESH_EXPIRES_IN', '30d');
    this.refreshTtlSec = parseDurationSec(this.refreshTtl);
  }

  /** Logout — access'ni blocklist'ga, refresh'ni (berilgan bo'lsa) whitelist'dan. */
  async logout(
    accessJti: string,
    accessExp: number,
    refreshToken?: string,
  ): Promise<void> {
    await this.blocklist.revoke(accessJti, accessExp);
    if (refreshToken) {
      const p = this.safeDecode(refreshToken);
      if (p?.jti) await this.blocklist.revokeRefresh(p.jti);
    }
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
    return this.issueTokens(user);
  }

  /**
   * Refresh — access muddati tugagach yangi juftlik beradi. Rotatsiya:
   * eski refresh bekor qilinadi, yangisi beriladi. Qayta ishlatilgan
   * (o'g'irlangan) refresh whitelist'da bo'lmaydi → rad etiladi.
   */
  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException('refresh token yaroqsiz yoki muddati tugagan');
    }
    if (payload.type !== 'refresh' || !payload.jti) {
      throw new UnauthorizedException('refresh token emas');
    }
    if (!(await this.blocklist.isRefreshValid(payload.jti))) {
      throw new UnauthorizedException(
        'refresh token bekor qilingan yoki allaqachon ishlatilgan',
      );
    }
    await this.blocklist.revokeRefresh(payload.jti); // rotatsiya
    const user = await this.users.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('user not found or disabled');
    }
    return this.issueTokens(user);
  }

  private async issueTokens(user: UserEntity) {
    const base = {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    };
    const accessToken = await this.jwt.signAsync(
      { ...base, type: 'access', jti: crypto.randomUUID() },
      { expiresIn: this.accessTtl as unknown as number },
    );
    const refreshJti = crypto.randomUUID();
    const refreshToken = await this.jwt.signAsync(
      { ...base, type: 'refresh', jti: refreshJti },
      { expiresIn: this.refreshTtl as unknown as number },
    );
    await this.blocklist.allowRefresh(refreshJti, user.id, this.refreshTtlSec);
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        companyId: user.companyId,
      },
    };
  }

  private safeDecode(token: string): JwtPayload | null {
    try {
      return this.jwt.decode(token) as JwtPayload;
    } catch {
      return null;
    }
  }
}
