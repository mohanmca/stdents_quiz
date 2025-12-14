# Student Quiz Platform — Comprehensive Developer Guide

This document is a deep dive for new developers joining the Student Quiz platform. It aims to be long-form (roughly 5,000 words) so you can learn the system holistically: what it does, how it is assembled, why certain choices were made, and how to operate and extend it safely. Feel free to skim sections as needed; each section is written to stand alone and includes context, rationale, and step-by-step guidance.

## 1. Project mission and core idea
The Student Quiz platform is a lightweight quiz engine focused on general knowledge science content. Its goals are:
1) Provide a clean, dependable way for students to register, log in with an email and password, and take quizzes from a catalog defined in JSON. 
2) Persist quiz attempts, including scores, start/end timestamps, and duration, so learners can track progress over time. 
3) Offer a front-end that is approachable and responsive, built with React and Vite, with a simple API integration layer. 
4) Keep the operational surface area small by using Docker Compose to orchestrate Postgres, the Flask backend, and the React frontend. 
5) Stay extensible: quizzes are defined as JSON files in the repository so new questions can be added without backend code changes, and the API is intentionally straightforward for future automation (e.g., batch imports, analytics exports).

The design philosophy is “small, clear, and batteries-included.” Everything needed to run locally is contained in the repository: environment templates, container definitions, app code, and documentation.

## 2. Technology stack and why it was chosen
### Backend: Flask + SQLAlchemy
- Flask is a minimal, well-understood Python microframework that excels at small to medium APIs. It keeps the mental model simple for new contributors and aligns well with JSON-heavy workflows.
- SQLAlchemy (with Flask-SQLAlchemy) provides ORM convenience while still allowing raw SQL when performance tuning is needed. It is standard in Python ecosystems and integrates neatly with Postgres.
- Itsdangerous supplies signed tokens for stateless authentication, minimizing session management overhead. 
- Python 3.11 is used for its performance improvements and typing features.

### Frontend: React + Vite
- React is a widely adopted UI library with a strong ecosystem, making it easy for new contributors to get productive quickly.
- Vite offers a fast dev server and lean build tooling without heavyweight configs. It optimizes for developer experience and rapid iteration.
- The frontend is intentionally single-page with a focused set of features: auth, quiz selection, quiz taking, and results visualization (including a simple progress chart).

### Database: Postgres
- Postgres is robust, feature-rich, and battle-tested. It provides strong JSON support (useful if we later store quiz metadata inline) and handles relational modeling for users and quiz results.
- The Docker Compose setup runs Postgres 15 locally with a persistent volume to keep data across restarts.

### Containerization: Docker Compose
- Compose wraps the stack (db, backend, frontend) behind a single command, reducing onboarding friction.
- Service dependencies are wired with environment variables, and port mappings keep host conflicts minimal (backend exposed on host 5001 to avoid system port collisions, frontend on 5173).

### Tooling support
- dotenv to load environment variables for local runs.
- npm for frontend package management.
- curl for quick endpoint checks.
- Python venv optional for non-Docker backend development.

## 3. System architecture: high-level flow
The system follows a simple client-server architecture:
- The frontend (React) lives at http://localhost:5173 and communicates with the backend API via fetch using the base URL provided in `VITE_API_URL` (default http://localhost:5001/api).
- The backend (Flask) exposes REST-ish endpoints for auth (`/register`, `/login`, `/me`), quizzes (`/quizzes`, `/quizzes/<id>`, `/quizzes/<id>/submit`), and results (`/results`), plus a health endpoint (`/health`).
- The database (Postgres) stores `users` and `quiz_results`. Quizzes themselves are read from JSON files on disk inside `backend/quizzes/` each time they are requested, making the catalog dynamic without code changes.
- Authentication uses bearer tokens signed with itsdangerous. Tokens embed a user id and respect an expiration window. The frontend stores the token in `localStorage` and sends it on requests via `Authorization: Bearer`.
- Quiz submission includes the student’s answers, start time, and completion time. The backend calculates score and persists the attempt, including duration. The frontend fetches result history to render a progress chart.

## 4. Repository layout
- `backend/` — Flask app, models, routes, config, and quiz JSON files.
- `backend/quizzes/` — Quiz definitions in JSON. Add new files here to expand the catalog.
- `frontend/` — React app using Vite, including styling and components.
- `docker-compose.yml` — Orchestrates Postgres, backend, and frontend.
- `backend/Dockerfile` and `frontend/Dockerfile` — Build instructions for the services.
- `.env.example` — Environment template for Compose and local runs.
- `scripts/init_db.py` — Utility to create tables when running backend outside Docker.
- `README.md` — Quick start.
- `docs/DEVELOPMENT.md` — Onboarding steps and API summary.
- `docs/PROJECT_OVERVIEW.md` (this file) — Deep-dive documentation.

## 5. Detailed backend design
### Application bootstrap
- Entry point: `backend/app.py` exposes `create_app()`. It loads configuration, initializes CORS, wires SQLAlchemy, auto-creates tables (acceptable for this small app; migrations can be added later), and registers blueprints for auth and quizzes.
- CORS is configured to allow the configured origin(s) with credentials.
- The health route `/api/health` returns a simple JSON payload used for smoke checks.

### Configuration
- `backend/config.py` defines defaults: `DATABASE_URL`, `SECRET_KEY`, `TOKEN_EXPIRATION_SECONDS`, `CORS_ORIGINS`, and disables SQLAlchemy track modifications for performance.
- Environment variables override defaults; `.env` is read via python-dotenv when running locally or in Compose.

### Data models
- `User`: id (int), email (unique), password_hash, created_at.
- `QuizResult`: id, user_id, quiz_id, quiz_title, responses (JSON), score (float percentage), total_questions, correct_count, started_at, completed_at, created_at. A computed property `duration_seconds` returns time delta when start and completion are present.
- The schema is intentionally small: user profiles are minimal, and quiz metadata is stored in JSON configs, not in the DB.

### Auth flow
- Registration (`POST /api/register`): accepts email + password; hashes password using Werkzeug’s `generate_password_hash`, stores the user, and issues a signed token.
- Login (`POST /api/login`): validates credentials, returns token and user metadata.
- `GET /api/me`: verifies bearer token, returns current user.
- Token handling uses itsdangerous with a time-limited serializer. Tokens contain `user_id` and expire according to `TOKEN_EXPIRATION_SECONDS`.

### Quiz flow
- Listing (`GET /api/quizzes`): reads all JSON files in `backend/quizzes`, strips answers before returning.
- Detail (`GET /api/quizzes/<id>`): returns sanitized quiz.
- Submit (`POST /api/quizzes/<id>/submit`): requires auth. Body includes `answers`, `started_at`, `completed_at`. Backend recalculates score server-side using stored correct answers, persists the attempt, and returns the result payload.
- Results (`GET /api/results`): requires auth; returns all attempts for the user sorted by creation time descending.

### JSON quiz format
A quiz JSON contains `id`, `title`, `description`, `time_limit_seconds`, and `questions` with fields `id`, `text`, `options`, and `correct_option`. Example: `backend/quizzes/general_science.json`.

### Persistence strategy and migrations
- Tables are created on startup via `db.create_all()`. For production-grade environments, adding Alembic migrations is recommended. The current flow is sufficient for local/dev and small deployments.
- Postgres connection URL defaults to `postgresql+psycopg2://quiz_user:quiz_password@db:5432/student_quiz` in Compose. Override `DATABASE_URL` for other environments.

### Security considerations
- Passwords are hashed; no plaintext storage.
- Tokens are signed and time-limited. Adjust `TOKEN_EXPIRATION_SECONDS` as needed.
- CORS origins are configurable via env.
- Input validation is intentionally light (email format is trusted per requirements); if you extend auth, consider stricter validation and rate limiting.

## 6. Detailed frontend design
### Application shell
- Vite entry at `frontend/index.html`; React root in `frontend/src/main.jsx`.
- Global styles in `frontend/src/index.css` to establish layout, typography, button styles, and quiz option states.
- Single-page UI implemented in `frontend/src/App.jsx`.

### State model
- `token`, `user`, `authMode`, `authForm` manage authentication.
- `quizzes`, `currentQuiz`, `answers`, `startedAt` manage quiz flow.
- `results` holds history fetched from `/results`.
- `message` provides transient feedback; `loading` flags network operations.

### Data fetching
- API base URL from `import.meta.env.VITE_API_URL` (default http://localhost:5001/api).
- `authHeaders` memoize the bearer token header.
- On token presence, the app loads `/me`, quizzes, and results.
- Quiz submission posts answers and timestamps; upon success, results are re-fetched.

### UX highlights
- Auth box with toggle between login/register.
- Quiz list cards with time badges.
- Quiz attempt view showing questions and options; answers are tracked locally.
- Results section showing score, correct counts, start/finish timestamps, and duration.
- Progress chart: a small inline SVG line chart mapping scores over time (oldest to newest) to visualize improvement.

### Styling approach
- Custom CSS (no external UI library) for clarity and simplicity.
- Responsive grid for quiz cards and results.
- Button and badge styles for recognizable interactions.

## 7. Local development workflows
### Full stack via Docker Compose
1) Copy env: `cp .env.example .env`.
2) Start: `docker compose up --build -d`.
3) Frontend at http://localhost:5173, backend API at http://localhost:5001/api, Postgres at localhost:5432.
4) Stopping: `docker compose down` (data persists via `db_data` volume).

### Backend without Docker
1) Create venv: `python3 -m venv .venv && source .venv/bin/activate`.
2) Install deps: `pip install -r backend/requirements.txt`.
3) Set env: `export FLASK_APP=backend.app:create_app` and `DATABASE_URL=postgresql+psycopg2://...`.
4) Ensure tables: `python scripts/init_db.py`.
5) Run: `flask run --port 5000`.

### Frontend without Docker
1) `cd frontend && npm install`.
2) `npm run dev -- --host --port 5173`.
3) Set `VITE_API_URL` in a `.env` file inside `frontend/` if backend is not on localhost:5001.

### Quick health checks
- `curl -i http://localhost:5001/api/health` to verify backend.
- `curl -i http://localhost:5173` to verify frontend.
- `docker logs student_quiz-backend-1` for API logs, `docker logs student_quiz-frontend-1` for Vite logs, `docker logs student_quiz-db-1` for Postgres.

## 8. Data model and schema details
### users table
- `id`: integer primary key.
- `email`: unique, indexed, required.
- `password_hash`: hashed password string.
- `created_at`: UTC timestamp of registration.

### quiz_results table
- `id`: integer primary key.
- `user_id`: foreign key to users.id.
- `quiz_id`: string identifier corresponding to quiz JSON `id`.
- `quiz_title`: stored denormalized for easy display even if quiz JSON changes later.
- `responses`: JSON mapping question id to chosen option.
- `score`: float percentage (0–100).
- `total_questions`: integer count.
- `correct_count`: integer of correct answers.
- `started_at`: timestamp when the attempt started (optional if not provided).
- `completed_at`: timestamp when submission occurred.
- `created_at`: timestamp when record was written.
- `duration_seconds` (computed property): difference between start and completion when available.

### Indexing and performance notes
- Email is indexed for quick lookup during login.
- user_id and quiz_id are indexed on quiz_results to speed retrieval of a user’s history.
- For larger datasets, consider composite indexes on (user_id, created_at desc) and periodic cleanup/partitioning if needed.

## 9. API contract and examples
All endpoints are prefixed with `/api`.

### Auth
- `POST /register` — body `{ "email": "", "password": "" }`. Returns `{ token, user }`.
- `POST /login` — same shape as register. Returns `{ token, user }`.
- `GET /me` — requires bearer token. Returns `{ user }`.

### Quizzes
- `GET /quizzes` — returns list of available quizzes without correct answers.
- `GET /quizzes/:id` — returns a single quiz without correct answers.
- `POST /quizzes/:id/submit` — requires bearer token. Body `{ answers: { [questionId]: option }, started_at?, completed_at? }`. Returns `{ result }` including score, counts, timestamps.

### Results
- `GET /results` — requires bearer token. Returns all attempts for the current user.

### Health
- `GET /health` — returns `{ "status": "ok" }`.

### Curl snippets
- Register: `curl -X POST http://localhost:5001/api/register -H "Content-Type: application/json" -d '{"email":"a@b.com","password":"pw"}'`
- Login: `curl -X POST http://localhost:5001/api/login -H "Content-Type: application/json" -d '{"email":"a@b.com","password":"pw"}'`
- List quizzes: `curl http://localhost:5001/api/quizzes`
- Submit quiz (token needed): `curl -X POST http://localhost:5001/api/quizzes/general_science/submit -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"answers":{"q1":"Carbon dioxide"}}'`

## 10. Adding and editing quizzes
1) Create a new JSON file in `backend/quizzes/`, e.g., `physics_basics.json`.
2) Follow the schema: `id`, `title`, `description`, `time_limit_seconds`, `questions` array with `id`, `text`, `options`, `correct_option`.
3) Restart backend (or let auto-reload pick it up) to expose the new quiz via `/quizzes`.
4) No DB migrations are needed because quizzes are file-based.
5) Keep question ids unique within a quiz; string ids are recommended for readability.

## 11. Authentication, authorization, and tokens
- Tokens are signed JWT-like blobs produced by itsdangerous. They are not JWTs but serve a similar purpose: encapsulate user id and expire after a configured period.
- The frontend stores tokens in `localStorage`. For production environments, consider adding server-set HttpOnly cookies if session hijacking is a concern.
- Token expiry errors return 401; the frontend clears the token and redirects to auth.
- Password hashing uses Werkzeug’s PBKDF2 defaults; if security posture increases, consider Argon2 or configuring rounds appropriately.
- There is no email verification in this version (requirement states emails are trusted).
- There is no role-based authorization; every authenticated user can take available quizzes and view only their own results.

## 12. Operations: running, monitoring, and logs
### Running via Compose
- `docker compose up --build -d` to start.
- `docker compose down` to stop (volume persists DB data).
- `docker compose logs -f backend` to tail the API.
- `docker compose logs -f frontend` to tail Vite output.
- `docker compose logs -f db` for Postgres logs.

### Monitoring basics
- Health endpoint: `/api/health` can be polled by uptime checks.
- Database availability can be inferred from backend logs; SQLAlchemy errors will surface if connectivity fails.
- For lightweight profiling, enable Flask debug or add logging around critical routes; avoid debug in production.

### Ports
- Backend inside container listens on 5000, mapped to host 5001.
- Frontend served on 5173.
- Postgres on 5432.
- If host port 5001/5173/5432 are occupied, adjust `docker-compose.yml` mappings.

## 13. Performance and scaling considerations
- The current architecture is single-instance and designed for simplicity. For larger scale:
  - Add gunicorn or uvicorn to serve Flask with multiple workers.
  - Introduce caching for quiz JSON parsing if the catalog grows large.
  - Enable connection pooling (e.g., SQLAlchemy engine pool tuning).
  - Add pagination to `/results` if histories become large.
  - Move static assets to a CDN for production builds of the frontend (use `npm run build` and serve the dist via a static server).
- Score calculation is O(n) over the number of questions; acceptable for small quizzes.
- Database writes are simple inserts; consider background processing if adding analytics.

## 14. Testing and QA guidance
### Manual flows to verify
- Register → Login → Take quiz → Submit → Verify score shows in Results.
- Re-submit same quiz to confirm multiple attempts appear chronologically.
- Try token expiry by modifying `TOKEN_EXPIRATION_SECONDS` to a small value; ensure 401 on expired tokens and frontend clears state.
- Add a new quiz JSON and verify it appears in the list without backend changes.

### Automated options
- Backend: add pytest or unittest to validate auth, quiz scoring, and result persistence. Use a test database or SQLite for fast runs.
- Frontend: use React Testing Library for component tests; Cypress for end-to-end flows if desired.
- Linting: `npm run lint` covers basic React lint rules; backend can use `flake8` or `black` if added.

### Smoke commands
- `python3 -m compileall backend` (already used in CI-like checks) to ensure syntax validity.
- `curl` health checks for API and frontend.

## 15. Extensibility roadmap
Here are common feature directions and how to approach them:
- **Email verification / password reset**: add email sender integration, store verification tokens, and expand user model.
- **Admin quiz builder UI**: add CRUD endpoints to manage quizzes stored in DB instead of files, with migrations for quiz tables (quizzes, questions, options).
- **Timed enforcement**: enforce time limits server-side by comparing duration with `time_limit_seconds`.
- **Analytics dashboards**: add aggregate queries (average scores, attempts over time) and expose them via new endpoints; extend frontend charting.
- **Accessibility improvements**: add keyboard navigation and ARIA labels to quiz options and buttons.
- **Internationalization**: externalize strings and provide locale detection or user preference.
- **Deployment hardening**: add reverse proxy (nginx), TLS termination, and production-grade process managers.

## 16. Troubleshooting guide
### Backend won’t start
- Check `docker logs student_quiz-backend-1` for Python tracebacks.
- Ensure `DATABASE_URL` points to a reachable Postgres. In Compose, it should be `db` hostname.
- Verify env file `.env` exists; missing SECRET_KEY or DB URL can cause failures.

### Frontend not reachable
- Ensure port 5173 is free on host. Run `lsof -i :5173`.
- Check container logs for `vite: not found`—this can happen if node_modules are missing due to an overriding bind mount (removed in current Compose file).
- Validate that `VITE_API_URL` matches backend port (5001 by default).

### Database issues
- If migrations are added later, ensure `alembic upgrade head` runs.
- If you need a clean slate locally, `docker compose down -v` (be cautious: this drops data).
- Postgres credentials must match `.env` values.

### Auth problems
- 401 on `/me` usually means expired or missing token; re-login.
- If `TOKEN_EXPIRATION_SECONDS` is very small, tokens will expire quickly; increase for dev.

### Quiz not showing
- Confirm JSON file lives in `backend/quizzes/` and is valid JSON.
- Ensure the file has a unique `id` field. The filename is used as fallback, but explicit `id` is best.
- Restart backend or rely on auto-reload; the loader reads files per request.

## 17. Security posture and recommendations
- Password hashing uses PBKDF2 via Werkzeug; acceptable for small deployments. Consider Argon2 for stronger defaults.
- Use a long, unpredictable `SECRET_KEY` in production; never commit secrets.
- Restrict CORS origins to known frontends in production.
- Use HTTPS in production to protect tokens in transit.
- Consider rate limiting auth endpoints to mitigate brute force.
- Store minimal personal data; current model only retains email and quiz attempts.
- Logging: avoid logging sensitive information (passwords are never logged).

## 18. Deployment considerations
- **Development**: Docker Compose is the default; ports 5173 (frontend), 5001 (backend), 5432 (db).
- **Staging/Production**:
  - Build production frontend: `cd frontend && npm run build`, then serve `dist/` via nginx or the backend if you add a static route.
  - Run backend with a WSGI/ASGI server (gunicorn/uvicorn) for concurrency.
  - Use managed Postgres or a dedicated Postgres container with persistence and backups.
  - Set environment variables for secrets and DB connection strings.
  - Add monitoring/alerting on `/api/health`.

## 19. Operational runbooks (what to do when…)
### Need to rotate secrets
1) Generate new `SECRET_KEY`.
2) Update `.env` (or secret store) and restart backend. Tokens issued with the old key will become invalid; plan a maintenance window if needed.

### Need to import new quizzes in bulk
1) Place JSON files into `backend/quizzes/`.
2) Restart backend containers.
3) Optionally add a script to validate JSON schemas before adding.

### Need to back up data
1) The database lives in volume `student_quiz_db_data`. Use `pg_dump` inside the db container or from host with `psql` client.
2) For small deployments, copy the volume or dump to a file.

### Need to inspect a specific user’s attempts
1) Use `psql` to query `quiz_results` joined with `users`.
2) Filter by user email; review timestamps and scores.

### Need to reset a user password manually
1) Currently no endpoint; you can set a new password hash directly in DB: `UPDATE users SET password_hash = ...`.
2) Better: implement a reset endpoint that reuses the hashing utility.

## 20. Development patterns and code style
- Backend code uses type hints to improve readability. Stick to small, testable functions.
- Prefer returning JSON with explicit status codes. Errors return `{ "error": "..." }` with appropriate 4xx/5xx codes.
- Avoid storing sensitive data in responses; user objects omit password_hash.
- Frontend uses functional components and hooks; keep state colocated where it belongs.
- Styling is plain CSS; prefer small utility classes over complex frameworks to keep footprint light.
- Keep comments sparse and meaningful—only around non-obvious logic.

## 21. Future testing strategy (suggested)
- Backend: add unit tests for auth (happy path, invalid creds, duplicate emails), quiz scoring (edge cases: empty answers, all correct, all wrong), and result retrieval (ordering, timestamps).
- Frontend: add integration tests for auth flow, quiz attempt, and results rendering using mocked API or msw (Mock Service Worker).
- End-to-end: add Cypress/Playwright flows that run against `docker compose up` in CI, seeding a temp DB.
- Load testing: small k6 scripts to POST submissions and GET quizzes to spot performance cliffs.

## 22. Analytics and reporting possibilities
- Basic trend lines are implemented client-side (ScoreChart). For richer reporting:
  - Add backend aggregates: average score per quiz, attempts per day/week, time-on-task distributions.
  - Store question-level correctness to generate per-question difficulty metrics.
  - Export CSV endpoints for educators.
  - Integrate a charting library in the frontend (e.g., Recharts) if visualization needs grow.

## 23. Maintenance checklist
- Keep dependencies updated: Python packages (`pip list --outdated`), npm packages (`npm outdated`).
- Watch security advisories for Flask, SQLAlchemy, React, and Postgres.
- Verify backups for Postgres volume if running long-lived instances.
- Validate new quizzes before merging (JSON parse + schema check).
- Run smoke tests after changing auth or token handling.

## 24. Known limitations
- No email verification; assumes trusted emails.
- No password reset flow; requires manual DB update or new endpoint.
- No rate limiting or CAPTCHA; brute force mitigation is not present.
- Quiz catalog is file-based; not ideal for multi-writer scenarios without a shared filesystem or repo updates.
- No pagination on results; fine for small histories but should be added if users take many quizzes.
- No accessibility audit yet; basic semantics are present, but further a11y work is recommended.

## 25. Glossary
- **Bearer token**: A signed token used in the Authorization header to identify a user.
- **CORS**: Cross-Origin Resource Sharing; controls which origins can call the API.
- **ORM**: Object-Relational Mapper; here, SQLAlchemy to map Python objects to DB tables.
- **Vite**: A fast frontend build tool and dev server.
- **PBKDF2**: Password hashing algorithm used by Werkzeug by default.
- **JSON quiz**: Quiz definition stored as a JSON file, read by the backend per request.
- **Duration**: Time between `started_at` and `completed_at`, stored with each quiz attempt.

## 26. Example end-to-end walk-through
This narrative illustrates the lifecycle of a learner interacting with the system and the developer observability points along the way.
1) A student visits http://localhost:5173. The frontend checks localStorage for a token; none is present, so the auth box is shown.
2) The student registers with an email and password. The frontend POSTs to `/api/register`. The backend:
   - Validates presence of email/password.
   - Hashes the password and inserts a user row.
   - Issues a signed token with the user id.
   - Responds with `{ token, user }`.
3) Frontend stores the token, sets it in authorization headers, and fetches `/api/me` to confirm identity. It then loads `/api/quizzes` and `/api/results`.
4) The quiz list displays available quizzes read from JSON. Student clicks “Start quiz,” which sets local state: `currentQuiz`, empties answers, records `startedAt`.
5) Student selects answers; state updates per question. On submit, frontend sends answers plus timestamps to `/api/quizzes/<id>/submit` with the bearer token.
6) Backend:
   - Loads the quiz JSON and verifies existence.
   - Recomputes score server-side using correct answers.
   - Parses timestamps, computes duration, and writes a `quiz_results` row.
   - Returns the persisted result.
7) Frontend shows success message, clears the quiz view, and reloads results. The results section lists attempts with score, correct counts, start/end times, and duration. The progress chart draws a line across attempts to visualize improvement.
8) If the student returns later, the token is reused; if expired, `/api/me` fails with 401, and the frontend clears auth and prompts for login.
9) Developers can monitor logs during these steps:
   - Backend logs show route hits if logging is added.
   - Postgres logs show connection activity.
   - Frontend console shows network calls for debugging during local dev.

## 27. How to extend safely (step-by-step patterns)
### Adding a new field to quiz_results
1) Add the column to `QuizResult` model.
2) Introduce Alembic for migrations or regenerate the schema for local environments.
3) Update submission logic to populate the new field.
4) Extend result serialization and adjust frontend mapping.

### Adding quiz categories
1) Add `category` to JSON schema.
2) Adjust loader to capture category and return it to clients.
3) Update UI to filter or display categories.

### Adding question-level analytics
1) Change `responses` to store structured data (e.g., array of objects with correctness flags).
2) Add a new table for per-question stats if needed.
3) Build backend aggregates and frontend visualizations.

### Moving quizzes to the database
1) Create `quizzes`, `questions`, `options` tables with migrations.
2) Add CRUD endpoints; secure with admin-only roles.
3) Update frontend to fetch quizzes from DB instead of files.
4) Provide a migration/import script to move existing JSON quizzes into the DB.

## 28. Operational tips for collaboration
- Keep `.env.example` updated when new config options are added.
- Avoid committing real secrets; `.env` should remain untracked.
- Use feature branches; keep changes small and reviewable.
- Run smoke checks (`curl` health, quick quiz round-trip) before pushing.
- Document new endpoints in `docs/DEVELOPMENT.md` or this guide.

## 29. Migration to production-like environments
- Replace `flask run` with gunicorn (e.g., `gunicorn 'app:create_app()' -b 0.0.0.0:5000`).
- Use a reverse proxy (nginx) to handle TLS and static assets.
- Configure environment variables via a secrets manager (not .env files).
- Set `CORS_ORIGINS` to your production frontend origin.
- Use a managed Postgres with backups enabled.
- Build frontend with `npm run build` and serve the static bundle from nginx or a CDN.

## 30. Reliability patterns
- Health checks: keep `/api/health` lightweight and dependency-aware (optionally ping DB).
- Graceful shutdown: in production, ensure the process manager forwards SIGTERM so connections can close cleanly.
- Backups: schedule `pg_dump` backups for the database volume.
- Logging: capture backend logs centrally if running multiple instances.
- Alerting: basic alert on health check failures; later, add error rate alerts from logs.

## 31. Performance checklist
- Ensure indexes exist on primary query paths (users.email, quiz_results.user_id).
- Consider caching parsed quiz JSON to reduce file I/O if request volume increases.
- Use connection pooling in SQLAlchemy (configure pool_size, max_overflow) for high concurrency.
- Minimize payload sizes by keeping quiz responses succinct.
- Use production builds of frontend (Vite build) for faster load times.

## 32. Developer FAQ
- **Where do I change ports?** In `docker-compose.yml` under `ports:` mappings.
- **How to add a new quiz?** Drop a JSON file in `backend/quizzes/` with the schema described above.
- **Why is my frontend not seeing the backend?** Check `VITE_API_URL` matches the backend host/port and that CORS allows your origin.
- **How do I reset the DB locally?** `docker compose down -v` (danger: deletes data), then `docker compose up --build -d`.
- **Can I run backend without Docker?** Yes, use venv + `flask run` and point `DATABASE_URL` to a Postgres instance.

## 33. Closing thoughts
This guide has walked through the Student Quiz platform from mission to operations, detailing architecture, data flows, APIs, frontend behaviors, and operational playbooks. The system is intentionally small and approachable, with file-based quizzes and minimal dependencies. You can extend it gradually—start with additional quizzes, then evolve toward richer analytics, stronger authentication, or an admin authoring experience. Keep code changes scoped, document decisions, and maintain a tight feedback loop with quick smoke tests. With these practices, the platform should remain easy to reason about while supporting meaningful growth in features and scale.
