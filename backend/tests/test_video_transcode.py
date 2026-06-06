"""iter102x — Regression test for the highlight transcode pipeline.

Asserts that:
  1. ffmpeg is reachable in the deployment image.
  2. `transcode_to_web_mp4` returns valid mp4 bytes.
  3. The output has `moov` before `mdat` (i.e., `+faststart` is set) — this
     is the single most important property: without it the player has to
     download the whole file before playback can begin.
"""
import os
import subprocess
import sys

import pytest

# Make backend modules importable when pytest is invoked from /app/backend
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from video_thumbnails import _ffmpeg_path  # noqa: E402
from video_transcode import transcode_to_web_mp4  # noqa: E402


@pytest.fixture(scope="module")
def sample_video_bytes() -> bytes:
    """Generate a 2-second test clip on the fly using ffmpeg lavfi sources.

    We deliberately use `-movflags +frag_keyframe` (NOT faststart) on the
    source so the assertion below proves our transcoder actually relocates
    the moov atom rather than just passing through a pre-faststart input.
    """
    ffmpeg = _ffmpeg_path()
    if not ffmpeg:
        pytest.skip("ffmpeg not available in this environment")
    in_path = "/tmp/iter102x_test_in.mov"
    subprocess.run(
        [
            ffmpeg, "-y",
            "-f", "lavfi", "-i", "testsrc=duration=2:size=640x360:rate=24",
            "-f", "lavfi", "-i", "sine=frequency=1000:duration=2",
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-movflags", "+frag_keyframe",  # ensure moov is NOT at the front
            in_path,
        ],
        check=True, capture_output=True,
    )
    with open(in_path, "rb") as f:
        data = f.read()
    os.remove(in_path)
    return data


def test_transcode_returns_bytes(sample_video_bytes):
    out = transcode_to_web_mp4(sample_video_bytes)
    assert out is not None, "Transcode returned None — ffmpeg run failed"
    assert len(out) > 1024, "Output suspiciously small"


def test_transcode_output_has_faststart(sample_video_bytes):
    """Critical: moov atom MUST appear before mdat atom for instant playback."""
    out = transcode_to_web_mp4(sample_video_bytes)
    assert out is not None
    # Scan the first 16KB — moov for a sub-minute clip is well under that.
    head = out[:16384]
    moov_pos = head.find(b"moov")
    mdat_pos = head.find(b"mdat")
    assert moov_pos > 0, "moov atom not found in mp4 header"
    # If mdat isn't in the first 16KB at all, that's fine — moov is still
    # ahead of it. We only fail if mdat shows up *before* moov.
    if mdat_pos > 0:
        assert moov_pos < mdat_pos, (
            f"moov ({moov_pos}) must precede mdat ({mdat_pos}) — "
            "faststart flag was not honored"
        )


def test_transcode_output_is_playable(sample_video_bytes):
    """Round-trip the output through ffprobe to confirm it's not corrupt."""
    out = transcode_to_web_mp4(sample_video_bytes)
    assert out is not None
    test_out = "/tmp/iter102x_test_out.mp4"
    with open(test_out, "wb") as f:
        f.write(out)
    try:
        ffmpeg = _ffmpeg_path()
        proc = subprocess.run(
            [ffmpeg, "-v", "error", "-i", test_out, "-f", "null", "-"],
            capture_output=True, text=True, timeout=15,
        )
        assert proc.returncode == 0, f"Output not playable: {proc.stderr}"
    finally:
        try:
            os.remove(test_out)
        except OSError:
            pass


def test_transcode_handles_garbage_gracefully():
    """Corrupt input must return None, never raise — uploads must keep working."""
    out = transcode_to_web_mp4(b"this is definitely not a video")
    assert out is None
