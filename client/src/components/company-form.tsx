import { useEffect, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Company, CompanyStatus } from '@/api/types';
import type { CompanyInput } from '@/api/companies';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Company | null;
  loading?: boolean;
  onSubmit: (dto: CompanyInput) => void;
}

function toDateInput(d: string | null | undefined): string {
  if (!d) return '';
  return d.slice(0, 10);
}

export function CompanyForm({ open, onOpenChange, initial, loading, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState<CompanyStatus>('active');
  const [paidFrom, setPaidFrom] = useState('');
  const [paidUntil, setPaidUntil] = useState('');
  const [maxDevices, setMaxDevices] = useState('1');
  const [maxEmployees, setMaxEmployees] = useState('50');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setSlug(initial?.slug ?? '');
      setStatus(initial?.status ?? 'active');
      setPaidFrom(toDateInput(initial?.paidFrom));
      setPaidUntil(toDateInput(initial?.paidUntil));
      setMaxDevices(String(initial?.maxDevices ?? 1));
      setMaxEmployees(String(initial?.maxEmployees ?? 50));
      setContactPhone(initial?.contactPhone ?? '');
      setContactEmail(initial?.contactEmail ?? '');
      setNotes(initial?.notes ?? '');
    }
  }, [open, initial]);

  const handle = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      status,
      paidFrom: paidFrom || null,
      paidUntil: paidUntil || null,
      maxDevices: Number(maxDevices) || 0,
      maxEmployees: Number(maxEmployees) || 0,
      contactPhone: contactPhone.trim() || null,
      contactEmail: contactEmail.trim() || null,
      notes: notes.trim() || null,
    });
  };

  const isEdit = !!initial;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Kampaniyani tahrirlash' : 'Yangi kampaniya'}
          </DialogTitle>
          <DialogDescription>
            To'lov muddati o'tsa ham tizim ishlashda davom etadi. To'xtatish uchun
            holatni "disabled" ga o'tkazing.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handle} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="c-name">Nomi</Label>
              <Input
                id="c-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Inc"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-slug">Slug</Label>
              <Input
                id="c-slug"
                required
                disabled={isEdit}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="acme"
                pattern="[a-z0-9-]+"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-status">Holat</Label>
              <Select
                id="c-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as CompanyStatus)}
              >
                <option value="active">Faol</option>
                <option value="disabled">To'xtatilgan</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-phone">Telefon</Label>
              <Input
                id="c-phone"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+998 90 123 45 67"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-from">To'lov boshlandi</Label>
              <Input
                id="c-from"
                type="date"
                value={paidFrom}
                onChange={(e) => setPaidFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-until">To'lov muddati</Label>
              <Input
                id="c-until"
                type="date"
                value={paidUntil}
                onChange={(e) => setPaidUntil(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-md">Qurilmalar limiti</Label>
              <Input
                id="c-md"
                type="number"
                min={0}
                value={maxDevices}
                onChange={(e) => setMaxDevices(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-me">Hodimlar limiti</Label>
              <Input
                id="c-me"
                type="number"
                min={0}
                value={maxEmployees}
                onChange={(e) => setMaxEmployees(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="c-email">Email</Label>
              <Input
                id="c-email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="c-notes">Eslatma</Label>
              <Textarea
                id="c-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
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
