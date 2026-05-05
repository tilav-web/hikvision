import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
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

/**
 * Maoshni inson o'qiy oladigan ko'rinishga keltiradi: "5000000" → "5 000 000".
 * Ortidagi nuqta saqlanadi (foydalanuvchi yarmida bo'lsa o'chirib qo'ymasin).
 */
function formatSalaryDisplay(raw: string): string {
  const digits = raw.replace(/[^\d.]/g, '');
  if (!digits) return '';
  const [intPart, decPart] = digits.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return decPart !== undefined ? `${grouped}.${decPart}` : grouped;
}

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
  const [position, setPosition] = useState('');
  const [baseSalary, setBaseSalary] = useState('');
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
      setPosition(initial?.position ?? '');
      setBaseSalary(initial?.baseSalary ?? '');
      setDeviceIds(initial?.deviceLinks?.map((l) => l.deviceId) ?? []);
      setAutoSync(true);
      setFile(null);
      setPreview(initial?.faceImagePath ? `/uploads/faces/${initial.id}.jpg` : null);
    }
  }, [open, initial]);

  // company_admin uchun server allaqachon faqat o'z kampaniyasi qurilmalarini qaytaradi.
  // super_admin holatida kompaniya tanlangan bo'lsa, qat'iy filter; tanlanmagan bo'lsa
  // qurilmalar bo'limini "avval kampaniyani tanlang" holatida qoldiramiz.
  const showDevices = !isSuper || !!companyId;
  const filteredDevices = useMemo(
    () => devices.filter((d) => !isSuper || d.companyId === companyId),
    [devices, isSuper, companyId],
  );
  const filteredDeviceIds = useMemo(
    () => new Set(filteredDevices.map((d) => d.id)),
    [filteredDevices],
  );

  // Kompaniya o'zgarganda boshqa kompaniyaning qurilmalari tanlangan bo'lib qolmasin
  useEffect(() => {
    if (!isSuper || isEdit) return;
    setDeviceIds((cur) => {
      const next = cur.filter((id) => filteredDeviceIds.has(id));
      return next.length === cur.length ? cur : next;
    });
  }, [filteredDeviceIds, isSuper, isEdit]);

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
    // Maosh — faqat raqam belgilarini olib qolamiz (ko'rsatmadagi probel/vergullarni tashlaymiz).
    const salaryDigits = baseSalary.replace(/[^\d.]/g, '');
    const dto: PersonInput = {
      employeeNo: employeeNo.trim(),
      name: name.trim(),
      gender,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      pin: pin.trim() || undefined,
      cardNo: cardNo.trim() || undefined,
      position: position.trim() || undefined,
      baseSalary: salaryDigits || undefined,
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
                  <Label htmlFor="p-no">
                    Tabel raqami{' '}
                    {!isEdit && (
                      <span className="text-xs text-(--color-muted-foreground) font-normal">
                        (bo'sh qoldirish — avto)
                      </span>
                    )}
                  </Label>
                  <Input
                    id="p-no"
                    required={isEdit}
                    disabled={isEdit}
                    value={employeeNo}
                    onChange={(e) => setEmployeeNo(e.target.value)}
                    placeholder={isEdit ? '' : 'Avtomatik (1001, 1002, ...)'}
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
                <div className="space-y-2">
                  <Label htmlFor="p-position">
                    Lavozim{' '}
                    <span className="text-xs text-(--color-muted-foreground) font-normal">
                      (ixtiyoriy)
                    </span>
                  </Label>
                  <Input
                    id="p-position"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="Buxgalter, Operator..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-salary">
                    Oylik maosh{' '}
                    <span className="text-xs text-(--color-muted-foreground) font-normal">
                      (tavsiya etiladi)
                    </span>
                  </Label>
                  <Input
                    id="p-salary"
                    inputMode="numeric"
                    value={formatSalaryDisplay(baseSalary)}
                    onChange={(e) => setBaseSalary(e.target.value)}
                    placeholder="masalan 5 000 000"
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="p-card">
                    Karta raqami{' '}
                    <span className="text-xs text-(--color-muted-foreground) font-normal">
                      (RFID/Mifare UID — kartaning fizik ID'si)
                    </span>
                  </Label>
                  <Input
                    id="p-card"
                    value={cardNo}
                    onChange={(e) => setCardNo(e.target.value)}
                    placeholder="masalan 0012345678"
                  />
                  <p className="text-xs text-(--color-muted-foreground)">
                    Karta UID'ini kartaning orqasidan yoki Hikvision SADP tool orqali oling.
                    Kompaniya ichida unikal bo'lishi shart — bir karta faqat bir hodimga.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Qaysi qurilmalarga sinxronlash</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto rounded-md border border-(--color-border) p-3">
              {!showDevices ? (
                <p className="text-sm text-(--color-muted-foreground) col-span-2">
                  Avval kampaniyani tanlang
                </p>
              ) : filteredDevices.length === 0 ? (
                <p className="text-sm text-(--color-muted-foreground)">
                  Bu kampaniyada qurilma topilmadi
                </p>
              ) : (
                filteredDevices.map((d) => (
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
                ))
              )}
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
