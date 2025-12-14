# Development onboarding

## Stack overview
- **Backend:** Flask + SQLAlchemy, Postgres via Docker. Auth uses signed tokens (itsdangerous) with email/password.
- **Frontend:** React + Vite. Calls the API at `VITE_API_URL` (default `http://localhost:5000/api`).
- **Data:** Quizzes defined as JSON (`backend/quizzes/*.json`), persisted results in Postgres.

## Prerequisites
- Docker + Docker Compose
- Node 18+ (optional for local frontend dev without Docker)
- Python 3.11+ (optional for backend dev without Docker)

## Run everything with Docker
```bash
cp .env.example .env          # edit secrets if desired
docker compose up --build     # starts db, backend:5000, frontend:5173
```

## Local backend without Docker
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
export FLASK_APP=backend.app:create_app
export DATABASE_URL=postgresql+psycopg2://quiz_user:quiz_password@localhost:5432/student_quiz  # adjust
python scripts/init_db.py
flask run --port 5000
```

## Local frontend without Docker
```bash
cd frontend
npm install
npm run dev -- --host --port 5173
```

Set `VITE_API_URL` in `.env` (frontend) if the API is not at localhost:5000.

## API summary
- `POST /api/register` — {email, password} → token + user
- `POST /api/login` — {email, password} → token + user
- `GET /api/me` — current user (Bearer token)
- `GET /api/quizzes` — list available quizzes (without answers)
- `GET /api/quizzes/:id` — quiz detail (without answers)
- `POST /api/quizzes/:id/submit` — submit answers; body `{answers, started_at?, completed_at?}`
- `GET /api/results` — previous attempts for the user

## Data model
- **users**: id, email, password_hash, created_at
- **quiz_results**: id, user_id, quiz_id, quiz_title, responses (JSON), score, correct_count, total_questions, started_at, completed_at, created_at

## Adding quizzes
1. Drop a new JSON file in `backend/quizzes/`. Use `id`, `title`, `description`, `time_limit_seconds`, and `questions` with fields:
   ```json
   {
     "id": "physics_basics",
     "title": "Physics Basics",
     "description": "Introductory physics set",
     "time_limit_seconds": 600,
     "questions": [
       {
         "id": "q1",
         "text": "What is the unit of force?",
         "options": ["Newton", "Joule", "Watt", "Pascal"],
         "correct_option": "Newton"
       }
     ]
   }
   ```
2. Restart the backend container or trigger a reload; quizzes are re-read on each request.

## Useful commands
- `docker compose up --build` — run the full stack
- `docker compose logs -f backend` — tail API logs
- `python scripts/init_db.py` — ensure tables exist (non-Docker)
- `npm run build` (from `frontend/`) — production build

## Testing ideas
- Register/login, then attempt `general_science` quiz; confirm score and activity show under Results.
- Submit multiple times to verify history ordering.
- Add a new quiz JSON and ensure it appears in the UI without code changes.
