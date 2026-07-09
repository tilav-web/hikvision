import { Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { AttendanceService } from './attendance.service';
import { AuthUser } from '../../auth/current-user.decorator';

/**
 * Davomat hisobotini Excel (.xlsx) formatida generatsiya qiladi.
 * HR uchun eng ko'p kerak bo'ladigan eksport — har hodim bo'yicha xulosa.
 */
@Injectable()
export class AttendanceExportService {
  constructor(private readonly attendance: AttendanceService) {}

  async perPersonXlsx(opts: {
    current: AuthUser;
    companyId?: string;
    from?: string;
    to?: string;
  }): Promise<Buffer> {
    const rows = await this.attendance.perPerson(opts);

    const wb = new Workbook();
    wb.creator = 'Hikvision Management System';
    wb.created = new Date(opts.from ? opts.from + 'T00:00:00Z' : Date.now());
    const ws = wb.addWorksheet('Davomat');

    ws.columns = [
      { header: 'Tabel', key: 'employeeNo', width: 12 },
      { header: 'Hodim', key: 'personName', width: 28 },
      { header: 'Jami kun', key: 'totalDays', width: 10 },
      { header: 'Kelgan', key: 'presentDays', width: 10 },
      { header: 'Kechikkan', key: 'lateDays', width: 11 },
      { header: 'Kelmagan', key: 'absentDays', width: 11 },
      { header: "Ta'til", key: 'leaveDays', width: 9 },
      { header: 'Kechikish (daq)', key: 'totalLateMinutes', width: 16 },
      { header: 'Ishlangan (daq)', key: 'totalWorkedMinutes', width: 16 },
      { header: 'Tushlik oshgan (daq)', key: 'totalLunchOverstay', width: 20 },
    ];

    const header = ws.getRow(1);
    header.font = { bold: true };
    header.alignment = { vertical: 'middle' };

    for (const r of rows) {
      ws.addRow({
        employeeNo: r.employeeNo,
        personName: r.personName,
        totalDays: r.totalDays,
        presentDays: r.presentDays,
        lateDays: r.lateDays,
        absentDays: r.absentDays,
        leaveDays: r.leaveDays,
        totalLateMinutes: r.totalLateMinutes,
        totalWorkedMinutes: r.totalWorkedMinutes,
        totalLunchOverstay: r.totalLunchOverstay,
      });
    }

    ws.autoFilter = { from: 'A1', to: 'J1' };
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }
}
