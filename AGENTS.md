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

### OKR linked board

OKR sessions use `boardMode: 'okr'`: host adds Objectives, participants submit KRs with `parentId`, voting is KR-only, and the form step links actions via `sourceEntryId`. Helpers live in `web/src/app/core/okr.util.ts`. Seeded templates refresh when `seedRevision` bumps in `ensureTemplates()`.

Participants can **edit/delete their own** stickies, KRs, and actions from the live phone UI; hosts can edit Objective text on the tree. Requires deployed `firestore.rules` (owner update + soft-delete).

### Live timer

Host can start/pause/resume/reset a countdown on timed steps (`currentStep.timerSeconds`). State is synced on the session doc as `timerEndsAt` (ISO) and `timerPausedRemaining` (seconds while paused). Helpers: `web/src/app/core/timer.util.ts`. Changing step / start / end clears the timer.

### Save workshop for later

Host sessions created in this browser are tracked in `localStorage` (`wos_host_sessions`) so multiple workshops can be prepared and resumed. Flow: Create & prepare → add title / OKR theme / Objectives in LOBBY → **Save for later** → resume from home. Objectives can be seeded before Start on OKR templates.

### Add steps during workshop

Host can insert poll / input / voting / form (etc.) steps mid-session via `ApiService.insertStep` — adds after the current step or at the end without changing `currentStepId`. Participants and display pick up the updated `steps[]` over Firestore.

### Edit step settings live

Host **Step Settings** tab can change title, instructions, `timerSeconds`, poll options, input columns / OKR board flags, votes-per-participant, and form KR linking via `ApiService.updateStep`. Step `type` stays locked. Saving a new timer duration clears any running countdown (optional Save & restart).

### Welcome big screen

On the welcome step, host can set `config.welcomeText` and `config.backgroundImageUrl` via Step Settings. Prefer a public image URL. Optionally pick a small local image (&lt;400KB) which is stored as a data URL in the session (no Firebase Storage / Blaze plan).

### UI theme (mockup)

Visual language follows the hybrid mockup (not strict Bosch square/`#007bc0` defaults): primary `#0056D2`, ~8px radii, Inter, dark host sidebar, dark big-screen display, green/red/blue input columns. Tokens live in `web/src/styles/_workshop-theme.scss` and map onto existing `--bosch-*` CSS variables so `bosch-*` components pick up the mockup look.

### Docs

Product flows: [`docs/FLOWS.md`](docs/FLOWS.md) (originally written for the Spring MVP; host/participant/display flows still apply; persistence is Firestore).

### Legacy Spring MVP branch

`cursor/workshop-os-mvp` and related PRs target the old Spring Boot + Postgres stack. Do **not** merge that API back onto `main` — production intentionally moved off Render API (410) to Firestore.
