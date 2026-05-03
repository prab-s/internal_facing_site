import json
import logging
from urllib.parse import urlparse
import httpx
from app.config import settings


logger = logging.getLogger(__name__)


class ApiClientError(Exception):
    def __init__(self, status_code, message):
        self.status_code = status_code
        self.message = message
        super().__init__(message)


class CatalogueApi:
    def __init__(self):
        self.base_url = settings.backend_api_base_url
        self.timeout = settings.request_timeout_seconds
        self.cms_api_token = settings.cms_api_token

    async def _get(self, path, params=None):
        url = f"{self.base_url}{path}"
        headers = {}

        if self.cms_api_token:
            headers["Authorization"] = f"Bearer {self.cms_api_token}"

        logger.debug("catalogue api request url=%s params=%s", url, params or {})

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(url, params=params, headers=headers)
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                detail = exc.response.text.strip() or f"Catalogue API request failed with status {exc.response.status_code}."
                raise ApiClientError(exc.response.status_code, detail) from exc
            except httpx.HTTPError as exc:
                raise ApiClientError(502, "Catalogue API is unavailable right now.") from exc

            logger.debug("catalogue api response url=%s status=%s bytes=%s", url, response.status_code, len(response.content))
            return response.json()

    async def product_types(self):
        return await self._get("/api/cms/product-types")

    async def products(self, **filters):
        params = {k: v for k, v in filters.items() if v not in (None, "")}

        if isinstance(params.get("parameter_filters"), dict):
            params["parameter_filters"] = json.dumps(params["parameter_filters"])

        return await self._get("/api/cms/products", params=params)

    async def product_graph_values(self, **filters):
        params = {k: v for k, v in filters.items() if v not in (None, "")}

        if isinstance(params.get("parameter_filters"), dict):
            params["parameter_filters"] = json.dumps(params["parameter_filters"])

        return await self._get("/api/cms/product-graph-values", params=params)

    async def product(self, product_id):
        return await self._get(f"/api/cms/products/{product_id}")

    async def series_list(self, product_type_key=None):
        params = {"product_type_key": product_type_key} if product_type_key else None
        return await self._get("/api/cms/series", params=params)

    async def series(self, series_id):
        return await self._get(f"/api/cms/series/{series_id}")

    async def catalogue_index(self):
        return await self._get("/api/cms/catalogue-index")

    def media_url(self, relative_url):
        if not relative_url:
            return None

        if relative_url.startswith("http://") or relative_url.startswith("https://"):
            parsed = urlparse(relative_url)
            backend_base = urlparse(self.base_url)
            if (
                parsed.scheme == backend_base.scheme
                and parsed.netloc == backend_base.netloc
            ):
                relative_url = parsed.path
                if parsed.query:
                    relative_url = f"{relative_url}?{parsed.query}"
            else:
                return relative_url

        if not relative_url.startswith("/"):
            return f"/{relative_url}"

        return relative_url


api = CatalogueApi()
