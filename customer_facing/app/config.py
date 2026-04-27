import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    backend_api_base_url = os.getenv("BACKEND_API_BASE_URL", "https://p2.bitrep.nz").rstrip("/")
    public_site_url = os.getenv("PUBLIC_SITE_URL", "http://0.0.0.0:8004").rstrip("/")
    site_name = os.getenv("SITE_NAME", "Vent-tech catalogue")
    request_timeout_seconds = float(os.getenv("REQUEST_TIMEOUT_SECONDS", "10"))
    cms_api_token = os.getenv("CMS_API_TOKEN", "").strip()


settings = Settings()
