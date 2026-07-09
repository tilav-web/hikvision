import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '../users/user.entity';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  companyId: string | null;
  /** Token jti — logout (bekor qilish) uchun. */
  jti?: string;
  /** Token exp (unix soniya) — blocklist TTL uchun. */
  exp?: number;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as AuthUser;
  },
);
