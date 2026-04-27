from pathlib import Path

from fastapi.templating import Jinja2Templates

from app.api_client import api
from app.config import settings
from app.slug import product_url, series_url, product_type_url

APP_DIR = Path(__file__).resolve().parent
TEMPLATE_DIR = APP_DIR / "templates"

templates = Jinja2Templates(directory=str(TEMPLATE_DIR))
templates.env.globals["product_url"] = product_url
templates.env.globals["series_url"] = series_url
templates.env.globals["product_type_url"] = product_type_url
templates.env.globals["media_url"] = api.media_url
templates.env.globals["site_name"] = settings.site_name
