# Internal Facing API (Backend)

FastAPI backend for the internal-facing product application.

## Run order (local dev)

1. Start the backend first from the project root.
2. Start the frontend dev server from [frontend](/home/user1/Documents/fan_graphs_website/frontend).
3. Open `http://localhost:8001` for live frontend work.

## Set up (Windows)

From the project root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
```

## Run API

From the project root:

```powershell
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

API base URL: `http://localhost:8000`  
Docs: `http://localhost:8000/docs`

## Database

The app is PostgreSQL-primary.

Set `DATABASE_URL`, for example:

```bash
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/DBNAME
```

For the deployed Podman stack, `.env.deploy` should point at the compose service name:

```bash
POSTGRES_DB=fan_graphs
POSTGRES_USER=fan_graphs_user
POSTGRES_PASSWORD=change_me
DATABASE_URL=postgresql+psycopg://fan_graphs_user:change_me@postgres:5432/fan_graphs
```

SIT should use a different database name on the same Postgres server, for example:

```bash
DATABASE_URL=postgresql+psycopg://fan_graphs_user:change_me@127.0.0.1:5432/internal_facing_sit
BOOTSTRAP_ADMIN_USERNAME=admin
BOOTSTRAP_ADMIN_PASSWORD=A_STRONG_ADMIN_PASSWORD
SESSION_SECRET=A_LONG_RANDOM_SECRET
AUTH_COOKIE_SECURE=false
```

## Migrations

Alembic is included for schema preparation and future DB migrations.

Current workflow:

- brand-new databases are created and upgraded to `head`
- existing legacy databases with app tables but no `alembic_version` table are stamped at `head`
- runtime `init_db()` still acts as a temporary compatibility backstop for older databases

Useful commands:

```bash
./migrate_db.sh --sit
./migrate_db.sh --deploy
python3 -m backend.db_management prepare-configured-databases
```

## Seed sample data (optional)

From the project root, with the venv active:

```powershell
python -m backend.seed_once
```

This creates two sample fan products with basic RPM and efficiency graph data using the current product model.

## Deploy

Use the project scripts for normal operation:

```bash
./redeploy.sh
./backup_db_data.sh --deploy
./backup_media_data.sh --deploy
./restore_db_data.sh data/backups/your_backup_file.zip --deploy
./restore_media_data.sh data/backups/your_media_backup_file.zip --deploy
```

Legacy wrappers remain available as `./backup_bundle.sh`, `./backup_data.sh`, `./restore_bundle.sh`, and `./restore_data.sh`.
