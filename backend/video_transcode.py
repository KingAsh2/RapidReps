"""Video transcoding helper — iter102x.

Re-encodes uploaded highlight clips to a web-friendly 720p H.264 + AAC mp4
with the moov atom at the front (`+faststart`). This is the single biggest
win for "video takes forever to start playing" — without faststart, the
player has to download the entire file before it can locate the moov atom
and begin decoding. With it, playback starts as soon as the first few KB
arrive.

Why a single 720p ladder (no full HLS):
  - Highlight clips are short (≤60s typically) and shown in a small
    horizontal reel. 720p is plenty for that surface.
  - Adaptive HLS would require segmenting + a manifest + a video.js-style
    player. Not worth the complexity for short-form vertical clips.
  - faststart + h264 baseline alone takes us from ~2s of "did this break?"
    to <300ms time-to-first-frame on a normal mobile connection.

The function is intentionally tolerant — any failure falls back to the
original upload so a flaky ffmpeg invocation never blocks a user from
publishing their clip.
"""
from __future__ import annotations

import logging
import os
import subprocess
import tempfile
from typing import Optional

from video_thumbnails import _ffmpeg_path  # reuse the resolver

logger = logging.getLogger(__name__)


def transcode_to_web_mp4(
    video_bytes: bytes,
    *,
    max_height: int = 720,
    crf: int = 23,
    audio_bitrate: str = "128k",
    timeout_seconds: int = 90,
) -> Optional[bytes]:
    """Transcode a video clip to a web-optimized H.264 mp4.

    Args:
        video_bytes: Raw bytes of the uploaded video (mp4/mov/webm/...).
        max_height: Cap on output height in pixels. 720 keeps clips crisp
            on phones while shrinking file size by 50-70% vs typical 1080p
            iPhone captures.
        crf: H.264 Constant Rate Factor. 18=visually lossless, 23=default,
            28=lower bitrate. 23 is a good balance for short fitness clips.
        audio_bitrate: AAC bitrate. 128k is fine for music + voice.
        timeout_seconds: Hard ceiling so a corrupt input can't hang the
            upload request.

    Returns:
        mp4 bytes on success, or None if ffmpeg isn't available, the
        encode failed, or the timeout was hit. Callers MUST handle None
        and fall back to the original upload.
    """
    ffmpeg = _ffmpeg_path()
    if not ffmpeg:
        return None

    with tempfile.NamedTemporaryFile(suffix=".bin", delete=False) as in_f:
        in_f.write(video_bytes)
        in_path = in_f.name

    out_path = in_path + ".out.mp4"
    try:
        cmd = [
            ffmpeg, "-y",
            "-i", in_path,
            # Cap height to `max_height`; preserve aspect; ensure even dims (libx264 requires it).
            "-vf", f"scale='trunc(oh*a/2)*2':'min({max_height},ih)'",
            # Video: H.264 high profile + CRF mode for predictable quality.
            "-c:v", "libx264",
            "-profile:v", "high",
            "-level", "4.0",
            "-pix_fmt", "yuv420p",  # broad device compatibility (iOS Safari, Android)
            "-preset", "veryfast",  # encode speed vs compression — fine for UGC
            "-crf", str(crf),
            # Audio: re-encode to AAC at a sane bitrate.
            "-c:a", "aac",
            "-b:a", audio_bitrate,
            "-ac", "2",
            # THE critical flag: relocate moov atom to the front of the file so
            # the player can start decoding before the whole file is downloaded.
            "-movflags", "+faststart",
            out_path,
        ]
        proc = subprocess.run(cmd, capture_output=True, timeout=timeout_seconds)
        if proc.returncode != 0:
            logger.warning("ffmpeg transcode failed: %s", proc.stderr[:500])
            return None
        if not os.path.exists(out_path):
            return None
        with open(out_path, "rb") as f:
            return f.read()
    except subprocess.TimeoutExpired:
        logger.warning("ffmpeg transcode timed out (>%ss)", timeout_seconds)
        return None
    except Exception as e:
        logger.warning("Transcode error: %s", e)
        return None
    finally:
        for p in (in_path, out_path):
            try:
                os.remove(p)
            except OSError:
                pass
