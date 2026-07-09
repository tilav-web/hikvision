import {
  CallHandler,
  ClassSerializerInterceptor,
  ExecutionContext,
  Injectable,
  PlainLiteralObject,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Global serializer — `@Exclude()` bilan belgilangan maydonlarni (masalan
 * `passwordHash`, `passwordEnc`) har qanday HTTP javobdan olib tashlaydi.
 *
 * Qo'shimcha: joriy foydalanuvchi rolini class-transformer "group" sifatida
 * uzatadi, shunda `@Expose({ groups: ['super_admin'] })` bilan belgilangan
 * maydon (masalan kompaniya `apiToken`i) faqat super_admin javoblarida ko'rinadi.
 *
 * HTTP bo'lmagan kontekstlarda (WebSocket gateway) standart xatti-harakat
 * ishlatiladi — u yerda entity javob qaytarilmaydi.
 */
@Injectable()
export class RoleSerializerInterceptor extends ClassSerializerInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return super.intercept(context, next);
    }
    const req = context.switchToHttp().getRequest();
    const role: string | undefined = req?.user?.role;
    const options = {
      ...this.defaultOptions,
      groups: role ? [role] : [],
    };
    return next
      .handle()
      .pipe(
        map((res: PlainLiteralObject | Array<PlainLiteralObject>) =>
          this.serialize(res, options),
        ),
      );
  }
}
