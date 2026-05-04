# Hikvision Management System

Hikvision FaceID (DS-K1T343MFWX) qurilmalarini boshqarish uchun to'liq tizim.

## Arxitektura

Loyiha 3 ta mustaqil qismdan iborat:

```
hikvision/
├── server/   # NestJS backend — REST API, WebSocket, PostgreSQL, ISAPI client
├── client/   # React + Vite frontend — admin dashboard
└── agent/    # Node.js bridge agent — mahalliy qurilma bilan ishlovchi
```

### Oqim

```
[Hikvision DS-K1T343MFWX]  <-- LAN ISAPI -->  [agent]  <-- WebSocket -->  [server]  <-- HTTP/WS -->  [client]
                                                                              |
                                                                          PostgreSQL
```

- **server** — markaziy backend, ma'lumotlar bazasi va biznes-mantiq
- **agent** — har bir filialda yoki qurilma yonida ishlaydigan ko'prik (cloud serverga ulanadi va lokal qurilmaga buyruq yuboradi)
- **client** — admin panel (qurilmalar, shaxslar, kirish hodisalari)

## Ishga tushirish

Har bir loyiha alohida ishga tushiriladi:

### Server

```bash
cd server
npm install
cp .env.example .env   # ma'lumotlar bazasi sozlamalari
npm run start:dev
```

API: http://localhost:3000/api
Swagger: http://localhost:3000/docs

### Client

```bash
cd client
npm install
npm run dev
```

http://localhost:5173

### Agent

```bash
cd agent
npm install
npm run dev
```

## Texnologiyalar

| Qism   | Stack                                                              |
|--------|--------------------------------------------------------------------|
| server | NestJS 11, TypeORM, PostgreSQL, Socket.io, axios (ISAPI), Swagger  |
| client | React 19, Vite, TypeScript                                         |
| agent  | Node.js, TypeScript, socket.io-client, axios (ISAPI)               |
