"""
iter106p — Google Directions API helper.

Used by the live GPS broadcast to enrich each `position` frame with:
  • `routePolyline` — encoded polyline that follows actual roads
  • `etaSeconds`    — duration_in_traffic (or duration if traffic data is missing)
  • `distanceMeters`

A 30-second in-memory TTL cache keyed by (lat_rounded, lng_rounded, dest_lat,
dest_lng) keeps Directions API spend sane even with 5-second gps-update
intervals — coordinates are rounded to ~30 m precision (3 decimals) before
hashing, so small jitter doesn't bust the cache.

Graceful degradation: if the API key is missing or the call fails for any
reason, we return None and the broadcast falls back to the existing
straight-line polyline that the frontend already draws.
"""
from __future__ import annotations
import asyncio
import logging
import math
import os
import time
from typing import Optional, Tuple

import httpx

logger = logging.getLogger(__name__)

_DIRECTIONS_URL = "https://maps.googleapis.com/maps/api/directions/json"
_TTL_SECONDS = 30.0  # cache lifetime per route
_CACHE: dict[Tuple, Tuple[float, dict]] = {}
_CACHE_LOCK = asyncio.Lock()


def _round(v: float, digits: int = 3) -> float:
    """Round coords for cache-key stability (3 decimals ≈ 110 m)."""
    return round(v, digits)


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6_371_000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


async def get_route(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
    mode: str = "driving",
) -> Optional[dict]:
    """Fetch a route from Google Directions.

    Returns: {polyline: str, etaSeconds: int, distanceMeters: int} or None
    on any failure (key missing, network error, ZERO_RESULTS, etc.).
    """
    key = os.environ.get("GOOGLE_MAPS_API_KEY")
    if not key:
        return None

    # Skip the API call entirely if origin and destination are very close —
    # ETA is "you're basically there" and a polyline would be a tiny squiggle.
    if _haversine_m(origin_lat, origin_lng, dest_lat, dest_lng) < 30:
        return {"polyline": "", "etaSeconds": 0, "distanceMeters": 0, "near": True}

    cache_key = (
        _round(origin_lat), _round(origin_lng),
        _round(dest_lat), _round(dest_lng),
        mode,
    )
    now = time.monotonic()
    async with _CACHE_LOCK:
        hit = _CACHE.get(cache_key)
        if hit and now - hit[0] < _TTL_SECONDS:
            return hit[1]

    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            r = await client.get(_DIRECTIONS_URL, params={
                "origin": f"{origin_lat},{origin_lng}",
                "destination": f"{dest_lat},{dest_lng}",
                "mode": mode,
                "departure_time": "now",  # unlocks traffic-aware duration on driving
                "key": key,
            })
        if r.status_code != 200:
            return None
        data = r.json()
        if data.get("status") != "OK":
            logger.info("Directions API non-OK: %s", data.get("status"))
            return None
        route = data["routes"][0]
        leg = route["legs"][0]
        eta = leg.get("duration_in_traffic", leg["duration"])["value"]
        result = {
            "polyline": route["overview_polyline"]["points"],
            "etaSeconds": int(eta),
            "distanceMeters": int(leg["distance"]["value"]),
        }
    except Exception as e:
        logger.info("Directions API failed: %s", e)
        return None

    async with _CACHE_LOCK:
        _CACHE[cache_key] = (now, result)
        # Light cache cap — keep last 500 routes
        if len(_CACHE) > 500:
            oldest = sorted(_CACHE.items(), key=lambda kv: kv[1][0])[:100]
            for k, _ in oldest:
                _CACHE.pop(k, None)
    return result
