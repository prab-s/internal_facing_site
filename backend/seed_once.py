"""
One-off seed: creates a couple of example products with graph data.
Run from project root: python -m backend.seed_once
"""
import os
import sys

# Add project root so "backend" is importable.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal, init_db
from backend.models import Product, ProductType, RpmLine, RpmPoint, EfficiencyPoint


def create_rpm_line_with_points(db, product, rpm, band_color, points):
    line = RpmLine(product_id=product.id, rpm=rpm, band_color=band_color)
    db.add(line)
    db.flush()
    for airflow, pressure in points:
        db.add(
            RpmPoint(
                product_id=product.id,
                rpm_line_id=line.id,
                airflow=airflow,
                pressure=pressure,
            )
        )


def main():
    init_db()
    db = SessionLocal()
    try:
        if db.query(Product).first():
            print("Products already exist. Skip seed.")
            return

        fan_type = db.query(ProductType).filter(ProductType.key == "fan").first()
        if fan_type is None:
            raise RuntimeError("Expected the seeded 'fan' product type to exist.")

        product_1 = Product(model="Fan-1", product_type=fan_type)
        product_2 = Product(model="100 Series", product_type=fan_type)
        db.add_all([product_1, product_2])
        db.commit()
        db.refresh(product_1)
        db.refresh(product_2)

        create_rpm_line_with_points(
            db,
            product_1,
            1000,
            "#0066e3",
            [(0.2, 120), (0.5, 110), (1.0, 80)],
        )
        create_rpm_line_with_points(
            db,
            product_1,
            1500,
            "#009760",
            [(0.3, 200), (0.6, 185), (1.2, 140)],
        )
        create_rpm_line_with_points(
            db,
            product_1,
            2000,
            "#e69100",
            [(0.4, 280), (0.7, 260), (1.3, 200)],
        )

        create_rpm_line_with_points(
            db,
            product_2,
            1200,
            "#0066e3",
            [(0.2, 96), (0.5, 88), (1.0, 64)],
        )
        create_rpm_line_with_points(
            db,
            product_2,
            1800,
            "#009760",
            [(0.3, 160), (0.6, 148), (1.2, 112)],
        )
        create_rpm_line_with_points(
            db,
            product_2,
            2400,
            "#e69100",
            [(0.4, 224), (0.7, 208), (1.3, 160)],
        )

        for airflow, centre, permissible in [
            (0.2, 42, None),
            (0.5, 50, 98),
            (1.0, 52, 72),
            (1.2, 62, 48),
        ]:
            db.add(
                EfficiencyPoint(
                    product_id=product_1.id,
                    airflow=airflow,
                    efficiency_centre=centre,
                    permissible_use=permissible,
                )
            )

        for airflow, centre, permissible in [
            (0.2, 45, None),
            (0.5, 52, 84),
            (1.0, 55, 60),
            (1.2, 65, 40),
        ]:
            db.add(
                EfficiencyPoint(
                    product_id=product_2.id,
                    airflow=airflow,
                    efficiency_centre=centre,
                    permissible_use=permissible,
                )
            )

        db.commit()
        print("Seed done.")
        print(f"Product 1: {product_1.model} (id={product_1.id})")
        print(f"Product 2: {product_2.model} (id={product_2.id})")
    finally:
        db.close()


if __name__ == "__main__":
    main()
