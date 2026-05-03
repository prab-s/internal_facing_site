import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()


class Settings:
    backend_api_base_url = os.getenv("BACKEND_API_BASE_URL", "https://p2.bitrep.nz").rstrip("/")
    public_site_url = os.getenv("PUBLIC_SITE_URL", "http://0.0.0.0:8004").rstrip("/")
    site_name = os.getenv("SITE_NAME", "Vent-tech catalogue")
    app_build_marker = os.getenv("APP_BUILD_MARKER", "customer-facing-2026-05-03")
    request_timeout_seconds = float(os.getenv("REQUEST_TIMEOUT_SECONDS", "10"))
    cms_api_token = os.getenv("CMS_API_TOKEN", "").strip()
    catalogue_cache_path = Path(os.getenv("CATALOGUE_CACHE_PATH", "/tmp/vent-tech-catalogue-cache.json")).expanduser()
    catalogue_refresh_interval_seconds = float(os.getenv("CATALOGUE_REFRESH_INTERVAL_SECONDS", "300"))


settings = Settings()
