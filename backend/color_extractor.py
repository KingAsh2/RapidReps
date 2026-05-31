"""Dominant color extraction from profile photos.

Strategy: open the image with Pillow → downscale to 50x50 (fast, removes JPEG noise) →
quantize to a small palette → pick the most frequent color, prefer saturated/non-gray hues
so trainer avatars with washed-out backgrounds still yield a vibrant accent.

Returns hex like '#FF6A00'. Falls back to RapidReps orange if anything fails — never raises.
"""
import io
import logging
from typing import Optional

from PIL import Image

LOG = logging.getLogger(__name__)
DEFAULT_ACCENT = "#FF6A00"


def _rgb_to_hex(rgb: tuple) -> str:
    return "#{:02X}{:02X}{:02X}".format(int(rgb[0]), int(rgb[1]), int(rgb[2]))


def _saturation(rgb: tuple) -> float:
    """HSV saturation in [0,1]. Higher = more vibrant."""
    r, g, b = rgb[0] / 255.0, rgb[1] / 255.0, rgb[2] / 255.0
    mx = max(r, g, b)
    mn = min(r, g, b)
    return 0.0 if mx == 0 else (mx - mn) / mx


def _luminance(rgb: tuple) -> float:
    """Perceived brightness in [0,1]. Used to reject near-black and near-white pixels."""
    r, g, b = rgb[0] / 255.0, rgb[1] / 255.0, rgb[2] / 255.0
    return 0.299 * r + 0.587 * g + 0.114 * b


def extract_dominant_color(image_bytes: bytes) -> str:
    """Return hex color string for the most prominent vibrant hue in the image."""
    try:
        img = Image.open(io.BytesIO(image_bytes))
        # Convert palette / RGBA / grayscale to RGB
        if img.mode != "RGB":
            img = img.convert("RGB")
        # Downscale for speed — 50x50 is enough to capture the dominant hue
        img.thumbnail((50, 50))
        # Quantize to 16 distinct colors using PIL's median cut
        quantized = img.quantize(colors=16, method=Image.Quantize.MEDIANCUT)
        palette = quantized.getpalette()  # flat list [r,g,b, r,g,b, ...]
        color_counts = sorted(quantized.getcolors(), reverse=True)  # [(count, palette_idx), ...]

        # Score each candidate: count * saturation * brightness-band
        # We REJECT near-black (lum < 0.1) and near-white (lum > 0.92) so backgrounds don't win.
        best_rgb: Optional[tuple] = None
        best_score = -1.0
        for count, idx in color_counts:
            rgb = (palette[idx * 3], palette[idx * 3 + 1], palette[idx * 3 + 2])
            lum = _luminance(rgb)
            if lum < 0.1 or lum > 0.92:
                continue
            sat = _saturation(rgb)
            # Saturation gets exponential weight — favor vibrant over grey
            score = count * (0.2 + sat ** 1.5)
            if score > best_score:
                best_score = score
                best_rgb = rgb

        if best_rgb is None:
            # Whole image was extremes — fall back to the single most-frequent color
            count, idx = color_counts[0]
            best_rgb = (palette[idx * 3], palette[idx * 3 + 1], palette[idx * 3 + 2])

        return _rgb_to_hex(best_rgb)
    except Exception as exc:
        LOG.info("dominant color extraction failed: %s — using fallback", exc)
        return DEFAULT_ACCENT


def extract_from_data_uri_or_url(value: str) -> Optional[str]:
    """Accept either a `data:image/...;base64,...` string or a relative `/api/files/...` URL
    and return a hex color. Returns None if value is not extractable from the local context
    (e.g. an external URL we don't want to fetch synchronously)."""
    if not value or not isinstance(value, str):
        return None
    if value.startswith("data:"):
        try:
            import base64
            _, _, b64 = value.partition(",")
            return extract_dominant_color(base64.b64decode(b64))
        except Exception:
            return None
    # For /api/files/... URLs, the caller should resolve to bytes via storage.get_object
    # and call extract_dominant_color directly. We don't fetch arbitrary URLs here.
    return None
