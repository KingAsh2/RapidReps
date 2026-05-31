"""Tests for color_extractor.extract_dominant_color.

Goal: prove the extractor returns a vibrant hue when one exists, falls back gracefully
on garbage input, and is fast enough not to slow down profile saves.
"""
import io
import sys
import time
from pathlib import Path

import pytest
from PIL import Image, ImageDraw

# Allow `from color_extractor import ...` when running pytest from /app
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from color_extractor import (  # noqa: E402
    extract_dominant_color,
    extract_from_data_uri_or_url,
    DEFAULT_ACCENT,
)


def _solid_color_png(rgb: tuple, size: tuple = (60, 60)) -> bytes:
    img = Image.new("RGB", size, rgb)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _two_color_png(major_rgb: tuple, minor_rgb: tuple) -> bytes:
    """80% major color, 20% minor — tests that we pick majority correctly."""
    img = Image.new("RGB", (100, 100), major_rgb)
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, 19, 100], fill=minor_rgb)  # 20% strip on the left
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _white_bg_with_vibrant_subject(subject_rgb: tuple) -> bytes:
    """White background with a small saturated subject in the center — typical
    profile photo. We should pick the SUBJECT color, not the white background,
    because near-white pixels are rejected."""
    img = Image.new("RGB", (100, 100), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.rectangle([30, 30, 70, 70], fill=subject_rgb)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


class TestSolidColors:
    def test_pure_red(self):
        c = extract_dominant_color(_solid_color_png((255, 0, 0)))
        assert c.startswith("#")
        # Red should land in the red family — high R, low G/B
        r = int(c[1:3], 16)
        g = int(c[3:5], 16)
        b = int(c[5:7], 16)
        assert r > 200 and g < 50 and b < 50, f"Expected red, got {c}"

    def test_pure_orange(self):
        c = extract_dominant_color(_solid_color_png((255, 106, 0)))
        r = int(c[1:3], 16)
        g = int(c[3:5], 16)
        b = int(c[5:7], 16)
        assert r > 200 and 50 < g < 180 and b < 80, f"Expected orange, got {c}"

    def test_pure_blue(self):
        c = extract_dominant_color(_solid_color_png((30, 100, 240)))
        r = int(c[1:3], 16)
        b = int(c[5:7], 16)
        assert b > 150 and r < 100, f"Expected blue, got {c}"


class TestRejectExtremes:
    def test_white_bg_vibrant_subject_picks_subject(self):
        """80% of the pixels are pure white; ~16% are vivid red.
        Because near-white pixels are rejected, we should still pick red."""
        c = extract_dominant_color(_white_bg_with_vibrant_subject((220, 30, 30)))
        r = int(c[1:3], 16)
        g = int(c[3:5], 16)
        b = int(c[5:7], 16)
        assert r > 150 and g < 100 and b < 100, f"Should pick red subject over white bg, got {c}"

    def test_pure_white_image_falls_back(self):
        """An entirely white image has no valid candidate after extreme-rejection.
        The fallback path picks the single most-frequent (white) color rather than crashing."""
        c = extract_dominant_color(_solid_color_png((255, 255, 255)))
        assert c.startswith("#")  # never raises, always returns a valid hex

    def test_pure_black_image_falls_back(self):
        c = extract_dominant_color(_solid_color_png((0, 0, 0)))
        assert c.startswith("#")


class TestErrorPaths:
    def test_garbage_bytes_returns_default(self):
        c = extract_dominant_color(b"not an image at all")
        assert c == DEFAULT_ACCENT

    def test_empty_bytes_returns_default(self):
        c = extract_dominant_color(b"")
        assert c == DEFAULT_ACCENT


class TestDataUriHelper:
    def test_data_uri_round_trip(self):
        import base64
        png = _solid_color_png((0, 200, 100))
        data_uri = "data:image/png;base64," + base64.b64encode(png).decode("ascii")
        c = extract_from_data_uri_or_url(data_uri)
        assert c and c.startswith("#")
        # Should be greenish
        g = int(c[3:5], 16)
        assert g > 100

    def test_external_url_returns_none(self):
        # We never fetch external URLs synchronously — caller must resolve to bytes
        assert extract_from_data_uri_or_url("https://example.com/foo.jpg") is None

    def test_empty_returns_none(self):
        assert extract_from_data_uri_or_url("") is None
        assert extract_from_data_uri_or_url(None) is None  # type: ignore


class TestPerformance:
    def test_extraction_under_100ms(self):
        """A 60x60 PNG must extract in under 100ms so it doesn't block profile-save endpoints."""
        png = _two_color_png((230, 50, 50), (50, 230, 50))
        t0 = time.time()
        for _ in range(5):
            extract_dominant_color(png)
        avg_ms = ((time.time() - t0) / 5) * 1000
        assert avg_ms < 100, f"Color extraction too slow: {avg_ms:.1f}ms avg"
