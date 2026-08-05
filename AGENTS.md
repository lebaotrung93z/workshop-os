# AGENTS.md

## Cursor Cloud specific instructions

Workshop OS production stack is **Angular + Firebase Firestore** (Spark), hosted as a Render static site. There is no Spring Boot API or Postgres in production.

### Services

| Service | How to run | Notes |
|---|---|---|
| Web (Angular 18) | `cd web && npm start` | Port 4200; uses Firestore directly |
| Firebase project | `workshop-os-bosch` | Config in `web/src/environments/` |
| Render static | auto-deploys from `main` | https://workshop-os-web.onrender.com/ |

### Local development

```bash
cd web && npm ci
npm start
```

- Host: http://localhost:4200/
- Join: `/?code=XXXXXX` or `/#/j?code=`
- Big screen: `/#/display/:sessionId`

Realtime uses Firestore `onSnapshot` (not WebSockets). AI summary is a client-side heuristic. Export is CSV / text in the browser.

### Deploy

Push to `main` — Render builds `cd web && npm ci && npm run build` and publishes `web/dist/web/browser`.

Firestore rules (when changed):

```bash
npx -y firebase-tools@latest deploy --only firestore:rules --project workshop-os-bosch
```

### Avatars

`app-bosch-avatar` falls back to **2-letter initials** from the display name when no photo is set. Rosters use `listParticipants()` against the session’s Firestore `participants` subcollection.

### Docs

Product flows: [`docs/FLOWS.md`](docs/FLOWS.md) (originally written for the Spring MVP; host/participant/display flows still apply; persistence is Firestore).

### Legacy Spring MVP branch

`cursor/workshop-os-mvp` and related PRs target the old Spring Boot + Postgres stack. Do **not** merge that API back onto `main` — production intentionally moved off Render API (410) to Firestore.
