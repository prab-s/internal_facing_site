from pathlib import Path

from fastapi.templating import Jinja2Templates

from app.api_client import api
from app.config import settings
from app.slug import product_url, series_url, product_type_url, products_url

APP_DIR = Path(__file__).resolve().parent
TEMPLATE_DIR = APP_DIR / "templates"


def format_numeric_value(value):
    if value is None or value == "":
        return ""
    try:
        numeric_value = float(value)
    except (TypeError, ValueError):
        return value
    return f"{numeric_value:g}"


templates = Jinja2Templates(directory=str(TEMPLATE_DIR))
templates.env.globals["product_url"] = product_url
templates.env.globals["series_url"] = series_url
templates.env.globals["product_type_url"] = product_type_url
templates.env.globals["products_url"] = products_url
templates.env.globals["media_url"] = api.media_url
templates.env.globals["site_name"] = settings.site_name
templates.env.globals["app_build_marker"] = settings.app_build_marker
templates.env.globals["finder_debug"] = settings.finder_debug
templates.env.globals["backend_api_base_url"] = settings.backend_api_base_url
templates.env.globals["site_contact"] = {
    "address": "576c Fergusson Drive, Upper Hutt 5018, Wellington",
    "gerald_email": "gerald@venttech.co.nz",
    "mahendra_email": "mahendra@venttech.co.nz",
    "admin_email": "admin@venttech.co.nz",
    "gerald_phone": "0220 697 270",
    "mahendra_phone": "0275 560 197",
    "admin_phone": "0459 51403",
    "request_quote_url": "mailto:admin@venttech.co.nz?subject=Vent-Tech%20quote%20request",
}
templates.env.filters["format_numeric_value"] = format_numeric_value
