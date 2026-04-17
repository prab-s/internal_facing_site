"""
One-off seed: creates one example fan and imports curve/map points from data/*.csv.
Run from project root: python -m backend.seed_once
"""
import csv
import io
import os
import sys

# Add project root so "backend" is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal, init_db, DATA_DIR
from backend.models import Fan, MapPoint


def parse_map_csv(text: str):
    rows = []
    for row in csv.reader(io.StringIO(text.strip())):
        row = [c.strip() for c in row if c]
        if not row or (len(row) == 1 and row[0].startswith("#")):
            continue
        if row[0].lower() in ("rpm", "airflow", "pressure", "efficiency", "efficiency_centre") and len(rows) == 0:
            continue
        try:
            rpm = float(row[0])
            airflow = float(row[1])
            pressure = float(row[2])
            efficiency_centre = float(row[3]) if len(row) > 3 and row[3] else None
            rows.append({"rpm": rpm, "airflow": airflow, "pressure": pressure, "efficiency_centre": efficiency_centre})
        except (ValueError, IndexError):
            continue
    return rows


def main():
    init_db()
    db = SessionLocal()
    try:
        if db.query(Fan).first():
            print("Fans already exist. Skip seed.")
            return
        
        # Create first fan
        fan1 = Fan(model="Fan-1", notes="Seed data for MVP")
        db.add(fan1)
        db.commit()
        db.refresh(fan1)
        
        # Create second fan
        fan2 = Fan(model="100 series", notes="Additional test fan")
        db.add(fan2)
        db.commit()
        db.refresh(fan2)

        map_path = os.path.join(DATA_DIR, "map_points_example.csv")
        if os.path.isfile(map_path):
            with open(map_path, encoding="utf-8") as f:
                content = f.read()
                # Import for first fan
                for r in parse_map_csv(content):
                    db.add(MapPoint(fan_id=fan1.id, **r))
                # Import for second fan (with slightly modified data)
                for r in parse_map_csv(content):
                    # Modify some values for the second fan to make it different
                    r['rpm'] = r['rpm'] * 1.2  # 20% higher RPM
                    r['pressure'] = r['pressure'] * 0.8  # 20% lower pressure
                    db.add(MapPoint(fan_id=fan2.id, **r))
            print(f"Imported map points from {map_path} for both fans")
        else:
            # Fallback: create some basic test data if CSV doesn't exist
            print("CSV file not found, creating basic test data")
            # For fan 1: multiple points per RPM (bands)
            test_data_1 = [
                {"rpm": 1000, "airflow": 0.2, "pressure": 120, "efficiency_centre": 42},
                {"rpm": 1000, "airflow": 0.5, "pressure": 110, "efficiency_centre": 50},
                {"rpm": 1000, "airflow": 1.0, "pressure": 80, "efficiency_centre": 52},
                {"rpm": 1500, "airflow": 0.3, "pressure": 200, "efficiency_centre": 48},
                {"rpm": 1500, "airflow": 0.6, "pressure": 185, "efficiency_centre": 56},
                {"rpm": 1500, "airflow": 1.2, "pressure": 140, "efficiency_centre": 62},
                {"rpm": 2000, "airflow": 0.4, "pressure": 280, "efficiency_centre": 50},
                {"rpm": 2000, "airflow": 0.7, "pressure": 260, "efficiency_centre": 58},
                {"rpm": 2000, "airflow": 1.3, "pressure": 200, "efficiency_centre": 64},
            ]
            for r in test_data_1:
                db.add(MapPoint(fan_id=fan1.id, **r))
            
            # For fan 2: also multiple points per RPM (bands)
            test_data_2 = [
                {"rpm": 1200, "airflow": 0.2, "pressure": 96, "efficiency_centre": 45},  # 1200 = 1000 * 1.2, pressure = 120 * 0.8
                {"rpm": 1200, "airflow": 0.5, "pressure": 88, "efficiency_centre": 52},
                {"rpm": 1200, "airflow": 1.0, "pressure": 64, "efficiency_centre": 55},
                {"rpm": 1800, "airflow": 0.3, "pressure": 160, "efficiency_centre": 50},  # 1800 = 1500 * 1.2, pressure = 200 * 0.8
                {"rpm": 1800, "airflow": 0.6, "pressure": 148, "efficiency_centre": 58},
                {"rpm": 1800, "airflow": 1.2, "pressure": 112, "efficiency_centre": 65},
                {"rpm": 2400, "airflow": 0.4, "pressure": 224, "efficiency_centre": 52},  # 2400 = 2000 * 1.2, pressure = 280 * 0.8
                {"rpm": 2400, "airflow": 0.7, "pressure": 208, "efficiency_centre": 60},
                {"rpm": 2400, "airflow": 1.3, "pressure": 160, "efficiency_centre": 67},
            ]
            for r in test_data_2:
                db.add(MapPoint(fan_id=fan2.id, **r))

        db.commit()
        print("Seed done.")
        print(f"Fan 1: {fan1.model} (id={fan1.id})")
        print(f"Fan 2: {fan2.model} (id={fan2.id})")
    finally:
        db.close()


if __name__ == "__main__":
    main()
