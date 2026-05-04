import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Company, Device, Person } from '@/api/types';
import type { PersonInput } from '@/api/persons';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: Person | null;
  companies: Company[];
  devices: Device[];
  isSuper: boolean;
  loading: boolean;
  onSubmit: (dto: PersonInput, file?: File) => void;
}

export function PersonForm({
  open,
  onOpenChange,
  initial,
  companies,
  devices,
  isSuper,
  loading,
  onSubmit,
}: Props) {
  const isEdit = !!initial;
  const [employeeNo, setEmployeeNo] = useState('');
  const [name, setName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'unknown'>('unknown');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [cardNo, setCardNo] = useState('');
  const [deviceIds, setDeviceIds] = useState<string[]>([]);
  const [autoSync, setAutoSync] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setEmployeeNo(initial?.employeeNo ?? '');
      setName(initial?.name ?? '');
      setCompanyId(initial?.companyId ?? '');
      setGender(initial?.gender ?? 'unknown');
      setPhone(initial?.phone ?? '');
      setEmail(initial?.email ?? '');
      setPin('');
      setCardNo(initial?.cardNo ?? '');
      setDeviceIds(initial?.deviceLinks?.map((l) => l.deviceId) ?? []);
      setAutoSync(true);
      setFile(null);
      setPreview(initial?.faceImagePath ? `/uploads/faces/${initial.id}.jpg` : null);
    }
  }, [open, initial]);

  const filteredDevices = devices.filter(
    (d) => !companyId || !d.companyId || d.companyId === companyId,
  );

  const onFile = (f: File | null) => {
    setFile(f);
    if (f) {
      const url = URL.createObjectURL(f);
      setPreview(url);
    }
  };

  const toggleDevice = (id: string) => {
    setDeviceIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  };

  const handle = (e: FormEvent) => {
    e.preventDefault();
    const dto: PersonInput = {
      employeeNo: employeeNo.trim(),
      name: name.trim(),
      gender,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      pin: pin.trim() || undefined,
      cardNo: cardNo.trim() || undefined,
      deviceIds: deviceIds.length ? deviceIds : undefined,
      autoSync,
    };
    if (!isEdit && isSuper) {
      dto.companyId = companyId || undefined;
    }
    onSubmit(dto, file ?? undefined);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Hodimni tahrirlash' : 'Yangi hodim'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handle} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-3 sm:col-span-1">
              <Label>Yuz rasmi</Label>
              <div
                onClick={() => fileRef.current?.click()}
                className="aspect-square w-full max-w-[180px] border border-dashed border-(--color-border) rounded-lg flex items-center justify-center cursor-pointer hover:bg-(--color-muted)/30 transition-colors overflow-hidden"
              >
                {preview ? (
                  <img
                    src={preview}
                    alt="preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-(--color-muted-foreground) text-xs">
                    <Upload className="h-6 w-6" />
                    Rasmni tanlang
                  </div>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-(--color-muted-foreground)">
                JPEG/PNG, ≤10MB. Server avtomatik 480px ga kichraytiradi.
              </p>
            </div>

            <div className="space-y-4 sm:col-span-2">
              {!isEdit && isSuper && (
                <div className="space-y-2">
                  <Label htmlFor="p-company">Kampaniya</Label>
                  <Select
                    id="p-company"
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

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="p-no">Tabel raqami</Label>
                  <Input
                    id="p-no"
                    required
                    disabled={isEdit}
                    value={employeeNo}
                    onChange={(e) => setEmployeeNo(e.target.value)}
                    placeholder="1001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-name">Ism familiya</Label>
                  <Input
                    id="p-name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-gender">Jinsi</Label>
                  <Select
                    id="p-gender"
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                  >
                    <option value="unknown">—</option>
                    <option value="male">Erkak</option>
                    <option value="female">Ayol</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-phone">Telefon</Label>
                  <Input
                    id="p-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-email">Email</Label>
                  <Input
                    id="p-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-pin">PIN</Label>
                  <Input
                    id="p-pin"
                    inputMode="numeric"
                    pattern="\d{4,8}"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="4-8 raqam"
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="p-card">Karta raqami</Label>
                  <Input
                    id="p-card"
                    value={cardNo}
                    onChange={(e) => setCardNo(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Qaysi qurilmalarga sinxronlash</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto rounded-md border border-(--color-border) p-3">
              {filteredDevices.length === 0 && (
                <p className="text-sm text-(--color-muted-foreground)">
                  Qurilma topilmadi
                </p>
              )}
              {filteredDevices.map((d) => (
                <label
                  key={d.id}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={deviceIds.includes(d.id)}
                    onChange={() => toggleDevice(d.id)}
                    className="h-4 w-4 rounded border-(--color-border)"
                  />
                  <span>{d.name}</span>
                  <span className="text-xs text-(--color-muted-foreground)">
                    {d.host}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {!isEdit && (
            <div className="flex items-center gap-2">
              <input
                id="p-sync"
                type="checkbox"
                checked={autoSync}
                onChange={(e) => setAutoSync(e.target.checked)}
                className="h-4 w-4 rounded border-(--color-border)"
              />
              <Label htmlFor="p-sync" className="cursor-pointer">
                Yaratish bilan birga qurilmalarga avtomatik yuborish
              </Label>
            </div>
          )}

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
