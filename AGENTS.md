# AGENTS.md

## Cursor Cloud specific instructions

Workshop OS is a hybrid workshop facilitation platform with two runnable services plus a database. See `README.md` for the product overview and standard commands; the notes below cover only non-obvious cloud/dev caveats.

### Services

| Service | Dir | Start command | Port |
|---|---|---|---|
| API (Spring Boot 4 + Flyway/JPA + STOMP WS) | `api/` | `./mvnw spring-boot:run` | 8080 |
| Web (Angular 18 dev server) | `web/` | `npm start` | 4200 |
| PostgreSQL 16 (apt cluster) | — | `sudo pg_ctlcluster 16 main start` | 5433 |

### Database (important)

- Postgres runs as an apt-installed cluster listening on **port 5433** (not the default 5432), matching the app's default `SPRING_DATASOURCE_URL`. Database `workshop_os`, user/password `workshop`/`workshop` already exist and match the app defaults, so the API needs no env vars locally.
- The cluster is **not auto-started on VM boot**. Run `sudo pg_ctlcluster 16 main start` before starting the API (idempotent; use `status`/`restart` as needed). Docker is not installed — use this native cluster instead of `docker compose up`.
- The API runs Flyway migrations automatically on startup and uses `ddl-auto: validate`.

### API notes

- First `./mvnw` run downloads Maven 3.9.16 via the wrapper (`distributionType=only-script`). JDK 21 is present; the project targets Java 17, which is fine.
- Health check: `GET /actuator/health`. REST base path is `/api` (e.g. `GET /api/templates`).
- `GROQ_API_KEY` is empty by default, so the AI-summary feature uses a built-in heuristic fallback — no external AI service is required for local dev.

### Web notes

- The frontend calls the API directly at `http://localhost:8080/api` (from `src/environments/environment.ts`) using CORS; it does **not** use the `/api` dev proxy. `proxy.conf.json`'s `/api` target double-prefixes `/api` and returns 500, but nothing in the app uses it.
- Unit tests (`ng test`) need a Chrome binary with `--no-sandbox` in this container. Point `CHROME_BIN` at a wrapper that adds `--no-sandbox --disable-dev-shm-usage`, then run `npx ng test --watch=false --browsers=ChromeHeadless`. The Karma + headless Chrome runner works, but the default `src/app/app.component.spec.ts` is a stale scaffold spec (asserts a `title` property that the real `AppComponent` does not have) and fails to compile — a pre-existing repo test bug, unrelated to the environment.

### Linting

No linter is configured (no ESLint/Checkstyle; `web/package.json` has no `lint` script). "Lint" here effectively means the TypeScript/Java compile step performed by the build.
