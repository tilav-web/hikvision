import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';
import { AuthUser } from './current-user.decorator';
import { TokenBlocklistService } from './token-blocklist.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: 'super_admin' | 'company_admin';
  companyId: string | null;
  /** Token identifikatori — bekor qilish (blocklist) uchun. */
  jti?: string;
  /** Amal muddati (unix soniya) — jwt tomonidan avtomatik qo'yiladi. */
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    cfg: ConfigService,
    private readonly users: UsersService,
    private readonly blocklist: TokenBlocklistService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: cfg.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    // Bekor qilingan (logout qilingan) token — darhol rad etamiz.
    if (payload.jti && (await this.blocklist.isRevoked(payload.jti))) {
      throw new UnauthorizedException('token bekor qilingan');
    }
    const user = await this.users.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('user not found or disabled');
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      jti: payload.jti,
      exp: payload.exp,
    };
  }
}
