"""
FastAPI application. CORS enabled for local dev (SvelteKit on 5173).
MVP: tables auto-created on startup. Run from project root: uvicorn backend.main:app --reload
"""
import csv
import io
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from backend.database import get_db, init_db
from backend.models import Fan, MapPoint
from backend.schemas import (
    FanCreate,
    FanUpdate,
    FanResponse,
    MapPointCreate,
    MapPointResponse,
    MapPointBulk,
)

app = FastAPI(title="Fan Graphs API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()


# --- Health ---
@app.get("/api/health")
def health():
    return {"ok": True}


# --- Fans CRUD ---
@app.get("/api/fans", response_model=list[FanResponse])
def list_fans(
    db: Session = Depends(get_db),
    search: Optional[str] = Query(None, description="Search manufacturer or model"),
    manufacturer: Optional[str] = Query(None),
    model: Optional[str] = Query(None),
):
    q = db.query(Fan)
    if search:
        s = f"%{search}%"
        q = q.filter((Fan.manufacturer.ilike(s)) | (Fan.model.ilike(s)))
    if manufacturer:
        q = q.filter(Fan.manufacturer.ilike(f"%{manufacturer}%"))
    if model:
        q = q.filter(Fan.model.ilike(f"%{model}%"))
    return q.all()


@app.post("/api/fans", response_model=FanResponse)
def create_fan(body: FanCreate, db: Session = Depends(get_db)):
    fan = Fan(**body.model_dump())
    db.add(fan)
    db.commit()
    db.refresh(fan)
    return fan


@app.get("/api/fans/{fan_id}", response_model=FanResponse)
def get_fan(fan_id: int, db: Session = Depends(get_db)):
    fan = db.get(Fan, fan_id)
    if not fan:
        raise HTTPException(404, "Fan not found")
    return fan


@app.put("/api/fans/{fan_id}", response_model=FanResponse)
def update_fan(fan_id: int, body: FanUpdate, db: Session = Depends(get_db)):
    fan = db.get(Fan, fan_id)
    if not fan:
        raise HTTPException(404, "Fan not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(fan, k, v)
    db.commit()
    db.refresh(fan)
    return fan


@app.patch("/api/fans/{fan_id}", response_model=FanResponse)
def patch_fan(fan_id: int, body: FanUpdate, db: Session = Depends(get_db)):
    return update_fan(fan_id, body, db)


@app.delete("/api/fans/{fan_id}")
def delete_fan(fan_id: int, db: Session = Depends(get_db)):
    fan = db.get(Fan, fan_id)
    if not fan:
        raise HTTPException(404, "Fan not found")
    db.delete(fan)
    db.commit()
    return {"deleted": fan_id}


# --- Map points ---
@app.get("/api/fans/{fan_id}/map-points", response_model=list[MapPointResponse])
def get_map_points(fan_id: int, db: Session = Depends(get_db)):
    if not db.get(Fan, fan_id):
        raise HTTPException(404, "Fan not found")
    return db.query(MapPoint).filter(MapPoint.fan_id == fan_id).order_by(MapPoint.rpm, MapPoint.flow).all()


@app.post("/api/fans/{fan_id}/map-points", response_model=MapPointResponse)
def create_map_point(fan_id: int, body: MapPointCreate, db: Session = Depends(get_db)):
    if not db.get(Fan, fan_id):
        raise HTTPException(404, "Fan not found")
    pt = MapPoint(fan_id=fan_id, **body.model_dump())
    db.add(pt)
    db.commit()
    db.refresh(pt)
    return pt


@app.post("/api/fans/{fan_id}/map-points/bulk", response_model=list[MapPointResponse])
def create_map_points_bulk(fan_id: int, body: MapPointBulk, db: Session = Depends(get_db)):
    if not db.get(Fan, fan_id):
        raise HTTPException(404, "Fan not found")
    created = []
    for p in body.points:
        pt = MapPoint(fan_id=fan_id, **p.model_dump())
        db.add(pt)
        created.append(pt)
    db.commit()
    for pt in created:
        db.refresh(pt)
    return created


@app.put("/api/fans/{fan_id}/map-points/{point_id}", response_model=MapPointResponse)
def update_map_point(fan_id: int, point_id: int, body: MapPointCreate, db: Session = Depends(get_db)):
    if not db.get(Fan, fan_id):
        raise HTTPException(404, "Fan not found")
    pt = db.get(MapPoint, point_id)
    if not pt or pt.fan_id != fan_id:
        raise HTTPException(404, "Map point not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(pt, k, v)
    db.commit()
    db.refresh(pt)
    return pt


@app.delete("/api/fans/{fan_id}/map-points/{point_id}")
def delete_map_point(fan_id: int, point_id: int, db: Session = Depends(get_db)):
    if not db.get(Fan, fan_id):
        raise HTTPException(404, "Fan not found")
    pt = db.get(MapPoint, point_id)
    if not pt or pt.fan_id != fan_id:
        raise HTTPException(404, "Map point not found")
    db.delete(pt)
    db.commit()
    return {"deleted": point_id}


# --- CSV parse helpers (also exposed for frontend to send parsed JSON; frontend can parse CSV and POST bulk) ---
def _parse_map_csv(text: str) -> list[dict]:
    """
    Expected CSV format: rpm, flow, pressure [, efficiency]
    Header row optional. Comments (#) and empty lines ignored.
    """
    rows = []
    reader = csv.reader(io.StringIO(text.strip()))
    for row in reader:
        row = [c.strip() for c in row if c]
        if not row or (len(row) == 1 and row[0].startswith("#")):
            continue
        if row[0].lower() in ("rpm", "flow", "pressure", "efficiency") and len(rows) == 0:
            continue
        try:
            rpm = float(row[0])
            flow = float(row[1])
            pressure = float(row[2])
            efficiency = float(row[3]) if len(row) > 3 and row[3] else None
            rows.append({"rpm": rpm, "flow": flow, "pressure": pressure, "efficiency": efficiency})
        except (ValueError, IndexError):
            continue
    return rows


@app.post("/api/fans/{fan_id}/map-points/import-csv", response_model=list[MapPointResponse])
def import_map_csv(fan_id: int, body: dict, db: Session = Depends(get_db)):
    """Parse CSV from body.csv and bulk insert. CSV format: rpm, flow, pressure [, efficiency]"""
    if not db.get(Fan, fan_id):
        raise HTTPException(404, "Fan not found")
    csv_text = body.get("csv", "")
    rows = _parse_map_csv(csv_text)
    if not rows:
        return []
    created = []
    for r in rows:
        pt = MapPoint(fan_id=fan_id, **r)
        db.add(pt)
        created.append(pt)
    db.commit()
    for pt in created:
        db.refresh(pt)
    return created
