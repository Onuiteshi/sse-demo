# SSE Demo — Real-Time Notifications with Server-Sent Events

A NestJS application demonstrating real-time, user-specific push notifications over **Server-Sent Events (SSE)**. It includes missed-event recovery using the `Last-Event-ID` protocol, an in-memory event store, and a browser test client.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [How It Works](#how-it-works)
  - [SSE Stream](#sse-stream)
  - [Missed Event Recovery](#missed-event-recovery)
  - [Sending Notifications](#sending-notifications)
- [API Reference](#api-reference)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running the Server](#running-the-server)
- [Test Client](#test-client)
- [Manual Testing with cURL](#manual-testing-with-curl)
- [Configuration](#configuration)
- [Scripts](#scripts)
- [Tech Stack](#tech-stack)

---

## Overview

This project is a minimal but production-pattern implementation of **Server-Sent Events** on top of NestJS. Key capabilities:

| Feature | Description |
|---|---|
| **User-targeted events** | Each notification is scoped to a specific `userId`; clients only receive their own events |
| **Persistent event store** | All events are kept in memory for the lifetime of the server process |
| **Missed event replay** | On reconnect, the client sends `Last-Event-ID` and the server replays any events the client missed |
| **Live stream** | After replay, the client stays connected and receives live events in real time |
| **CORS open** | `origin: '*'` lets any browser origin connect — suitable for local demo/dev |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        NestJS App                           │
│                                                             │
│  AppModule                                                  │
│  ├── AppController    GET /          → "Hello World!"       │
│  └── NotificationsModule                                    │
│       ├── NotificationsController                           │
│       │    ├── GET  /notifications   (SSE stream)           │
│       │    └── POST /notifications   (send notification)    │
│       └── NotificationsService                              │
│            ├── Subject<NotificationEvent>  (live bus)       │
│            ├── eventStore[]                (replay buffer)  │
│            └── eventCounter                (monotonic IDs)  │
└─────────────────────────────────────────────────────────────┘
```

The `NotificationsService` holds a single RxJS `Subject` that acts as an event bus. When `sendNotification()` is called, the event is appended to the in-memory `eventStore` and emitted on the subject. Each SSE subscriber filters the subject by `userId` so it only sees its own events.

---

## Project Structure

```
sse-demo/
├── src/
│   ├── main.ts                              # Bootstrap, CORS, port
│   ├── app.module.ts                        # Root module
│   ├── app.controller.ts                    # GET / health check
│   ├── app.service.ts                       # "Hello World!" service
│   └── notifications/
│       ├── notifications.module.ts          # Feature module
│       ├── notifications.controller.ts      # SSE + POST endpoints
│       └── notifications.service.ts        # Event bus + replay logic
├── test/
│   ├── app.e2e-spec.ts                      # End-to-end test (supertest)
│   └── jest-e2e.json                        # Jest config for e2e
├── test.html                                # Browser SSE test client
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── nest-cli.json
└── eslint.config.mjs
```

---

## How It Works

### SSE Stream

```
Client                               Server
  |                                    |
  |  GET /notifications?userId=123     |
  |   (Header: Last-Event-ID: 5)      |
  |----------------------------------->|
  |                                    |  1. getMissedEvents(userId, lastEventId)
  |  data: {...}  id: 6               |  2. replay events 6, 7, 8 …
  |  data: {...}  id: 7               |<---------------------------------|
  |  data: {...}  id: 8               |
  |                                    |  3. merge into live Subject stream
  |  (stays open)                      |
  |  data: {...}  id: 9               |<-- POST /notifications fires new event
  |  ...                               |
```

The controller returns an `Observable<MessageEvent>` from `getNotificationStream()`. NestJS's `@Sse()` decorator serialises each emission as an SSE frame (`data: ...\n\n`) automatically.

### Missed Event Recovery

`getNotificationStream(userId, lastEventId)` builds two observables and merges them:

1. **`missed$`** — synchronously emits every stored event whose `id > lastEventId` for this user.
2. **`live$`** — the filtered `Subject` stream for future events.

The subscriber receives the replay first, then seamlessly transitions to live events without any gap.

### Sending Notifications

`POST /notifications` with a JSON body dispatches an event to a specific user:

```json
{ "userId": "123", "message": "Your order has shipped!" }
```

The service assigns a monotonically-increasing integer `id`, stores it, and emits it on the shared Subject. Any connected SSE client subscribed for `userId=123` will receive it immediately.

---

## API Reference

### `GET /notifications` — Subscribe to SSE Stream

Opens a persistent SSE connection for a user.

| Parameter | In | Type | Required | Description |
|---|---|---|---|---|
| `userId` | query | string | Yes | The user whose events to receive |
| `Last-Event-ID` | header | string | No | Last event ID received; triggers missed-event replay |

**Response:** `text/event-stream` (HTTP 200, connection held open)

Each event frame:
```
id: 42
data: {"message":"Hello","timestamp":"2026-05-21T10:00:00.000Z"}

```

---

### `POST /notifications` — Send a Notification

Dispatches a notification to a specific user.

**Request body:**
```json
{
  "userId": "string",
  "message": "string"
}
```

**Response:**
```json
{ "status": "notification sent" }
```

---

### `GET /` — Health Check

Returns `Hello World!` (HTTP 200). Used by the e2e test to confirm the server is up.

---

## Getting Started

### Prerequisites

- **Node.js** v18 or later
- **npm** v9 or later (or yarn / pnpm)

### Installation

```bash
git clone <repo-url>
cd sse-demo
npm install
```

### Running the Server

```bash
# Development (watch mode — reloads on file changes)
npm run start:dev

# Standard start
npm run start

# Production (compile first, then run dist)
npm run build
npm run start:prod
```

The server listens on **port 3000** by default. Override with the `PORT` environment variable:

```bash
PORT=8080 npm run start:dev
```

---

## Test Client

`test.html` is a self-contained browser client for `userId=123`. Open it directly in a browser (no web server needed):

```
File > Open > test.html
```

What it does:

1. Reads `lastEventId_123` from `localStorage` on load.
2. Opens an `EventSource` to `http://localhost:3000/notifications?userId=123`.
3. As events arrive, renders them as list items and saves the latest `id` to `localStorage`.
4. On page reload, the stored `lastEventId` triggers server-side replay of any missed events.

**Full missed-event test flow:**
1. Open `test.html` in a browser.
2. POST a few notifications while the page is open — they arrive live.
3. Close the page, POST more notifications.
4. Reopen `test.html` — the missed events replay immediately from the server's event store.

---

## Manual Testing with cURL

**Subscribe to the stream (keep terminal open):**
```bash
curl -N "http://localhost:3000/notifications?userId=alice"
```

**Send a notification (run in a second terminal):**
```bash
curl -X POST http://localhost:3000/notifications \
  -H "Content-Type: application/json" \
  -d '{"userId":"alice","message":"Hello from cURL!"}'
```

**Reconnect with missed-event replay (replace `5` with the last `id` you received):**
```bash
curl -N "http://localhost:3000/notifications?userId=alice" \
  -H "Last-Event-ID: 5"
```

---

## Configuration

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port the server listens on |

**CORS:** Currently set to `origin: '*'` in [src/main.ts](src/main.ts). Restrict this for any non-demo deployment.

**Event store:** In-memory only — all events are lost on server restart. For production use, replace the `eventStore[]` array in [src/notifications/notifications.service.ts](src/notifications/notifications.service.ts) with a persistent store (Redis Streams, PostgreSQL, etc.).

---

## Scripts

| Script | Description |
|---|---|
| `npm run start` | Start the server |
| `npm run start:dev` | Start with hot reload (watch mode) |
| `npm run start:debug` | Start with Node.js debugger attached |
| `npm run start:prod` | Run compiled output from `dist/` |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run test` | Run unit tests |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run test:cov` | Unit tests with coverage report |
| `npm run test:e2e` | End-to-end tests |
| `npm run lint` | Lint and auto-fix source files |
| `npm run format` | Format source files with Prettier |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [NestJS](https://nestjs.com/) v11 |
| Runtime | Node.js |
| Language | TypeScript 5.7 (target ES2023) |
| Reactive streams | [RxJS](https://rxjs.dev/) v7 |
| HTTP adapter | Express (via `@nestjs/platform-express`) |
| Testing | Jest v30 + Supertest |
