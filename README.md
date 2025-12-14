# Student Quiz

Full-stack student quiz engine with Flask + Postgres backend and React frontend. Supports email/password auth, quiz delivery from JSON configs, and persistent scoring/activity history.

## Quickstart

1. Copy env and adjust if needed:
   ```bash
   cp .env.example .env
   ```
2. Start the stack:
   ```bash
   docker compose up --build
   ```
3. Open the UI at http://localhost:5173. API is at http://localhost:5000/api.

## App notes

- Quizzes are stored as JSON in `backend/quizzes/`. Add new files to expand the catalog.
- Activity (scores, timestamps, duration) is saved to Postgres. Tables auto-create on startup.
- Auth tokens are signed (itsdangerous) and sent via `Authorization: Bearer`.

See `docs/DEVELOPMENT.md` for more detail.
