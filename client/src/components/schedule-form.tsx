import { useEffect, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Company, Schedule } from '@/api/types';
import type { ScheduleInput } from '@/api/schedules';

const DAYS = [
  { bit: 1, label: 'Du' },
  { bit: 2, label: 'Se' },
  { bit: 4, label: 'Ch' },
  { bit: 8, label: 'Pa' },
  { bit: 16, label: 'Ju' },
  { bit: 32, label: 'Sh' },
  { bit: 64, label: 'Ya' },
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: Schedule | null;
  companies: Company[];
  isSuper: boolean;
  loading: boolean;
  onSubmit: (dto: ScheduleInput) => void;
}

export function ScheduleForm({
  open,
  onOpenChange,
  initial,
  companies,
  isSuper,
  loading,
  onSubmit,
}: Props) {
  const isEdit = !!initial;
  const [name, setName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [days, setDays] = useState(31);
  const [grace, setGrace] = useState('5');
  const [lateThreshold, setLateThreshold] = useState('10');
  const [earlyThreshold, setEarlyThreshold] = useState('10');
  const [penaltyRate, setPenaltyRate] = useState('1500');
  const [bonusRate, setBonusRate] = useState('0');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setCompanyId(initial?.companyId ?? '');
      setStartTime(initial?.startTime ?? '09:00');
      setEndTime(initial?.endTime ?? '18:00');
      setDays(initial?.workingDays ?? 31);
      setGrace(String(initial?.graceMinutes ?? 5));
      setLateThreshold(String(initial?.lateThresholdMinutes ?? 10));
      setEarlyThreshold(String(initial?.earlyLeaveThresholdMinutes ?? 10));
      setPenaltyRate(initial?.penaltyPerLateMinute ?? '1500');
      setBonusRate(initial?.bonusPerEarlyMinute ?? '0');
      setIsActive(initial?.isActive ?? true);
    }
  }, [open, initial]);

  const toggleDay = (bit: number) => {
    setDays((d) => (d & bit ? d & ~bit : d | bit));
  };

  const handle = (e: FormEvent) => {
    e.preventDefault();
    const dto: ScheduleInput = {
      name: name.trim(),
      startTime,
      endTime,
      workingDays: days,
      graceMinutes: parseInt(grace, 10),
      lateThresholdMinutes: parseInt(lateThreshold, 10),
      earlyLeaveThresholdMinutes: parseInt(earlyThreshold, 10),
      penaltyPerLateMinute: penaltyRate || '0',
      bonusPerEarlyMinute: bonusRate || '0',
      isActive,
    };
    if (!isEdit && isSuper) dto.companyId = companyId || undefined;
    onSubmit(dto);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Jadvalni tahrirlash' : 'Yangi jadval'}</DialogTitle>
          <DialogDescription>
            Hodimlarni shu jadvalga biriktirib, kechikishni avtomatik hisoblash mumkin.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handle} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="s-name">Nomi</Label>
              <Input
                id="s-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Standart 9-18"
              />
            </div>

            {!isEdit && isSuper && (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="s-company">Kampaniya</Label>
                <Select
                  id="s-company"
                  required
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                >
                  <option value="">Tanlang...</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="s-start">Boshlanish vaqti</Label>
              <Input
                id="s-start"
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-end">Tugash vaqti</Label>
              <Input
                id="s-end"
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Ish kunlari</Label>
              <div className="flex gap-1">
                {DAYS.map((d) => (
                  <button
                    key={d.bit}
                    type="button"
                    onClick={() => toggleDay(d.bit)}
                    className={`flex-1 h-9 rounded-md text-sm font-medium transition-colors ${
                      days & d.bit
                        ? 'bg-(--color-primary) text-(--color-primary-foreground)'
                        : 'bg-(--color-secondary) text-(--color-secondary-foreground) hover:bg-(--color-secondary)/80'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="s-grace">Kechikish "ruxsat" (daq)</Label>
              <Input
                id="s-grace"
                type="number"
                min={0}
                value={grace}
                onChange={(e) => setGrace(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-lt">Jarima boshlanish chegarasi (daq)</Label>
              <Input
                id="s-lt"
                type="number"
                min={0}
                value={lateThreshold}
                onChange={(e) => setLateThreshold(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-pr">1 daq jarima (so'm)</Label>
              <Input
                id="s-pr"
                type="number"
                min={0}
                value={penaltyRate}
                onChange={(e) => setPenaltyRate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-br">1 daq mukofot (so'm)</Label>
              <Input
                id="s-br"
                type="number"
                min={0}
                value={bonusRate}
                onChange={(e) => setBonusRate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="s-active"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-(--color-border)"
            />
            <Label htmlFor="s-active" className="cursor-pointer">
              Faol
            </Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Bekor qilish
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="animate-spin" />}
              Saqlash
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
