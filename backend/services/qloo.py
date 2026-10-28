"""Qloo API client with retry logic and request logging."""

import httpx
import asyncio
import json
import logging
from typing import Optional

from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class QlooClient:
    """Async client for the Qloo hackathon API."""

    def __init__(self):
        self.base_url = settings.QLOO_BASE_URL
        self.api_key = settings.QLOO_API_KEY
        self.max_retries = settings.QLOO_MAX_RETRIES
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        key = settings.QLOO_API_KEY
        if self._client is None or self._client.is_closed or self.api_key != key:
            if self._client and not self._client.is_closed:
                await self._client.aclose()
            self.api_key = key
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                headers={"X-Api-Key": self.api_key},
                timeout=30.0,
            )
        return self._client

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    async def _request_with_retry(
        self, method: str, path: str, **kwargs
    ) -> dict:
        """Make an HTTP request with exponential backoff retry."""
        client = await self._get_client()
        last_exc = None

        for attempt in range(1, self.max_retries + 1):
            try:
                logger.info(
                    "Qloo API %s %s (attempt %d/%d) params=%s",
                    method.upper(),
                    path,
                    attempt,
                    self.max_retries,
                    kwargs.get("params"),
                )
                resp = await client.request(method, path, **kwargs)
                resp.raise_for_status()
                data = resp.json()
                logger.debug("Qloo API response: %s", json.dumps(data)[:500])
                return data
            except (httpx.HTTPStatusError, httpx.RequestError) as exc:
                last_exc = exc
                wait = 2 ** (attempt - 1)  # 1, 2, 4 seconds
                logger.warning(
                    "Qloo API request failed (attempt %d/%d): %s — retrying in %ds",
                    attempt,
                    self.max_retries,
                    str(exc),
                    wait,
                )
                if attempt < self.max_retries:
                    await asyncio.sleep(wait)

        logger.error("Qloo API request failed after %d retries", self.max_retries)
        raise last_exc  # type: ignore[misc]

    # ── Public API methods ───────────────────────────────────────────────

    async def search(
        self, query: str, types: str = "urn:entity:place"
    ) -> list:
        """
        GET /search?query=...&types=...
        Search for entities by keyword.
        """
        params = {"query": query, "types": types}
        data = await self._request_with_retry("GET", "/search", params=params)
        return data.get("results", data) if isinstance(data, dict) else data

    async def get_insights(
        self,
        tags: list[str],
        lat: float,
        lon: float,
        radius_km: float = 1.5,
        limit: int = 20,
    ) -> dict:
        """
        GET /v2/insights
        Get place recommendations near a location filtered by taste tags.
        """
        params: list[tuple[str, str]] = [
            ("filter.type", "urn:entity:place"),
            ("signal.location", f"POINT({lon} {lat})"),
            ("signal.location.radius", str(radius_km)),
            ("feature.explainability", "true"),
            ("limit", str(limit)),
        ]
        # Qloo expects comma-separated tags
        if tags:
            params.append(("filter.tags", ",".join(tags)))

        data = await self._request_with_retry("GET", "/v2/insights", params=params)
        return data

    async def get_taste_profile(
        self, lat: float, lon: float, radius_km: float = 1.5
    ) -> dict:
        """
        GET /v2/insights with filter.type=urn:tag
        Get the taste profile (popular tags) for an area.
        """
        params = {
            "filter.type": "urn:tag",
            "signal.location": f"POINT({lon} {lat})",
            "signal.location.radius": str(radius_km),
            "limit": "30",
        }
        data = await self._request_with_retry("GET", "/v2/insights", params=params)
        return data

    async def get_heatmap(
        self,
        tags: list[str],
        lat: float,
        lon: float,
        radius_km: float = 5.0,
    ) -> dict:
        """
        GET /v2/insights with filter.type=urn:heatmap (experimental).
        May not be supported by all API versions.
        """
        params: list[tuple[str, str]] = [
            ("filter.type", "urn:heatmap"),
            ("signal.location", f"POINT({lon} {lat})"),
            ("signal.location.radius", str(radius_km)),
        ]
        for tag in tags:
            params.append(("filter.tags", tag))

        try:
            data = await self._request_with_retry("GET", "/v2/insights", params=params)
            return data
        except Exception as exc:
            logger.warning("Heatmap endpoint not available: %s", exc)
            return {"error": "heatmap not available", "detail": str(exc)}


# Module-level singleton
qloo_client = QlooClient()
