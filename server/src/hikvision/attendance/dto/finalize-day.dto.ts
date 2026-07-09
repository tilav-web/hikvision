import { IsOptional, Matches } from 'class-validator';

export class FinalizeDayDto {
  /** YYYY-MM-DD. Bo'sh bo'lsa — kechagi kun. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date YYYY-MM-DD formatida bo\'lishi kerak',
  })
  date?: string;
}
