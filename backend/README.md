# Fan Graphs API (Backend)

FastAPI backend for the fan graphs application. During the database transition,
the app can run either:

- Postgres as the primary database
- SQLite as the primary database with Postgres mirroring writes

## Run order (local dev)

1. Start the **backend** first (this folder): create venv, install deps, run uvicorn.
2. Start the **frontend** (see `frontend/README.md`): install deps, run dev server.
3. Open http://localhost:5173 in the browser; the frontend calls the API at http://localhost:8000.

## Set up (Windows)

From the **project root** (parent of `backend/`):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
```

## Run API

From the **project root** (so that `backend` is the package):

```powershell
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

API base URL: http://localhost:8000  
Docs: http://localhost:8000/docs

## Database

Primary database selection is controlled by `DATABASE_URL`.

Examples:

```bash
# Postgres primary
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/DBNAME

# SQLite primary
DATABASE_URL=sqlite:////full/path/to/data/fans.db
```

## Dual database mode

For the current transition period, SQLite can remain the primary database while
Postgres mirrors writes.

Set:

```bash
DATABASE_URL=sqlite:////full/path/to/data/fans.db
POSTGRES_DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/DBNAME
```

Behavior:

- `DATABASE_URL` remains the primary read/write database for the API
- when `POSTGRES_DATABASE_URL` is set, backend startup creates the Postgres schema
  and backfills the current SQLite data into Postgres
- subsequent writes are mirrored into Postgres by ID so both databases stay aligned

Useful maintenance endpoints while testing:

- `GET /api/maintenance/databases/mirror-status`
- `POST /api/maintenance/databases/resync-postgres`

## Recommended local/dev workflow

Use env files in the project root instead of exporting variables every time:

- `./run_sit.sh` loads `.env.sit` if present
- `./redeploy.sh` loads `.env.deploy` if present and starts the Podman Compose deployment stack

Example setup:

```bash
cp .env.sit.example .env.sit
cp .env.deploy.example .env.deploy
```

For a Postgres-primary setup, set:

```bash
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/DBNAME
POSTGRES_DATABASE_URL=
BOOTSTRAP_ADMIN_USERNAME=admin
BOOTSTRAP_ADMIN_PASSWORD=A_STRONG_ADMIN_PASSWORD
SESSION_SECRET=A_LONG_RANDOM_SECRET
AUTH_COOKIE_SECURE=false   # true behind HTTPS
```

For the deployed Podman stack, `.env.deploy` should point the app at the
Compose Postgres service name:

```bash
POSTGRES_DB=fan_graphs
POSTGRES_USER=fan_graphs_user
POSTGRES_PASSWORD=change_me
DATABASE_URL=postgresql+psycopg://fan_graphs_user:change_me@postgres:5432/fan_graphs
```

## Seed sample data (optional)

From project root, with venv active:

```powershell
python -m backend.seed_once
```

This creates one fan "Example Fan-1" and imports points from `data/curve_points_example.csv` and `data/map_points_example.csv`. Skip if you already have data.

## Deploy (Linux later)

Use the same commands; ensure Python 3.10+ and run uvicorn with a production ASGI server (e.g. `uvicorn backend.main:app --host 0.0.0.0 --port 8000`). Point frontend config to the deployed API URL.
