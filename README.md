# Workshop OS

Hybrid workshop facilitation platform (Host laptop · Participant mobile web · Big Screen).

## Stack

- **web/** — Angular 18 + Bosch UI (`bosch-ui` / `bosch-icon` / `bosch-theme.scss`)
- **api/** — Java Spring Boot 4 (REST + STOMP WebSockets), Flyway, JPA
- **Postgres** — local via Docker Compose (`localhost:5433`)
- **AI** — Groq (default) or Ollama (`AI_PROVIDER=ollama`)
- **Deploy** — Render Blueprint (`render.yaml`)

## Local development

```bash
# 1) Database
docker compose up -d

# 2) API
cd api && ./mvnw spring-boot:run

# 3) Web
cd web && npm start
```

- Host: http://localhost:4200/
- Join: http://localhost:4200/j
- Big screen: `/display/:sessionId` (link from host control)

### Env (API)

| Variable | Default |
|---|---|
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5433/workshop_os` |
| `CORS_ORIGINS` | `http://localhost:4200` |
| `AI_PROVIDER` | `groq` |
| `GROQ_API_KEY` | (empty → heuristic fallback summary) |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` |

## Load check

With the API running:

```bash
python3 scripts/load-check.py
```

Creates a session, joins 50 participants in parallel, and verifies `participantCount`.

## Render

- Web: https://workshop-os-web.onrender.com  
- API: https://workshop-os-api.onrender.com  

Connect the repo and apply `render.yaml` (API web service + static site + Postgres). Set `CORS_ORIGINS` to the web URL and `GROQ_API_KEY`.

The Angular app uses **hash routing** (`/#/display/...`, `/#/j?code=...`) so deep links work on Render static hosting. Optionally add a Dashboard rewrite `/*` → `/index.html` if you later switch back to path URLs.

