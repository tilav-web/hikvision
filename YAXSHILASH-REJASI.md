# Hikvision Management System — Tahlil, Xatolar va Yaxshilash Rejasi

> **Sana:** 2026-07-09
> **Qamrov:** `server/` (NestJS), `client/` (React), `agent/` (Node bridge)
> **Metod:** Uch subsistema chuqur kod ko'rigi + tiplashtirish (`tsc`) + xavfsizlik tahlili.
> Har bir topilma manba kodiga (`fayl:qator`) tekshirilgan.

---

## 0. Umumiy baho

Loyiha **yaxshi va zamonaviy asosga** qurilgan. Kuchli tomonlari:

- **Toza arxitektura:** uch qatlam (agent ↔ server ↔ client) mas'uliyatlari aniq ajratilgan. NestJS modul tuzilishi idiomatik (har domen uchun alohida modul, `TypeOrmModule.forFeature`, DI to'g'ri).
- **Multi-tenant izolyatsiya** server tomonda deyarli hamma joyda kuchaytirilgan (`company_admin` faqat o'z `companyId`sini ko'radi).
- **Xavfsizlikning bir qismi to'g'ri:** qurilma parollari AES-256-GCM bilan shifrlangan; `JWT_SECRET`/`ENCRYPTION_KEY` `getOrThrow` + uzunlik tekshiruvi bilan; Telegram shablonlarida HTML-injection'dan himoya (`escapeXml`).
- **O'ylangan tafsilotlar:** attendance uchun per-`(person,date)` mutex, employeeNo avto-generatsiyada race-retry, digest-auth qo'lda va asosan RFC-to'g'ri.
- **Uch paket ham `tsc` dan xatosiz o'tadi** (0 ta type xatosi).

Zaif tomonlari (quyida batafsil): **testlar umuman yo'q (0 ta)**, **migratsiyalar yo'q** (`DB_SYNC=true` bilan ishlayapti), bir nechta **jiddiy xavfsizlik teshigi** (parol-hash oqishi, token oqishi, CORS), va **kamera stream'ida ishlab turgan feature'ni buzadigan xato** (60 soniyada uziladi).

**Umumiy holat:** yaxshi prototip / erta-ishlab chiqarish darajasi. Ishlab chiqarishga (production) chiqarishdan oldin quyidagi **Kritik** va **Yuqori** bo'limlar albatta yopilishi kerak.

---

## 1. Ustuvorlik jadvali (qisqacha)

> **Status ustuni:** ✅ = shu sessiyada bajarildi va tekshirildi · ⬜ = hali qilinmagan.
> Bajarilganlar tafsiloti quyida **1.1** bo'limida.

| # | Muammo | Jiddiylik | Joy | Status |
|---|--------|-----------|-----|--------|
| K1 | `GET /users` parol-hashlarini qaytaradi | 🔴 Kritik | server | ✅ |
| K2 | Kompaniya `apiToken` GET javoblarida ochiq | 🔴 Kritik | server | ✅ |
| K3 | Logout'da React Query keshi tozalanmaydi | 🔴 Kritik | client | ✅ |
| K4 | `DB_SYNC=true` + migratsiyalar yo'q | 🔴 Kritik | server | ✅ (guardrail) |
| Y1 | Kamera stream 60s da uziladi | 🟠 Yuqori | agent | ✅ |
| Y2 | CORS har qanday origin'ni credential bilan aks ettiradi | 🟠 Yuqori | server | ✅ |
| Y3 | Pagination yo'q — ro'yxatlar 50 tada kesiladi | 🟠 Yuqori | client/server | ✅ |
| Y4 | `syncTime` qurilma soatini 5 soatga xato qo'yadi | 🟠 Yuqori | agent | ✅ |
| Y5 | Buzilgan payload butun agentni crash qiladi | 🟠 Yuqori | agent | ✅ |
| Y6 | "Absent" kunlar hech qachon yozilmaydi | 🟠 Yuqori | server | ✅ (BullMQ cron) |
| O1 | `Partial<Dto>` validatsiyani chetlab o'tadi | 🟡 O'rta | server | ✅ |
| O3 | super_admin schedules/holidays/penalties'ga kira olmaydi | 🟡 O'rta | server | ✅ |
| O4 | `trust proxy` yo'q (throttler/IP) | 🟡 O'rta | server | ✅ |
| O5 | Event receiver throttle'ga tushadi | 🟡 O'rta | server | ✅ |
| O6 | Swagger prod'da ochiq | 🟡 O'rta | server | ✅ |
| O11 | company_admin uchun kafolatlangan 403 (`useCompanies`) | 🟡 O'rta | client | ✅ |
| P2 | Health DB xato matnini oshkor qiladi | ⚪ Past | server | ✅ |
| P3 | `enableShutdownHooks()` yo'q | ⚪ Past | server | ✅ |
| P6 | telegram chatId bigint overflow | ⚪ Past | server | ✅ |
| P7 | enabledEvents cheklanmagan | ⚪ Past | server | ✅ |
| — | **Redis + Docker + BullMQ infratuzilma** | ➕ Yangi | server | ✅ |
| Qolgan O/P | O2, O7–O13(qisman), P1, P4–P14 | 🟡/⚪ | hammasi | ⬜ |

### 1.1. Shu sessiyada bajarilgan o'zgarishlar

**Xavfsizlik (server):**
- **K1** — `passwordHash`ga `@Exclude()` (`user.entity.ts`), `passwordEnc`ga `@Exclude()` (`device.entity.ts`), va yangi global `RoleSerializerInterceptor` (`common/role-serializer.interceptor.ts`, `main.ts`da ulandi). Endi hech bir javobda parol-hash/shifrlangan parol ketmaydi. Haqiqiy entity'larda runtime-tekshirildi.
- **K2** — `apiToken`ga `@Expose({ groups: ['super_admin'] })` (`company.entity.ts`). Token faqat super_admin javoblarida ko'rinadi; company_admin uni ololmaydi. (super_admin Companies sahifasi ishlashda davom etadi).
- **Y2/O4/O6/P3** — `main.ts`: prod'da `CORS_ORIGIN=*` uchun ogohlantirish, `trust proxy`, `enableShutdownHooks()`, Swagger faqat non-prod'da. `.env.example` xavfsiz default (`CORS_ORIGIN=http://localhost:5173`).
- **K4** — `typeorm.config.ts`: `synchronize` **hech qachon** production'da yoqilmaydi (`NODE_ENV!=='production' && DB_SYNC==='true'`). Migratsiya yo'li `dist/migrations/*.js` qo'shildi.
- **O5** — `events.controller.ts` receiver'iga `@SkipThrottle()` (qurilma eventlari rate-limit'ga tushmaydi).

**Xavfsizlik/UX (client):**
- **K3** — `queryClient` singleton eksport qilindi (`query-provider.tsx`); `logout()` va 401-interceptor `queryClient.clear()` chaqiradi. Login 401'ida keraksiz logout bo'lmaydi (token bor-yo'qligi tekshiriladi).

**Buzilgan feature'lar (agent + server):**
- **Y1** — Kamera stream endi uzilmaydi. Server har 30s `startStream` keepalive yuboradi (`events.gateway.ts`, viewer'lar bor ekan), agent idle-timeout 60→90s (`stream-manager.ts`). Bonus: agent qayta ishga tushsa stream ~30s ichida avtomatik tiklanadi; NaN-fps himoyasi qo'shildi.
- **Y4** — `syncTime` endi mahalliy devor vaqtini + to'g'ri offset (`CST-5:00:00`) yuboradi — 5 soatlik siljish tuzatildi (agent va server ISAPI mijozlari). TZ-aware, DST'ni hisobga oladi, `TZ_DEFAULT`/`DEVICE_TZ` bilan sozlanadi. Ko'p TZ'da tekshirildi.
- **Y5** — Agent crash-himoyasi: `index.ts`da global `unhandledRejection`/`uncaughtException`, `server-link.ts`da payload guard va `agent:cmd` try/catch, `commands.ts`da null-cmd guard.

**Tekshiruv:** uchala paket ham `tsc` dan xatosiz o'tadi; server `nest build` toza; serializatsiya va syncTime runtime-testlari o'tdi.

### 1.2. Ikkinchi sessiya: Redis + Docker + BullMQ + qo'shimcha

**Infratuzilma (server/):**
- `Dockerfile` (multi-stage, non-root), `docker-compose.yml` (backend + PostgreSQL + Redis, healthcheck, volumes), `.dockerignore`. **Backend endi to'liq Docker'da ishga tushadi** — sinovda pg+redis+server muvaffaqiyatli boot bo'ldi.
- **Redis integratsiyasi 3 joyda:** BullMQ (fon-vazifalar) · throttler storage (rate-limit restart'da nollanmaydi, instanslar aro umumiy) · Socket.IO Redis adapter (WebSocket'lar gorizontal masshtablanadi).

**Y6 — absent-cron (BullMQ repeatable job, cron o'rniga):**
- `AttendanceService.finalizeDay()` — kelmagan hodimlarga absent, ochiq kunlarni yopish (faqat schedule ish kunlari; bayram/ta'til hisobga olinadi). Mantiq alohida metodda — kelajakda boshqa trigger ham chaqira oladi.
- Har kuni 00:30 (Asia/Tashkent) repeatable job + `POST /hikvision/attendance/finalize-day` (qo'lda backfill).

**Y3 — pagination:** persons-page sahifalash UI (Oldingi/Keyingi, "X–Y / total"), 300ms debounce'li qidiruv, picker'lar (payroll/vacations) 1000 tagacha.

**Qo'shimcha tuzatishlar:** O1 (Update DTO validatsiyasi), O3 (super_admin rollari), O11 (company_admin 403 spam), P2 (health xato yashirish), P6 (chatId overflow), P7 (enabledEvents validatsiya).

**Tekshiruv:** to'liq Docker stack boot ✅ · jonli server'da passwordHash oqmasligi va apiToken faqat super_admin'ga ✅ · finalize-day BullMQ job Redis'da ✅ · 3 paket tsc + build toza.

> **Redis endi mavjud** — bu kamera **Bosqich 3 (WebRTC signaling)** va kelajakdagi yangi feature'lar (refresh-token blocklist, cache, og'ir sync/import queue'lari) uchun poydevor. Qolgan bandlar (O2 kvota, O7–O13, P1/P4/P5/P8–P14, kamera Bosqich 2/3, Excel eksport, refresh-token, audit-log va h.k.) pastdagi bo'limlarda.

---

## 2. 🔴 Kritik xatolar (darhol tuzatilishi shart)

### K1 — `GET /users` foydalanuvchilar parol-hashlarini qaytaradi

**Joy:** `server/src/users/user.entity.ts:24`, `server/src/users/users.controller.ts:32-42, 53-62`, `server/src/main.ts` (global serializer yo'q).

```ts
// user.entity.ts
@Column({ type: 'text' })
passwordHash!: string;   // ❌ @Exclude ham, select:false ham yo'q
```

`list()` va `getOne()` xom entity qaytaradi, `main.ts` da `ClassSerializerInterceptor` yo'q. Natijada `GET /api/users` **har bir foydalanuvchining bcrypt hash'ini** qaytaradi. `company_admin` o'z kompaniyasidagi barcha adminlarning hash'larini yuklab olib, offline crack qilishi mumkin.

**Yechim (2 qadam):**

```ts
// 1) user.entity.ts
import { Exclude } from 'class-transformer';

@Exclude()                       // yoki { select: false }
@Column({ type: 'text' })
passwordHash!: string;

// 2) main.ts — global serializer yoqish
import { ClassSerializerInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
```

> Eng ishonchli variant — controllerlarda javobni aniq DTO'ga map qilish (`{ id, email, fullName, role, companyId, isActive, lastLoginAt }`), hech qachon entity'ni to'g'ridan qaytarmaslik.

---

### K2 — Kompaniya `apiToken`i har GET javobida ochiq ketadi

**Joy:** `server/src/companies/company.entity.ts:25`, `companies.controller.ts:28-30, 39-46`.

`apiToken` — agentlar shu token bilan ulanadi (bir kompaniya = bir token). `list()` (super_admin → **barcha** kompaniyalar tokeni) va `getOne()` (company_admin → o'z tokeni) xom entity qaytaradi. Token faqat `create`/`rotate` paytida ko'rsatilishi kerak edi, lekin har oddiy GET ham uni oshkor qiladi.

**Yechim:** `apiToken`ga `@Exclude()` qo'yish (K1 dagi serializer bilan avtomatik yashiriladi) va faqat `create`/`rotateApiToken` javoblarida qo'lda qaytarish.

---

### K3 — Logout'da React Query keshi tozalanmaydi → kompaniyalararo ma'lumot oqishi

**Joy:** `client/src/components/layout/topbar.tsx:97`, `stores/auth-store.ts:27`, `lib/api.ts:22-24`, `providers/query-provider.tsx:4-12`.

`logout()` faqat zustand token/user'ni tozalaydi. Hech qayerda `queryClient.clear()` yo'q, query key'lar tenant-scoped emas (`['persons', ...]`), `staleTime: 30_000`. Natija: A-kompaniya admini chiqib, 30 soniya ichida B-kompaniya admini o'sha brauzerda kirsa — `/persons` sahifasi **tarmoq so'rovisiz** A-kompaniyaning hodimlar ro'yxatini keshdan ko'rsatadi.

**Yechim:**

```ts
// auth-store.ts logout() ichida yoki topbar onClick'da:
import { queryClient } from '@/providers/query-provider';
logout: () => {
  set({ token: null, user: null });
  queryClient.clear();          // ✅ butun keshni tozalash
}
// va 401 interceptor (lib/api.ts) ichida ham xuddi shu.
```

---

### K4 — `DB_SYNC=true` + migratsiyalar umuman yo'q

**Joy:** `server/src/config/typeorm.config.ts:44`, `server/.env:17` (`DB_SYNC=true`), `src/migrations/` — mavjud emas.

`.env.example` to'g'ri (`DB_SYNC=false`) deydi, lekin haqiqiy `.env` da `true`. Migratsiya skriptlari `package.json` da bor, ammo bironta migratsiya fayli yo'q — sxema TypeORM tomonidan boot'da ALTER qilinadi. Prod'da ustun nomi o'zgarsa/o'chsa **ma'lumot jimgina yo'qoladi**.

**Yechim:**
1. `.env` da `DB_SYNC=false` qilish.
2. Boshlang'ich sxemadan birinchi migratsiya generatsiya qilish:
   ```bash
   npm run migration:generate -- src/migrations/Init
   npm run migration:run
   ```
3. `data-source.ts` migratsiya yo'lini bild qilingan `dist` uchun ham to'g'rilash.

---

## 3. 🟠 Yuqori darajali xatolar

### Y1 — Kamera stream aynan 60 soniyada uziladi (kuzatuv feature'i buzilgan)

**Joy:** `agent/src/stream-manager.ts:151-157` (idle watchdog), `:53, :95` (`lastTouch` faqat `start`/`getFrame` da yangilanadi).

Push-rejimda server `startStream`ni faqat **bir marta** yuboradi (`events.gateway.ts:146-151`), client keepalive yubormaydi, push qilingan kadrlar `lastTouch`ni yangilamaydi. Natijada 60 soniyadan keyin watchdog "stream idle timeout (browser crash?)" deb stream'ni **to'xtatadi** — rasm jim qotib qoladi, brauzerga xato ham bormaydi.

**Tez yechim (bittasini tanlang):**

```ts
// A-variant (eng oddiy): kadr push qilinganda lastTouch ni yangilash
// stream-manager.ts — fetchOnce/push muvaffaqiyatli bo'lganda:
session.lastTouch = Date.now();
```

yoki

```ts
// B-variant: client'dan davriy keepalive
// use-device-stream.ts — har 20s da:
socket.emit('stream:keepalive', { deviceId });
// events.gateway.ts — @SubscribeMessage('stream:keepalive') → deviceCount>0 bo'lsa hech narsa qilmaslik yetadi;
// asosiysi agentga "hali kuzatilyapti" signalini yetkazish uchun StreamManager.touch(deviceId)
```

> **Tavsiya:** A-variant (kadr push = tiriklik isboti) + brauzer yopilganda server allaqachon `stream:unsubscribe`/`disconnect` orqali stop yuboradi, shuning uchun idle-timeout'ni butunlay olib tashlash ham mumkin (yoki 5 daqiqaga uzaytirish).

---

### Y2 — CORS har qanday origin'ni credential bilan aks ettiradi

**Joy:** `server/src/main.ts:22-28`, `.env.example:4` (`CORS_ORIGIN=*`).

`CORS_ORIGIN=*` bo'lsa `origin: true` → NestJS chaqiruvchining Origin'ini aks ettiradi va `Access-Control-Allow-Credentials: true` qo'yadi. Bu har qanday sayt uchun brauzer origin-izolyatsiyasini buzadi.

**Yechim:** Prod'da `CORS_ORIGIN`ni aniq domenlar ro'yxatiga o'rnatish (`https://panel.example.com`), `*` ni faqat dev'da qoldirish; `.env.example` default'ini `http://localhost:5173` ga qaytarish.

---

### Y3 — Pagination yo'q: ro'yxatlar 50 ta yozuvda jimgina kesiladi

**Joy:** `server/src/hikvision/persons/persons.service.ts:291` (`take(50)`), `client/src/api/persons.ts:33-47` (`take`/`skip` yuborilmaydi), `pages/persons-page.tsx` (pagination UI yo'q), `payroll-page.tsx:237`, `vacations-page.tsx:177` (`Select` shu ro'yxatdan quriladi).

50+ hodimli kompaniyada 51-hodim ro'yxatda ko'rinmaydi va unga ta'til/jarima biriktirib bo'lmaydi.

**Yechim:**
1. `usePersons({ q, skip, take })` — client hook'iga skip/take qo'shish.
2. `persons-page.tsx` ga sahifalash UI (Oldingi/Keyingi + `total`).
3. `Select` piker'lari uchun alohida "hammasini olib kelish" (server-side search bilan) endpoint yoki katta `take` + client-side qidiruv.

---

### Y4 — `syncTime` qurilma soatini 5 soatga xato o'rnatadi

**Joy:** `agent/src/isapi/isapi-client.ts:220-223` va `server/src/hikvision/isapi/isapi.client.ts:204-207`.

```ts
const now = new Date().toISOString()...   // UTC instant, oxirida 'Z'
`<localTime>${now}</localTime><timeZone>CST-5:00:00</timeZone>`
```

`CST-5:00:00` Hikvision uchun **UTC+5** (teskari POSIX konvensiyasi), lekin `localTime` **mahalliy devor vaqti** bo'lishi kerak — bu yerda UTC instant yuborilyapti. Firmware qiymatni qabul qilsa soat 5 soatga orqada qoladi; rad qilsa syncTime har doim fail bo'ladi. Face-ID/davomat tizimi uchun bu barcha event vaqtlarini siljitadi.

**Yechim:**

```ts
// Mahalliy devor vaqtini TZ bilan hisoblab, 'Z' siz yuborish:
function localWallTime(tz = 'Asia/Tashkent'): string {
  const parts = new Intl.DateTimeFormat('sv-SE', {   // 'sv-SE' → "YYYY-MM-DD HH:MM:SS"
    timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false,
  }).formatToParts(new Date());
  const g = (t:string) => parts.find(p=>p.type===t)!.value;
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}:${g('second')}`;
}
// <localTime>2026-07-09T14:30:00</localTime><timeZone>CST-5:00:00</timeZone>
```
TZ ni ham `.env` orqali sozlanadigan qilish tavsiya etiladi.

---

### Y5 — Buzilgan server→agent payload butun agent jarayonini crash qiladi

**Joy:** `agent/src/server-link.ts:57, 63, 67-78`, `commands.ts:53`, `device-pool.ts:23,37`; `index.ts` da global handler yo'q.

`agent:cmd`, `agent:welcome`, `agent:devices:update` payload'lari tekshirilmaydi. `null`/noto'g'ri payload → `TypeError` → `unhandledRejection` → Node 20 default jarayonni **o'ldiradi**. Nazoratsiz on-prem binar uchun bu — supervisor/restart yo'qligi sababli — noto'g'ri failure-mode.

**Yechim:**
```ts
// index.ts — birinchi qatorlarga:
process.on('unhandledRejection', (e) => logger.error('unhandledRejection', e));
process.on('uncaughtException',  (e) => logger.error('uncaughtException', e));

// server-link.ts — har socket handler ichida payload guard:
socket.on('agent:cmd', async (cmd) => {
  if (!cmd || typeof cmd.action !== 'string') return;
  try { ... } catch (e) { socket.emit('agent:cmd:result', { id: cmd?.id, success:false, error:String(e) }); }
});
```
Qo'shimcha: Windows'da `nssm`/service, Linux'da `systemd` bilan auto-restart o'rnatish.

---

### Y6 — "Absent" (kelmagan) kunlar hech qachon yozilmaydi → davomat va maosh noto'g'ri

**Joy:** `server/src/hikvision/attendance/attendance.service.ts:221-233` (`ingestEvent` faqat event kelganda ishlaydi), kunlik yakunlovchi cron yo'q.

Attendance faqat event kelganda hisoblanadi. Hodim umuman kelmagan kunda **hech qanday yozuv yaratilmaydi** — u "absent" ham bo'lmaydi, shunchaki yo'q. `stats`/`personStats` faqat mavjud qatorlarni sanaydi, shuning uchun kelmagan kunlar **kam sanaladi**, maosh esa noto'g'ri chiqadi.

**Yechim:** Har kun kechasi (kompaniya TZ'sida yarim tundan keyin) ishga tushadigan cron:
```ts
// @nestjs/schedule o'rnatib:
@Cron('30 0 * * *', { timeZone: 'Asia/Tashkent' })
async closePreviousDay() {
  // Har faol person uchun kechagi sanaga recomputeDay chaqirish;
  // event yo'q bo'lsa status='absent' (holiday/leave hisobga olingan holda) yoziladi.
}
```
Bu bir vaqtning o'zida ochiq qolgan "currently_inside"/"partial" kunlarni ham to'g'ri yakunlaydi.

---

## 4. 🟡 O'rta darajali muammolar

| # | Muammo | Joy | Yechim |
|---|--------|-----|--------|
| O1 | `Partial<Dto>` body ValidationPipe'ni butunlay chetlab o'tadi (validatsiya yo'q) | `vacations.controller.ts:48`, `telegram-channels.controller.ts:70` | Alohida `UpdateVacationDto`/`UpdateChannelDto` (`PartialType`) yaratish |
| O2 | Obuna/kvota maydonlari (`paidUntil`, `maxDevices`, `maxEmployees`) hech qayerda tekshirilmaydi | `company.entity.ts:32-42` | To'lovi tugagan kompaniyani bloklovchi guard + qurilma/hodim yaratishda limit tekshiruvi |
| O3 | `super_admin` schedules/holidays/penalties'ga umuman kira olmaydi (faqat `company_admin`) | `schedules/holidays/penalties.controller.ts` | `@Roles('super_admin','company_admin')` ga o'tkazish |
| O4 | `trust proxy` yo'q — throttler va IP-log proxy IP'siga bog'lanadi | `main.ts` | `app.set('trust proxy', 1)`; throttler'ni Redis storage'ga o'tkazish |
| O5 | Event receiver throttle'ga tushadi → yuklamada eventlar yo'qoladi | `events.controller.ts:42-46` | `@SkipThrottle()` qo'shish (health'dagidek) |
| O6 | Swagger `/docs` hamma muhitda ochiq | `main.ts:39-46` | `if (NODE_ENV !== 'production')` bilan o'rash |
| O7 | Token muddati tugaganda socketlar butunlay o'lik qoladi, re-login signali yo'q | `client/hooks/use-events-socket.ts` va b. | `disconnect` reason'ini tekshirib 401→logout oqimini ishga tushirish |
| O8 | Person edit: bo'shatilgan maydon va olib tashlangan qurilma jimgina saqlanmaydi | `client/person-form.tsx:130-136`, `persons.service.ts:335-366` | `null` yuborishni qo'llab-quvvatlash; device link'larni "to'liq almashtirish" semantikasi |
| O9 | Yuz rasmi keshdan eskisini ko'rsatadi (cache-bust yo'q), URL hardcoded 7 joyda | `client/` 7 fayl | `faceUrl(person)` helper + `?v=updatedAt` query |
| O10 | IsapiClient stale qoladi (kredensial/host o'zgarsa stream eski client'ni ushlab qoladi) | `agent/stream-manager.ts:51-59` | `start()` da mavjud sessiyaga yangi `client`ni ham berish |
| O11 | Kompaniya admin uchun `useCompanies()` kafolatlangan 403 (6 sahifada) | `client/` 6 sahifa | Faqat `super_admin` uchun chaqirish (`enabled: role==='super_admin'`) |
| O12 | Query xatolari abadiy spinner sifatida ko'rinadi | `client/person-detail-page.tsx:268`, `dashboard-page.tsx:122` | `isError` tarmog'ini qo'shish |
| O13 | Qidiruv har harfda so'rov yuboradi (debounce yo'q) | `client/persons-page.tsx:49` | 300ms debounce + `keepPreviousData` |

---

## 5. ⚪ Past darajali / hardening

- **P1 — Attendance timezone nomuvofiqligi:** `dateString` TZ-aware (`Asia/Tashkent`), lekin `dayStart`/`dayEnd` server mahalliy vaqtida parse qilinadi (`attendance.service.ts:268-269`). Server UTC'da ishlasa kunlik chegara siljiydi. Barcha kun-chegaralarini bitta TZ-aware util orqali hisoblash.
- **P2 — Health endpoint DB xato matnini oshkor qiladi** (`health.controller.ts:41`) — faqat boolean qaytarish.
- **P3 — `enableShutdownHooks()` yo'q** (`main.ts`) — SIGTERM'da Telegraf polling to'xtamaydi.
- **P4 — Default super-admin paroli** `.env` da (`Admin123!`); `ensureSuperAdmin` mavjud bo'lsa parolni yangilamaydi (eskirgan-kredensial tuzog'i).
- **P5 — JWT 7 kun, revocation yo'q** — o'g'irlangan token 7 kun amal qiladi. Refresh-token + qora ro'yxat kerak.
- **P6 — `chatId` DTO `Length(1,32)` lekin entity `bigint`** — 19 dan ortiq raqam overflow → 400 o'rniga 500.
- **P7 — `enabledEvents` cheklanmagan** (`IsIn` yo'q) — xato yozilsa bildirishnoma jimgina o'chadi.
- **P8 — `enumerateUsers` oxirgi sahifa aynan to'la bo'lsa noto'g'ri tugaydi** (`agent/isapi-client.ts:382`) — `status !== 'MORE'` bo'yicha break qilish.
- **P9 — SADP bind xatosidan keyin discovery butunlay o'lik** (`agent/sadp.ts:35`) — retry qo'shish.
- **P10 — `syncPerson` addCard fail bo'lsa ham `card:true` qaytaradi** (`agent/commands.ts:220`) — DB noto'g'ri "provisioned" deb biladi.
- **P11 — localStorage'da JWT + to'liq user** (client) — XSS = 7 kunlik token o'g'irlash.
- **P12 — Mobil navigatsiya umuman yo'q** (`sidebar.tsx:54` `hidden md:flex`) — 768px'dan past hech qanday nav yo'q.
- **P13 — Object URL leaklari** (`person-form.tsx:108`, `use-device-stream.ts` cleanup) — `revokeObjectURL` qo'shish.
- **P14 — Device TLS hech qachon tekshirilmaydi** (`rejectUnauthorized:false`) — self-signed uchun pragmatik, lekin LAN MITM mumkin.

---

## 6. 🎥 Kamera kuzatuvini yaxshilash (batafsil)

### Hozirgi arxitektura
```
Kamera(JPEG snapshot, ISAPI) → agent(polling 0.5–10 fps) → base64 → socket.io
   → server(broadcastStreamFrame) → socket.io → brauzer(<img src=blob>)
```

**Muammolar:**
1. **60s da uziladi** (Y1 — birinchi navbatda tuzatish).
2. **Base64 + socket.io text** = ~33% ortiqcha hajm, har kadr 0.5–1 MB.
3. **Ikki tomonlama sakrash** (agent→cloud→brauzer): bulut trafigi qimmat, kechikish yuqori.
4. **Audio yo'q, past FPS, "video" emas — slayd-shou.**
5. **FPS tugmasi butun socket'ni qayta ochadi** (`camera-viewer.tsx:181` effekt deps'da).

### Bosqichma-bosqich yaxshilash rejasi

#### Bosqich 1 — Tez g'alabalar (1–2 kun)
- **Y1 idle-timeout tuzatish** (kadr push = tiriklik).
- **Base64 → binar kadr:** socket.io `ArrayBuffer`/`Buffer` yuborishni qo'llab-quvvatlaydi; brauzerda `Blob([buffer])`. -33% trafik.
- **FPS o'zgarishini debounce qilish** va socket'ni qayta ochmaslik — faqat `startStream` ni yangi fps bilan qayta yuborish.
- **Adaptiv FPS:** hech kim ko'rmayotganda 0, bitta ko'ruvchi 3–5, ko'p bo'lsa cheklab qo'yish.

#### Bosqich 2 — Sifat va UX (3–5 kun)
- **Ko'p kamerali panel (grid view):** bir ekranda 4/9/16 kamera, har biriga past fps thumbnail; bittasini bosганda to'liq fps.
- **Snapshot keshi + "oxirgi kadr" ko'rsatish:** stream ulanguncha oxirgi rasmni ko'rsatish (bo'sh spinner o'rniga).
- **Event-triggered snapshot overlay:** yuz aniqlanganda live oynaga "kim kirdi" bannerini chizish (allaqachon `unknown:person`/`access:event` bor).
- **MJPEG fallback:** past-quvvatli qurilmalar uchun `multipart/x-mixed-replace` orqali to'g'ridan-to'g'ri `<img>` (agent proksisi bilan).

#### Bosqich 3 — Haqiqiy jonli video (WebRTC / HLS) (1–2 hafta)
Bu — eng katta sifat sakrashi. Hikvision qurilmalari **RTSP** (H.264/H.265) beradi:
```
rtsp://user:pass@device/Streaming/Channels/101
```
- **WebRTC (past kechikish, ~200-500ms):** agentga [`mediamtx`](https://github.com/bluenviron/mediamtx) yoki [`go2rtc`](https://github.com/AlexxIT/go2rtc) o'rnatib, RTSP→WebRTC. Brauzer to'g'ridan-to'g'ri (yoki TURN orqali) ulanadi — bulut trafigidan qutuladi.
- **HLS/fMP4 (masshtablanuvchi, ~2-5s kechikish):** ko'p tomoshabin uchun; CDN'lanadi.
- **Server faqat signaling** qiladi (SDP almashinuvi), video oqimi bulutdan o'tmaydi.

> **Tavsiya:** Bosqich 1 ni darhol qiling (feature'ni tirilting), keyin Bosqich 3 (go2rtc bilan WebRTC) — bu haqiqiy "kamera kuzatuvi" beradi. Bosqich 2 elementlarini orada qo'shib boring.

#### Qo'shimcha kamera imkoniyatlari (yangi)
- **PTZ boshqaruvi** (agar qurilma qo'llab-quvvatlasa) — ISAPI `PTZCtrl`.
- **Server-side yozib olish (NVR-lite):** event bo'lganda ±10s klip saqlash.
- **Motion detection alert** — ISAPI smart event obunasi.
- **Snapshot tarixi galereyasi** — har event rasmini person-detail sahifasida ko'rsatish.

---

## 7. 🚀 Yangi imkoniyatlar roadmap'i

### Biznes qiymati yuqori
1. **Excel/PDF eksport** — davomat, maosh (payroll), statistika hisobotlarini yuklab olish. HR uchun eng ko'p so'raladigan.
2. **Bulk import (CSV/Excel)** — hodimlarni ommaviy qo'shish (hozir bittalab).
3. **Kunlik/oylik avtomatik hisobot** — Telegram/email orqali rahbarga jadval bo'yicha yuborish.
4. **Dashboard real-time widjetlari** — hozir kim ichkarida, bugungi kechikkanlar, jonli oqim.
5. **Rejalashtirilgan hisobot (report scheduling)** — cron bilan.

### Xavfsizlik va ishonchlilik
6. **Refresh token + revocation** (P5) — qisqa access token + uzoq refresh.
7. **2FA (TOTP)** admin login uchun — eshik qulflarini boshqaradigan panel uchun muhim.
8. **Audit log** — kim qachon qurilma/hodim/eshik bilan nima qildi (masofadan eshik ochish alohida).
9. **Migratsiyalar + CI** (K4) — test + lint + build pipeline.
10. **Testlar** — hech bo'lmasa attendance hisob-kitobi, digest-auth, ISAPI parser uchun unit testlar (hozir 0 ta).

### UX va platforma
11. **Mobil-responsive + PWA** (P12) — hamburger menyu, telefon uchun optimallashtirilgan.
12. **Rollarni kengaytirish** — hozir faqat 2 rol; `viewer`/`hr`/`security` kabi granular rollar.
13. **Ko'p tillilik (i18n)** — hozir UI o'zbekcha hardcoded.
14. **Ish vaqti hisoboti dashboard'i** — grafiklar (kechikish trendi, davomat foizi).
15. **Qurilma sog'lig'i monitoringi** — offline qurilmalar, oxirgi ko'rilgan vaqt, disk/xotira (ISAPI status).

### Integratsiyalar
16. **1C / HR tizimlari bilan integratsiya** — `externalUserId` allaqachon bor.
17. **Email bildirishnoma** (Telegram'ga qo'shimcha) — SMTP.
18. **Webhook chiqishi** — tashqi tizimlar event olishi uchun.

---

## 8. Tavsiya etilgan bajarish tartibi

**Sprint 1 — Xavfsizlik va ma'lumot yaxlitligi (majburiy, prod'gacha):**
`K1` (parol-hash) → `K2` (apiToken) → `K4` (DB_SYNC + migratsiyalar) → `Y2` (CORS) → `K3` (kesh tozalash) → `O5`/`O6` (throttle/Swagger).

**Sprint 2 — Buzilgan feature'lar:**
`Y1` (kamera 60s) → `Y6` (absent cron) → `Y4` (syncTime) → `Y3` (pagination) → `Y5` (agent crash-guard).

**Sprint 3 — Sifat va barqarorlik:**
O-darajali muammolar (O1–O13) + testlar (unit) + `@nestjs/schedule`.

**Sprint 4 — Kamera Bosqich 3 (WebRTC) + yuqori-qiymatli yangi feature'lar:**
Excel eksport, bulk import, refresh token, audit log.

---

### Ilova: tekshirilgan "muammo emas" (false-positive) misollar
Ba'zi shubhali joylar tekshirildi va **to'g'ri** ekani tasdiqlandi: digest-auth nc/nonce boshqaruvi, FormData'ni 401-retry uchun Buffer'ga aylantirish, socket reconnect'da listener dublikat bo'lmasligi, Telegram xatolarining asosiy oqimni buzmasligi, `timestamptz` ustunlarining izchilligi, multi-tenant o'qish izolyatsiyasi. Bular loyihaning puxta joylari.
