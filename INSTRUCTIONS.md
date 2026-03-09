## Starting the Fan Graphs project (Windows)

These steps assume your project lives at:

`C:\Users\drift\OneDrive\PROJECTS\fan_graphs_website`

### 1. Create (or recreate) the Python virtual environment

From a PowerShell window in the project root:

```powershell
cd C:\Users\drift\OneDrive\PROJECTS\fan_graphs_website
python -m venv .venv
```

If `.venv` already exists and is broken, delete it first (after stopping any running `python`/`uvicorn` that use it):

```powershell
Remove-Item -Recurse -Force .venv
python -m venv .venv
```

### 2. Activate the virtual environment

Still in the project root:

```powershell
.\.venv\Scripts\Activate.ps1
```

Your prompt should start with `(.venv)` when activation works.

### 3. Install backend dependencies

With the venv active:

```powershell
pip install -r backend/requirements.txt
```

You only need to repeat this when `backend/requirements.txt` changes.

### 4. (Optional) Seed example data

This creates one example fan and imports example curve/map points from `data/curve_points_example.csv` and `data/map_points_example.csv`.

```powershell
python -m backend.seed_once
```

You only need to run this once on a fresh database.

### 5. Start the backend (FastAPI)

With the venv active, from the project root:

```powershell
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000` (interactive docs at `http://localhost:8000/docs`).

Leave this terminal running while you use the app.

### 6. Install frontend dependencies (first time)

Open a **second** terminal window and run:

```powershell
cd C:\Users\drift\OneDrive\PROJECTS\fan_graphs_website\frontend
npm install
```

You usually only do this once (or when `frontend/package.json` changes).

### 7. Start the frontend (SvelteKit)

From the same `frontend` folder:

```powershell
npm run dev
```

By default this runs on `http://localhost:5173`.

If you ever see an error about missing `.svelte-kit` generated files, run:

```powershell
npm run sync
```

…then retry `npm run dev`.

### 8. Use the app

- Open `http://localhost:5173` in your browser.
- Backend must be running on `http://localhost:8000`.

