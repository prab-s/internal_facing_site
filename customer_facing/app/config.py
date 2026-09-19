import os
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()


def _normalize_backend_api_base_url(value: str) -> str:
    normalized = (value or "").strip().rstrip("/")
    if normalized.endswith("/api"):
        normalized = normalized[:-4]
    return normalized or "https://p2.bitrep.nz"


class Settings:
    backend_api_base_url = _normalize_backend_api_base_url(os.getenv("BACKEND_API_BASE_URL", "https://p2.bitrep.nz"))
    public_site_url = os.getenv("PUBLIC_SITE_URL", "http://localhost:8004").rstrip("/")
    site_name = os.getenv("SITE_NAME", "Vent-tech catalogue")
    cms_api_token = os.getenv("CMS_API_TOKEN", "").strip()
    app_build_marker = os.getenv("APP_BUILD_MARKER", "").strip() or datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f")
    finder_debug = os.getenv("FINDER_DEBUG", "").strip().lower() in {"1", "true", "yes", "on"}
    request_timeout_seconds = float(os.getenv("REQUEST_TIMEOUT_SECONDS", "10"))
    # Enquiries can perform two authenticated SMTP submissions before the
    # backend responds (team notification, then customer acknowledgement).
    quote_request_timeout_seconds = float(os.getenv("QUOTE_REQUEST_TIMEOUT_SECONDS", "60"))
    catalogue_cache_path = os.getenv("CATALOGUE_CACHE_PATH", "/tmp/vent-tech-catalogue-cache.json")
    catalogue_refresh_interval_seconds = float(os.getenv("CATALOGUE_REFRESH_INTERVAL_SECONDS", "300"))
    catalogue_startup_max_wait_seconds = float(os.getenv("CATALOGUE_STARTUP_MAX_WAIT_SECONDS", "30"))
    catalogue_startup_retry_delay_seconds = float(os.getenv("CATALOGUE_STARTUP_RETRY_DELAY_SECONDS", "2"))


settings = Settings()
