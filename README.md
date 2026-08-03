# Workshop OS

Hybrid workshop facilitation (Host laptop · Participant mobile web · Big Screen).

## Stack (free)

- **web/** — Angular 18 + Bosch UI + **Firebase Firestore** (Spark) + Anonymous-style host/join tokens
- **Hosting** — Render static site (free)
- No Spring Boot API, no Postgres, no paid Cloud Functions

Firebase project: `workshop-os-bosch` (Spark).

## Local development

```bash
cd web && npm start
```

- Host: http://localhost:4200/
- Join: http://localhost:4200/?code=XXXXXX (or `/#/j?code=`)
- Big screen: `/#/display/:sessionId`

## Deploy

Push to `main` — Render builds the static Angular app. Firestore rules deploy with:

```bash
npx -y firebase-tools@latest deploy --only firestore:rules --project workshop-os-bosch
```

## Notes

- Realtime uses Firestore `onSnapshot` (replaces WebSockets).
- AI summary is a free **heuristic** client aggregator (no Groq key in the browser).
- Export is CSV / text report generated in the browser.
