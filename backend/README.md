# Fan Graphs API (Backend)

FastAPI + SQLite backend. Database file lives in `../data/fans.db` (relative to project root: `data/fans.db`).

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

- **Location**: `data/fans.db` (created automatically on first run).
- **Strategy**: MVP uses auto-create tables on startup (no migrations). Tables: `fans`, `curve_points`, `map_points`.

## Seed sample data (optional)

From project root, with venv active:

```powershell
python -m backend.seed_once
```

This creates one fan "Example Fan-1" and imports points from `data/curve_points_example.csv` and `data/map_points_example.csv`. Skip if you already have data.

## Deploy (Linux later)

Use the same commands; ensure Python 3.10+ and run uvicorn with a production ASGI server (e.g. `uvicorn backend.main:app --host 0.0.0.0 --port 8000`). Point frontend config to the deployed API URL.
