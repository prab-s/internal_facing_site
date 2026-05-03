import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()


def _env_flag(name: str, default: str = "false") -> bool:
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "on"}


def _normalize_backend_api_base_url(value: str) -> str:
    normalized = (value or "").strip().rstrip("/")
    if normalized.endswith("/api"):
        normalized = normalized[:-4]
    return normalized or "https://p2.bitrep.nz"


class Settings:
    backend_api_base_url = _normalize_backend_api_base_url(os.getenv("BACKEND_API_BASE_URL", "https://p2.bitrep.nz"))
    public_site_url = os.getenv("PUBLIC_SITE_URL", "http://0.0.0.0:8004").rstrip("/")
    site_name = os.getenv("SITE_NAME", "Vent-tech catalogue")
    app_build_marker = os.getenv("APP_BUILD_MARKER", "customer-facing-2026-05-03")
    log_level = os.getenv("LOG_LEVEL", "INFO").strip().upper() or "INFO"
    finder_debug = _env_flag("FINDER_DEBUG")
    request_timeout_seconds = float(os.getenv("REQUEST_TIMEOUT_SECONDS", "10"))
    catalogue_startup_retry_delay_seconds = float(os.getenv("CATALOGUE_STARTUP_RETRY_DELAY_SECONDS", "2"))
    catalogue_startup_max_wait_seconds = float(os.getenv("CATALOGUE_STARTUP_MAX_WAIT_SECONDS", "30"))
    cms_api_token = os.getenv("CMS_API_TOKEN", "").strip()
    catalogue_cache_path = Path(os.getenv("CATALOGUE_CACHE_PATH", "/tmp/vent-tech-catalogue-cache.json")).expanduser()
    catalogue_refresh_interval_seconds = float(os.getenv("CATALOGUE_REFRESH_INTERVAL_SECONDS", "300"))


settings = Settings()
