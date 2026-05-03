import asyncio
import json
import logging
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from app.api_client import ApiClientError, api
from app.catalogue_data import (
    ParameterFilterError,
    build_finder_metadata,
    build_series_summary_from_products,
    filter_products,
    parse_parameter_filters,
)
from app.config import settings

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class CatalogueSnapshot:
    product_types: list[dict] = field(default_factory=list)
    series: list[dict] = field(default_factory=list)
    products: list[dict] = field(default_factory=list)
    fetched_at: str | None = None


class CatalogueCache:
    def __init__(self):
        self.cache_path = settings.catalogue_cache_path
        self.refresh_interval_seconds = settings.catalogue_refresh_interval_seconds
        self._snapshot = CatalogueSnapshot()
        self._refresh_task: asyncio.Task | None = None
        self._lock = asyncio.Lock()

    async def initialize(self):
        self._load_from_disk()
        try:
            await self._refresh_with_startup_retry()
        except Exception:
            logger.warning("Using the last known catalogue snapshot after refresh failure.")
        self._start_background_refresh()

    async def _refresh_with_startup_retry(self):
        deadline = time.monotonic() + settings.catalogue_startup_max_wait_seconds
        attempt = 1

        while True:
            try:
                logger.debug(
                    "catalogue cache startup refresh attempt %d against backend %s",
                    attempt,
                    settings.backend_api_base_url,
                )
                await self.refresh()
                return
            except Exception as exc:
                if time.monotonic() >= deadline:
                    raise

                logger.warning(
                    "Catalogue cache startup refresh attempt %d failed: %s; retrying in %.1fs",
                    attempt,
                    exc,
                    settings.catalogue_startup_retry_delay_seconds,
                )
                await asyncio.sleep(settings.catalogue_startup_retry_delay_seconds)
                attempt += 1

    def _load_from_disk(self):
        if not self.cache_path or not self.cache_path.is_file():
            return

        try:
            payload = json.loads(self.cache_path.read_text(encoding="utf-8"))
        except OSError as exc:
            logger.warning("Unable to read catalogue cache from %s: %s", self.cache_path, exc)
            return
        except json.JSONDecodeError as exc:
            logger.warning("Ignoring invalid catalogue cache file %s: %s", self.cache_path, exc)
            return

        self._snapshot = CatalogueSnapshot(
            product_types=list(payload.get("product_types") or []),
            series=list(payload.get("series") or []),
            products=list(payload.get("products") or []),
            fetched_at=payload.get("fetched_at"),
        )

    def _write_to_disk(self):
        if not self.cache_path:
            return

        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        payload = json.dumps(asdict(self._snapshot), indent=2, sort_keys=True)
        tmp_path = self.cache_path.with_suffix(self.cache_path.suffix + ".tmp")
        tmp_path.write_text(payload + "\n", encoding="utf-8")
        tmp_path.replace(self.cache_path)

    async def refresh(self):
        start = time.perf_counter()
        logger.debug("catalogue cache refresh starting against backend %s", settings.backend_api_base_url)
        try:
            payload = await api.catalogue_index()
        except (ApiClientError, Exception) as exc:
            logger.warning("Catalogue cache refresh failed: %s", exc)
            raise

        if not isinstance(payload, dict):
            raise ApiClientError(502, "Catalogue index payload was invalid.")

        snapshot = CatalogueSnapshot(
            product_types=list(payload.get("product_types") or []),
            series=list(payload.get("series") or []),
            products=list(payload.get("products") or []),
            fetched_at=datetime.now(timezone.utc).isoformat(),
        )

        async with self._lock:
            self._snapshot = snapshot
            try:
                self._write_to_disk()
            except OSError as exc:
                logger.warning("Unable to write catalogue cache to %s: %s", self.cache_path, exc)
        logger.info(
            "Catalogue cache refreshed in %.1fms (%d product types, %d series, %d products)",
            (time.perf_counter() - start) * 1000.0,
            len(snapshot.product_types),
            len(snapshot.series),
            len(snapshot.products),
        )

    async def refresh_best_effort(self):
        try:
            await self.refresh()
        except Exception:
            return

    def _start_background_refresh(self):
        if self._refresh_task and not self._refresh_task.done():
            return
        self._refresh_task = asyncio.create_task(self._refresh_loop())

    async def shutdown(self):
        if self._refresh_task is None:
            return
        self._refresh_task.cancel()
        try:
            await self._refresh_task
        except asyncio.CancelledError:
            pass
        finally:
            self._refresh_task = None

    async def _refresh_loop(self):
        try:
            while True:
                await asyncio.sleep(self.refresh_interval_seconds)
                try:
                    await self.refresh()
                except Exception:
                    continue
        except asyncio.CancelledError:
            pass

    def snapshot(self) -> CatalogueSnapshot:
        return self._snapshot

    def product_types(self) -> list[dict]:
        start = time.perf_counter()
        result = [dict(item) for item in self._snapshot.product_types]
        logger.debug("catalogue cache product_types lookup returned %d items in %.2fms", len(result), (time.perf_counter() - start) * 1000.0)
        return result

    def product_type(self, product_type_key: str) -> dict | None:
        start = time.perf_counter()
        normalized_key = str(product_type_key or "").strip()
        if not normalized_key:
            logger.debug("catalogue cache product_type lookup skipped because no key was provided")
            return None
        for item in self._snapshot.product_types:
            if str(item.get("key") or "").strip() == normalized_key:
                logger.debug("catalogue cache product_type lookup for %s took %.2fms", normalized_key, (time.perf_counter() - start) * 1000.0)
                return dict(item)
        logger.debug("catalogue cache product_type lookup for %s missed in %.2fms", normalized_key, (time.perf_counter() - start) * 1000.0)
        return None

    def series_list(self, product_type_key: str | None = None) -> list[dict]:
        start = time.perf_counter()
        series = self._snapshot.series
        if product_type_key:
            normalized_key = str(product_type_key or "").strip()
            series = [item for item in series if str(item.get("product_type_key") or "").strip() == normalized_key]
        result = sorted((dict(item) for item in series), key=lambda item: str(item.get("name") or "").casefold())
        logger.debug(
            "catalogue cache series_list lookup for %s returned %d items in %.2fms",
            product_type_key or "*",
            len(result),
            (time.perf_counter() - start) * 1000.0,
        )
        return result

    def products(
        self,
        *,
        product_type_key: str = "",
        search: str = "",
        series_id: str | int | None = None,
        parameter_filters: str = "",
    ) -> list[dict]:
        start = time.perf_counter()
        try:
            parsed_filters = parse_parameter_filters(parameter_filters)
        except ParameterFilterError:
            raise

        result = filter_products(
            [dict(item) for item in self._snapshot.products],
            product_type_key=product_type_key,
            search=search,
            series_id=series_id,
            parameter_filters=parsed_filters,
        )
        logger.debug(
            "catalogue cache products lookup type=%s series=%s search=%s returned %d items in %.2fms",
            product_type_key or "*",
            series_id or "*",
            search or "*",
            len(result),
            (time.perf_counter() - start) * 1000.0,
        )
        return result

    def products_for_type(self, product_type_key: str) -> list[dict]:
        return self.products(product_type_key=product_type_key)

    def finder_metadata(
        self,
        *,
        product_type_key: str = "",
        search: str = "",
        series_id: str | int | None = None,
        parameter_filters: str = "",
    ) -> dict:
        start = time.perf_counter()
        selected_type = self.product_type(product_type_key)
        if not selected_type:
            return {"series": [], "groups": []}

        products = self.products(
            product_type_key=product_type_key,
            search=search,
            series_id=series_id,
            parameter_filters=parameter_filters,
        )
        metadata = build_finder_metadata(selected_type, products, product_type_key)
        logger.debug(
            "catalogue cache finder metadata type=%s returned %d series and %d groups in %.2fms",
            product_type_key or "*",
            len(metadata.get("series") or []),
            len(metadata.get("groups") or []),
            (time.perf_counter() - start) * 1000.0,
        )
        logger.debug(
            "finder metadata inputs type=%s search=%s series=%s filters=%s",
            product_type_key or "*",
            search or "*",
            series_id or "*",
            parameter_filters or "[]",
        )
        return metadata

    def finder_results(
        self,
        *,
        product_type_key: str = "",
        search: str = "",
        series_id: str | int | None = None,
        parameter_filters: str = "",
    ) -> dict:
        start = time.perf_counter()
        products = self.products(
            product_type_key=product_type_key,
            search=search,
            series_id=series_id,
            parameter_filters=parameter_filters,
        )
        result = {
            "products": products,
            "series": build_series_summary_from_products(products),
        }
        logger.debug(
            "catalogue cache finder results type=%s returned %d products and %d series in %.2fms",
            product_type_key or "*",
            len(result["products"]),
            len(result["series"]),
            (time.perf_counter() - start) * 1000.0,
        )
        return result


catalogue_cache = CatalogueCache()
