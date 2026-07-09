import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { PersonsService } from './persons.service';
import { AuthUser } from '../../auth/current-user.decorator';

/** Excel ustun sarlavhalari → DTO maydonlari (kichik harf, bir nechta alias). */
const HEADER_ALIASES: Record<string, string> = {
  ism: 'name',
  'f.i.o': 'name',
  fio: 'name',
  name: 'name',
  tabel: 'employeeNo',
  'tabel raqami': 'employeeNo',
  employeeno: 'employeeNo',
  karta: 'cardNo',
  'karta raqami': 'cardNo',
  card: 'cardNo',
  cardno: 'cardNo',
  pin: 'pin',
  telefon: 'phone',
  phone: 'phone',
  lavozim: 'position',
  position: 'position',
  maosh: 'baseSalary',
  oylik: 'baseSalary',
  salary: 'baseSalary',
  basesalary: 'baseSalary',
};

/**
 * Hodimlarni Excel (.xlsx) fayldan ommaviy import qilish.
 * Birinchi qator — sarlavhalar (ustunlar nomi bilan aniqlanadi, tartibi muhim emas).
 * Har qator PersonsService.create orqali yaratiladi (kvota, unikallik, avto-tabel
 * — hammasi bir xil biznes-mantiq).
 */
@Injectable()
export class PersonsImportService {
  private readonly logger = new Logger(PersonsImportService.name);

  constructor(private readonly persons: PersonsService) {}

  async importXlsx(
    current: AuthUser,
    buffer: Buffer,
    companyId?: string,
  ): Promise<{
    created: Array<{ employeeNo: string; name: string }>;
    skipped: Array<{ row: number; name: string; reason: string }>;
  }> {
    const wb = new Workbook();
    try {
      // exceljs Buffer tipi @types/node bilan to'liq mos kelmaydi — cast.
      await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    } catch {
      throw new BadRequestException('Faylni o\'qib bo\'lmadi — .xlsx bo\'lishi kerak');
    }
    const ws = wb.worksheets[0];
    if (!ws || ws.rowCount < 2) {
      throw new BadRequestException('Fayl bo\'sh yoki ma\'lumot yo\'q');
    }

    const colMap: Record<string, number> = {};
    ws.getRow(1).eachCell((cell, col) => {
      const h = String(cell.value ?? '').trim().toLowerCase();
      const field = HEADER_ALIASES[h];
      if (field && colMap[field] == null) colMap[field] = col;
    });
    if (colMap.name == null) {
      throw new BadRequestException(
        '«Ism» (yoki «F.I.O»/«name») ustuni topilmadi',
      );
    }

    const created: Array<{ employeeNo: string; name: string }> = [];
    const skipped: Array<{ row: number; name: string; reason: string }> = [];

    const cellStr = (row: number, field: string): string => {
      const col = colMap[field];
      if (col == null) return '';
      const v = ws.getRow(row).getCell(col).value;
      if (v == null) return '';
      if (typeof v === 'object' && 'text' in v) return String(v.text).trim();
      return String(v).trim();
    };

    for (let r = 2; r <= ws.rowCount; r++) {
      const name = cellStr(r, 'name');
      if (!name) continue; // bo'sh qator — o'tkazamiz
      const dto: Record<string, unknown> = {
        companyId,
        name,
        employeeNo: cellStr(r, 'employeeNo') || undefined,
        cardNo: cellStr(r, 'cardNo') || undefined,
        pin: cellStr(r, 'pin') || undefined,
        phone: cellStr(r, 'phone') || undefined,
        position: cellStr(r, 'position') || undefined,
        baseSalary: cellStr(r, 'baseSalary') || undefined,
      };
      try {
        const p = await this.persons.create(current, dto as never);
        created.push({ employeeNo: p.employeeNo, name: p.name });
      } catch (e) {
        skipped.push({ row: r, name, reason: (e as Error).message });
      }
    }

    this.logger.log(
      `import: ${created.length} yaratildi, ${skipped.length} o'tkazildi`,
    );
    return { created, skipped };
  }
}
