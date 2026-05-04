# Hikvision Agent

Bridge agent — bitta agent bir nechta Hikvision FaceID qurilmasini boshqarib, cloud serverga ulanadi. Agent Windows yoki Raspberry Pi 4 kabi qurilmalarda ishlay oladi (qurilma bilan bir LAN/Wi-Fi ichida bo'lishi shart).

## Arxitektura

```
[Hikvision N1, N2, ...]  <-- LAN/HTTPS ISAPI -->  [Agent]  <-- WSS -->  [Server]
```

Agent token bilan serverga ulanadi. Server welcome event'ida shu agentga biriktirilgan qurilmalar ro'yxatini yuboradi (host, port, login, parol). Agent qurilmalar bilan to'g'ridan-to'g'ri ISAPI orqali ishlaydi.

Server agentga buyruq yuborganida har doim `deviceId` ni ham qo'shib yuboradi — agent qaysi qurilmaga buyruq berishni shunda biladi.

## Setup (development)

```bash
npm install
cp .env.example .env
# AGENT_TOKEN ni serverda agent yaratganingizda chiqqan tokendan oling
```

## Production deployment (mijoz qurilmasiga)

`.env` fayl quyidagi 2 joyning birida bo'lishi kerak (avval qaysi topilsa, shu o'qiladi):

1. **Joriy ishchi papka** (`pwd` / `cwd`) — buyruq satridan `cd /opt/hikagent && ./agent` qilinganda
2. **Binary'ning o'z papkasi** — Explorer'dan ikki marta bosilganda yoki absolyut yo'l bilan
   ishga tushirilganda (masalan `C:\hikagent\agent.exe`)

Eng oddiy yo'l: **`.exe` / `agent` faylini va `.env` ni bitta papkaga qo'yish**, keyin
qanday ishga tushirsangiz ham — topiladi.

```
C:\hikagent\
├── agent.exe
└── .env             ← SERVER_URL va AGENT_TOKEN

# yoki Linux/RPI
/opt/hikagent/
├── agent
└── .env
```

### Windows (Task Scheduler / NSSM)

```cmd
:: NSSM bilan service sifatida o'rnatish
nssm install HikvisionAgent C:\hikagent\agent.exe
nssm set HikvisionAgent AppDirectory C:\hikagent
nssm start HikvisionAgent
```

### Linux / RPI4 (systemd)

`/etc/systemd/system/hikagent.service`:

```ini
[Unit]
Description=Hikvision Agent
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/hikagent
ExecStart=/opt/hikagent/agent
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now hikagent
sudo journalctl -u hikagent -f
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
