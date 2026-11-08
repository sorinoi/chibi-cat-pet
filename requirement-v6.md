# Requirement v6: Activity log server and dashboard

Status: APPROVED by the user on 2026-11-08 (written and answered the same day), including the changed hard rule in section 7 and the dependencies in section 11. Not built yet; implementation starts with V6-M1 when the user says go. v5 (requirement-v5.md) stays the base: everything in v1 to v5 keeps working, also with the new feature off or the server unreachable.

## 1. Overview

The user wants a record of life with the pet on their own server: every care action (feed, pet, treat) and every focus timer step is sent to an API and stored in MySQL, and a web dashboard shows it. The desktop app stays offline-first: when the server cannot be reached, events wait in a small queue on disk and are sent later.

Three parts:

1. Client (the desktop app): records events, keeps an outbox on disk, sends them to the user's server when it can.
2. Server: a small Node API that checks the key, stores events in MySQL and serves the dashboard.
3. Dashboard: web pages behind a login with charts and an event list, built so more pages can be added later.

This changes a hard rule: so far the app made no network calls at all (NFR-06, NFR-07). v6 allows exactly one kind: sending events to the server the user set, only while the user has turned it on (section 7).

## 2. Decisions (user, 2026-11-08)

| Topic | Decision |
| --- | --- |
| Where the server code lives | In this repo, in its own folder `server/` with its own package.json, and deployable on its own (section 9). |
| Server stack | Node + MySQL, on the user's VPS, run with pm2. |
| Offline | Keep a small queue and send it when back online, as long as the memory cost is small (it is: section 6). |
| Use of the data | A dashboard with web pages, open to more features later. |
| Petting | Send every pet action. |
| Clicks, app start and quit | Not sent. |
| Old pets | After "adopt new" the server keeps the old pet's history (marked as replaced); the app still wipes it locally at once. |
| Retention | The server keeps events forever. |
| Test database | MySQL is installed on the dev PC; server tests use a separate test database there. |
| VPS | A domain and nginx are already set up on the VPS (the domain name is needed in V6-M4). |
| Charts | Drawn as plain SVG in Vue components, no chart library. |

## 3. Scope

In scope: the client outbox and sender, the settings for it, the server API, the MySQL schema, the dashboard (login, overview, event list), server build and deploy files, Thai and English text for everything new in the app and the dashboard.

Out of scope for v6.0:

- Sync back to the app (the server never changes the pet; the app stays the source of truth), more than one pet at a time in the app, accounts for other people, sharing.
- A public sign-up, a mobile app, push notifications.
- Hosting other than the user's own VPS (no managed cloud service set up by the app).
- macOS/Linux clients (unchanged).

## 4. Events (client)

| ID | Requirement |
| --- | --- |
| FR-80 | The app records an event for each of these, at the moment main applies it: `pet.adopted` (name), `pet.renamed` (new name), `pet.replaced` (adopt new, the old pet is wiped locally), `care.feed` (refused or not), `care.pet` (every pet action, stroke or menu, with whether it counted for happiness), `care.treat` (given, or refused when full), `treat.earned` (count), `focus.started`, `focus.paused`, `focus.resumed`, `focus.skipped`, `focus.stopped`, `focus.phaseEnded` (which phase, planned minutes, completed or skipped). Clicks, app start and app quit are not sent (user, 2026-11-08). |
| FR-81 | Every event has: a random event id (UUID), type, time (UTC milliseconds) and the PC's UTC offset in minutes, the pet id, the device id, the app version, and the pet's hunger, happiness and mood right after the action. Type-specific fields as listed in FR-80. Nothing else (NFR-34). |
| FR-82 | Pet id: a random UUID stored in pet.json, made at adoption; a pet from v5 gets one the first time v6 loads it. Device id: a random UUID made once per install, stored in the app data folder. Neither contains anything about the PC or the user. |
| FR-83 | Events are recorded only while "Send activity to my server" is on. Turning it off stops recording; turning it on does not invent past events. |

## 5. Sending (client)

| ID | Requirement |
| --- | --- |
| FR-84 | New events go into the outbox file first, then main tries to send at once. Sending is a `POST` of up to 100 events in one request to `<server URL>/api/v1/events` with the API key as a Bearer token. Only main sends (Electron `net.fetch`); renderers never touch the network. |
| FR-85 | A batch the server accepted (2xx) is removed from the outbox. On no connection, a timeout (10 s) or a 5xx, the events stay and main tries again later, backing off from 1 minute up to 30 minutes; it also tries again when Windows says it is back online or the PC wakes. A 4xx other than 429 (bad key, bad data) stops sending until the settings change, and the status shows the reason. |
| FR-86 | Sending again is safe: the server ignores an event id it already has (FR-91), so an answer lost on the way never makes duplicates. |
| FR-87 | Settings (new group "Activity log"): an on/off switch (off by default), server URL, API key (hidden field), a "Test connection" button (calls `GET /api/v1/health` with the key), and a status line: connected / waiting to send N events / last error. Changing the URL or key keeps the outbox. |
| FR-88 | "Clear waiting events" button in Settings empties the outbox (with a confirm), for when the user does not want old events sent. Uninstall deletes the outbox with the rest of the data. |

## 6. Outbox and memory

The outbox is a file on disk (`outbox.jsonl` in the app data folder, one event per line), not a list kept in memory. One event is about 300 bytes. Main keeps only a count in memory and reads one batch (at most 100 events, about 30 KB) when it sends. So the queue costs well under 1 MB of RAM even with thousands of events waiting, and no CPU while nothing is waiting.

| ID | Requirement |
| --- | --- |
| FR-89 | The outbox keeps at most 10,000 events (about 3 MB on disk) and nothing older than 30 days; past that the oldest events are dropped, and the status line says so. |
| FR-90 | Writes are append-only and survive a crash: a damaged last line is skipped on load, a damaged file is set aside as `outbox.jsonl.bad`, like pet.json (FR-33). |

## 7. Changed hard rules (needs the user's approval)

Today (CLAUDE.md, NFR-06, NFR-07): "Never load remote content. No network calls, no telemetry. The app must work fully offline."

Proposed for v6:

- The app still never loads remote content (pages, scripts, images) and has no telemetry of its own.
- The only network call allowed is sending activity events (section 5) to the server URL the user typed in Settings, only while the switch is on (off by default), plus the "Test connection" check.
- The URL must be `https://`, except `http://localhost`, `http://127.0.0.1` or a private LAN address (for testing at home).
- The app works fully with the switch off, with no network, or with the server down (NFR-31).

Approved 2026-11-08; CLAUDE.md, AGENTS.md and requirement.md carry this text.

## 8. Server and dashboard

| ID | Requirement |
| --- | --- |
| FR-91 | `POST /api/v1/events`: checks the Bearer key, checks every event against the shared schema, stores the batch in one transaction, skips event ids it already has, answers with how many were stored and skipped. Bad events make the whole request fail with 400 and the reason. |
| FR-92 | `GET /api/v1/health`: answers 200 with the server version when the key is good (401 when not). Used by "Test connection". |
| FR-93 | API keys: made with a server command (`npm run key:create -- <label>`), shown once, stored only as a hash; can be listed and revoked by command. |
| FR-94 | MySQL tables: `devices`, `pets` (id, name, adopted at, replaced at), `events` (event id unique, type, pet, device, time, UTC offset, needs, type fields as JSON), `api_keys`, `users`, `sessions`. Plain SQL migration files in `server/migrations`, applied in order by `npm run migrate`. |
| FR-95 | Dashboard login: one or more users made by command (`npm run user:create -- <name>`); password hashed with Node's built-in scrypt; session cookie (HttpOnly, Secure, SameSite=Strict); log out. |
| FR-96 | Overview page: the current pet (name, age, last hunger and happiness), hunger and happiness over time (line chart, last 7 or 30 days), feeds, pets and treats per day (bars), focus sessions per day and week, current focus streak. Earlier pets can be picked from a list. |
| FR-97 | Events page: a table of events, newest first, filter by type, pet and date range, paged. |
| FR-98 | Dashboard text in Thai and English (a language switch, remembered in the browser), times shown in the time zone set on the server (default Asia/Bangkok). |
| FR-99 | Built to grow: dashboard pages are separate routes, the API is versioned (`/api/v1`), the event schema has a version field so new event types can be added without breaking older apps. |

## 9. Repo layout, build and deploy

```
src/shared/activity.ts   event types, schema checks, versions (the one contract both sides use)
server/                  its own package.json, tsconfig, tests; never part of the desktop installer
  src/                   Node API (TypeScript), MySQL access, auth
  web/                   dashboard (Vue 3 + Vite, like the app)
  migrations/            plain SQL files
  ecosystem.config.cjs   pm2 config
  .env.example           settings the server reads (DB, port, session secret, time zone)
```

- The desktop installer (electron-builder `files`: `out/**`, `resources/**`) never includes `server/`, and the server's dependencies stay out of the root package.json, so the installer does not grow (NFR-36).
- `npm run build` in `server/` makes `server/dist/`: the API bundled into one JS file (with `src/shared/activity.ts` inside) and the built dashboard. Deploying copies only `server/dist`, `server/package.json`, `server/package-lock.json`, `server/migrations` and `server/ecosystem.config.cjs` to the VPS, then `npm ci --omit=dev`, `npm run migrate`, `pm2 start ecosystem.config.cjs` (or `pm2 reload`). A `server/README.md` (EN/TH) lists the steps, an nginx reverse-proxy example with HTTPS (Let's Encrypt) and a backup tip for MySQL.
- Secrets live only in the VPS's `.env` and in the app's settings (key encrypted with Windows' safeStorage). Never in git, logs or WORK-LOG.

## 10. Non-functional requirements (additions)

| ID | Area | Requirement |
| --- | --- | --- |
| NFR-31 | Offline-first | The pet, care, focus and all v1 to v5 behavior work the same with the switch off, no network, a wrong URL or key, or the server down. Sending never blocks a window, an animation or a menu, and never shows an error popup (only the Settings status line). |
| NFR-32 | Cost | No timers while the outbox is empty; retries back off to every 30 minutes. Idle CPU and RAM stay within NFR-01 with the switch on (target: under 5 MB more RAM). |
| NFR-33 | Queue | Outbox limits in FR-89; at most one batch in memory. |
| NFR-34 | Privacy | Only the fields in FR-81. No PC or user name, no window titles, no file paths, no IP lookups. The API key is stored with safeStorage and never written to logs. |
| NFR-35 | Server security | Keys and passwords stored only as hashes; parameterized SQL only; body size limit (256 KB) and a rate limit per key; the dashboard needs a login for every page and API call except `/api/v1/events` and `/api/v1/health` (key) and the login itself. |
| NFR-36 | Separation | The installer has no server code or server dependencies; the server deploy has no Electron code. One shared contract file. |
| NFR-37 | Language | All new app text in both language tables (NFR-20); dashboard text in Thai and English. |
| NFR-38 | Config | Batch size, timeouts, backoff, outbox limits in a client config module; server port, DB, time zone, rate limits in `.env` with defaults in a server config module. |
| NFR-39 | Server cost | The API answers a batch of 100 events in under 200 ms on a small VPS (1 vCPU, 1 GB RAM); the server process idles under 100 MB RAM. |

## 11. Dependencies (approved by the user on 2026-11-08)

- Desktop app: none new (Electron `net.fetch`, `safeStorage`, `crypto.randomUUID` are built in).
- Server runtime: `fastify` (HTTP server), `mysql2` (MySQL driver). Login, hashing and cookies use Node built-ins.
- Server dev: `esbuild` (bundle the API with the shared contract), plus the repo's existing Vue, Vite, TypeScript, Vitest, ESLint.
- Dashboard charts: drawn as plain SVG in Vue components (no chart library, user 2026-11-08).

## 12. Testing notes

- The schema, the outbox (limits, damaged lines, backoff) and the sender (with a fake server on localhost) are unit tested in the app repo; no real network in tests.
- Server tests run against a separate test database on the MySQL installed on the dev PC and cover keys, duplicates, bad events, login and the stats queries.
- App checks: an isolated test run sending to a local server; pull the network (stop the local server) and check the queue, then start it and check the queue drains with no duplicates.
- Deploying to the VPS needs the user's SSH and secrets: the user runs those steps (or tells Claude to run specific commands); Claude never stores the credentials.

## 13. Milestones (v6)

Same phase approval rule as before. v6 starts only after the user approves this doc.

| Phase | Work | Gate | Status |
| --- | --- | --- | --- |
| V6-M1 | Contract and client: `activity.ts`, pet and device ids, event recording, outbox, sender, Settings group (EN/TH) | Unit tests; an isolated app run sends to a small local test endpoint; offline queue fills, drains, no duplicates; switch off sends nothing | - |
| V6-M2 | Server API: `server/` package, MySQL migrations, keys, events and health endpoints, tests | App -> local server -> rows in MySQL; duplicates skipped; bad key and bad data refused | - |
| V6-M3 | Dashboard: login, overview charts, events page, TH/EN | Pages show the data from M2; login required; page check in a browser | - |
| V6-M4 | Build and deploy: server bundle, pm2 config, nginx example, deploy README; installer unchanged in size | Server-only build runs from a clean folder; the user deploys to the VPS and the app sends over HTTPS | - |
| V6-M5 | Polish: NFR-01/31/32 measurement, installer 6.0.0, upgrade from 5.0.0 | Acceptance criteria below pass | - |

## 14. Acceptance criteria (v6)

- [ ] With the switch off (the default), the app makes no network calls and behaves exactly like v5.
- [ ] With it on, every event in FR-80 reaches the server once, also after the network was down for a while.
- [ ] The outbox respects its limits and survives a crash; turning the PC off with events waiting loses none.
- [ ] Wrong URL, wrong key or a dead server never disturb the cat; the Settings status says what is wrong.
- [ ] The dashboard needs a login and shows the current pet, needs over time, care per day and focus sessions; the events page filters and pages.
- [ ] The server can be built and deployed alone; the installer contains no server code.
- [ ] Idle CPU and RAM still meet NFR-01 with the switch on.
- [ ] Upgrading from 5.0.0 keeps all data and gives the pet an id; the switch is off after the upgrade.

## 15. Open questions

All answered by the user on 2026-11-08 (see section 2). New questions go here.
