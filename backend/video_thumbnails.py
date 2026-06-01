"""Video thumbnail generation helper.

Uses imageio-ffmpeg's bundled ffmpeg binary (no system install required) to
extract a single frame from the start of an uploaded video file. The frame is
returned as JPEG bytes so the caller can stuff it into object storage and
reference it via a `thumbnailUrl` on the highlight document.

Why this exists:
  - HighlightReel.tsx previously set `posterSource={{ uri: item.url }}` on its
    <Video> tag, meaning the "thumbnail" was the video URL itself — empty until
    the whole file loaded, which is what the user reported as "thumbnails not
    visible" in PDF RR_7-9 (#5).
  - With a real per-clip thumbnail URL, the reel renders instantly and only
    decodes full video bytes when the user taps in to the full-screen viewer.
"""
from __future__ import annotations

import logging
import os
import subprocess
import tempfile
from typing import Optional

logger = logging.getLogger(__name__)


def _ffmpeg_path() -> Optional[str]:
    """Resolve the path to the ffmpeg binary bundled with imageio-ffmpeg.

    Returns None if the binary can't be located so callers can degrade
    gracefully (i.e., skip thumbnail generation instead of failing the upload).
    """
    try:
        import imageio_ffmpeg  # type: ignore
        exe = imageio_ffmpeg.get_ffmpeg_exe()
        if exe and os.path.exists(exe):
            return exe
    except Exception as e:
        logger.warning("imageio-ffmpeg not available: %s", e)
    return None


def extract_video_thumbnail(video_bytes: bytes, *, at_seconds: float = 1.0, max_width: int = 720) -> Optional[bytes]:
    """Extract a single JPEG frame from a video.

    Args:
        video_bytes: Raw bytes of the uploaded video (mp4/mov/webm/...).
        at_seconds: Timestamp to grab the frame from. 1s is usually past the
            opening fade and produces a more representative thumbnail than 0s.
        max_width: Downscale longest edge to this width to keep the thumbnail
            small (highlights are shown in a horizontal reel, no need for 4K).

    Returns:
        JPEG bytes on success, or None if ffmpeg isn't available or extraction
        failed (e.g., corrupt file). Callers MUST handle the None case — never
        treat thumbnail generation as a hard requirement.
    """
    ffmpeg = _ffmpeg_path()
    if not ffmpeg:
        return None

    # Write input to a temp file (ffmpeg needs a seekable input for accurate -ss)
    with tempfile.NamedTemporaryFile(suffix=".bin", delete=False) as in_f:
        in_f.write(video_bytes)
        in_path = in_f.name

    out_path = in_path + ".jpg"
    try:
        # -ss before -i = fast seek (less accurate but ~100x faster on big files,
        # which is what we want for an upload-time hook). -frames:v 1 grabs one
        # frame. -vf scale uses -1 to preserve aspect ratio.
        cmd = [
            ffmpeg, "-y",
            "-ss", str(max(at_seconds, 0)),
            "-i", in_path,
            "-frames:v", "1",
            "-vf", f"scale='min({max_width},iw)':-1",
            "-q:v", "5",  # quality 1-31, lower is better. 5 ≈ 75% JPEG quality
            out_path,
        ]
        proc = subprocess.run(cmd, capture_output=True, timeout=15)
        if proc.returncode != 0:
            logger.warning("ffmpeg thumbnail extraction failed: %s", proc.stderr[:500])
            return None
        if not os.path.exists(out_path):
            return None
        with open(out_path, "rb") as f:
            return f.read()
    except subprocess.TimeoutExpired:
        logger.warning("ffmpeg thumbnail extraction timed out")
        return None
    except Exception as e:
        logger.warning("Thumbnail extraction error: %s", e)
        return None
    finally:
        for p in (in_path, out_path):
            try:
                os.remove(p)
            except OSError:
                pass
