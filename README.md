# Hikvision Management System

Hikvision FaceID (DS-K1T343MFWX) qurilmalarini boshqarish uchun multi-tenant SaaS tizimi.

## Arxitektura

```
hikvision/
├── server/   # NestJS backend — REST API, WebSocket, PostgreSQL, ISAPI client
├── client/   # React + Vite frontend — admin dashboard
└── agent/    # Node.js bridge agent — mahalliy qurilmalar bilan ishlovchi
```

### Oqim

```
[Hikvision FaceID]  <-- LAN ISAPI -->  [agent]  <-- WSS -->  [server]  <-- HTTP/WS -->  [client]
                                                                |
                                                            PostgreSQL
```

- **server** — markaziy backend, Auth (JWT), multi-tenant, biznes-mantiq
- **agent** — bitta agent ko'p qurilmani boshqaradi (Windows/RPI4)
- **client** — modern admin panel (React 19 + Vite + TailwindCSS v4)

## Local development

### Talab qilinadigan dasturlar

- **Node.js** 20+
- **PostgreSQL** 14+ (lokal yoki Docker)
- **npm**

### 1-qadam: PostgreSQL'ni tayyorlash

PostgreSQL ishga tushirib, `hikvision` ma'lumotlar bazasini yarating:

```sql
-- psql -U postgres
CREATE DATABASE hikvision;
```

Yoki Docker'da:

```bash
docker run --name hikvision-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=hikvision -p 5432:5432 -d postgres:16
```

### 2-qadam: Server'ni ishga tushirish

```bash
cd server
npm install
# .env allaqachon yaratilgan (development uchun, gitignore'da turadi)
npm run start:dev
```

- API: http://localhost:3000/api
- Swagger: http://localhost:3000/docs
- Birinchi ishga tushganda super-admin avtomatik yaratiladi:
  - **Email:** `admin@hikvision.local`
  - **Parol:** `admin123!`
- `DB_SYNC=true` bo'lgani uchun TypeORM jadvallarni avtomatik yaratadi

### 3-qadam: Client'ni ishga tushirish

Yangi terminalda:

```bash
cd client
npm install
npm run dev
```

http://localhost:5173 — login sahifasi ochiladi. Yuqoridagi super-admin ma'lumotlari bilan kiring.

Vite proxy avtomatik `/api` so'rovlarini `localhost:3000` ga uzatadi.

### 4-qadam: Agent'ni ishga tushirish (ixtiyoriy)

Agent faqat haqiqiy Hikvision qurilmasi bo'lganda kerak. Sinov uchun:

1. Client'da super-admin sifatida kiring
2. **Kampaniyalar** → yangi kampaniya yarating
3. **Agentlar** → yangi agent yarating
4. Agent tokenini nusxalang (📋 ikonkasi)
5. `agent/.env` dagi `AGENT_TOKEN` ga joylang

```bash
cd agent
npm install
npm run dev
```

Agent serverga ulanib, qurilma ro'yxatini oladi.

### 5-qadam: Qurilmani qo'shish

Agar Hikvision DS-K1T343MFWX qurilmangiz bo'lsa:

1. Client'da **Qurilmalar** → yangi qurilma
2. IP, login, parol kiriting; agentni biriktiring
3. **Test ulanish** tugmasi bilan tekshiring
4. **Hodimlar** sahifasida hodim qo'shing (yuz rasmi bilan)

## Texnologiyalar

| Qism   | Stack                                                                            |
|--------|----------------------------------------------------------------------------------|
| server | NestJS 11, TypeORM, PostgreSQL, Socket.io, axios (ISAPI), JWT + Passport, Swagger |
| client | React 19, Vite, TypeScript, TailwindCSS v4, Radix UI, TanStack Query, Zustand     |
| agent  | Node.js 20, TypeScript, socket.io-client, axios (ISAPI)                          |

## Asosiy modullar

### Auth & Multi-tenant
- 2 ta rol: `super_admin` (SaaS egasi) va `company_admin` (kampaniya egasi)
- Har bir entity'da `companyId` — ma'lumotlar aralashmasligi uchun
- JWT bilan barcha endpoint'lar himoyalangan

### Companies (super_admin)
- `paid_from` / `paid_until` — to'lov muddati (informatsion)
- To'lov muddati o'tsa, tizim avtomatik to'xtatmaydi
- To'xtatish uchun super-admin `status: disabled` qo'yadi

### Agents
- 1 agent → ko'p qurilma
- Token bilan auth (`/agents` socket namespace)
- Token rotate — eski token darhol bekor bo'ladi

### Devices
- `mode`: `entry` | `exit` | `both`
  - `entry`/`exit`: har FaceID = avtomatik yo'nalish
  - `both`: qurilmada kirish/chiqish tugmasi (Phase 3)

### Persons (Hodimlar)
- Yuz rasmi (auto-resize 480px)
- PIN, karta raqami
- Bir nechta qurilmaga sinxron

## Production checklist

- [ ] `DB_SYNC=false`, migration ishlat: `npm run migration:run`
- [ ] `JWT_SECRET` va `ENCRYPTION_KEY` ni qayta generatsiya qil
- [ ] `CORS_ORIGIN` ni real domain'ga sozla
- [ ] `PUBLIC_BASE_URL` — qurilma yetib boradigan public URL
- [ ] HTTPS ishlat (TLS sertifikat)
- [ ] PostgreSQL backup strategiyasi
