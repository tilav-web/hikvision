# Hikvision Agent

Bridge agent — bitta agent bir nechta Hikvision FaceID qurilmasini boshqarib, cloud serverga ulanadi. Agent Windows yoki Raspberry Pi 4 kabi qurilmalarda ishlay oladi (qurilma bilan bir LAN/Wi-Fi ichida bo'lishi shart).

## Arxitektura

```
[Hikvision N1, N2, ...]  <-- LAN/HTTPS ISAPI -->  [Agent]  <-- WSS -->  [Server]
```

Agent token bilan serverga ulanadi. Server welcome event'ida shu agentga biriktirilgan qurilmalar ro'yxatini yuboradi (host, port, login, parol). Agent qurilmalar bilan to'g'ridan-to'g'ri ISAPI orqali ishlaydi.

Server agentga buyruq yuborganida har doim `deviceId` ni ham qo'shib yuboradi — agent qaysi qurilmaga buyruq berishni shunda biladi.

## Setup

```bash
npm install
cp .env.example .env
# AGENT_TOKEN ni serverda agent yaratganingizda chiqqan tokendan oling
```

## Run

```bash
npm run dev          # ts-node bilan
npm run build        # dist/ ga compile qiladi
npm start            # node dist/index.js
npm run package:win  # standalone .exe (Windows)
npm run package:rpi  # RPI4 binary (linux-arm64)
```

## Protocol

| Yo'nalish | Event                       | Tavsif                                                        |
|-----------|-----------------------------|---------------------------------------------------------------|
| ← server  | `agent:welcome`             | `{ agentId, devices: [{id, name, mode, credentials}] }`       |
| ← server  | `agent:devices:update`      | Qurilma ro'yxati o'zgardi — yangi ro'yxat yuboriladi          |
| ← server  | `agent:cmd`                 | `{ id, deviceId, action, payload }`                           |
| → server  | `agent:cmd:result`          | `{ id, success, data?, error? }`                              |
| → server  | `agent:event`               | `{ deviceId, event }` — qurilmadan kelgan FaceID hodisasi     |

## Hozirgi cheklovlar

- Hodisa qabul qilish (FaceID event push) hozircha to'liq qo'shilmagan — bu Phase 2 da
- Kirish/Chiqish tugma callback'i Hikvision qurilmasining o'z screenida sozlanadi (server orqali ISAPI bilan rejimni o'rnatamiz)
