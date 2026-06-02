"""One-shot script — generate cinematic premium background images for the
Welcome + Login screens using Gemini Nano Banana via Emergent LLM key.

Run from /app/backend:
    python -m scripts.generate_premium_backgrounds

Outputs are saved to /app/frontend/assets/images/.
"""
import asyncio
import base64
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

from emergentintegrations.llm.chat import LlmChat, UserMessage  # noqa: E402

OUT_DIR = Path("/app/frontend/assets/images")
MODEL_ID = "gemini-3.1-flash-image-preview"

PROMPTS = {
    "premium-welcome-bg.png": (
        "Cinematic vertical mobile-app hero background, 9:16 aspect ratio. "
        "Two athletic silhouettes facing inward toward the center of the frame — "
        "on the LEFT a powerful male boxer in a fighting stance with hand wraps, "
        "on the RIGHT a determined female runner mid-stride. Both rendered as bold "
        "black silhouettes with glowing orange rim-light tracing their muscles. "
        "Background is a fiery deep-orange-to-black ember storm — burning orange "
        "embers and sparks flying horizontally through the scene, motion blur "
        "streaks suggesting speed and energy. Vignette darkens to pure black at "
        "the top and bottom edges so UI text remains legible. Center of frame is "
        "intentionally empty (negative space) for a logo + headline overlay. "
        "Color palette: deep orange #FF7A00, ember glow #FF9B2F, deep navy "
        "#091A3A, pure black #0A0A0A. Mood: Nike Training Club meets a UFC "
        "fight poster. Photorealistic but stylized. Dramatic high-contrast "
        "lighting. No text, no logos."
    ),
    "premium-login-bg.png": (
        "Cinematic vertical mobile-app hero background, 9:16 aspect ratio. "
        "A solo athletic silhouette in dramatic action pose — a powerful "
        "weightlifter mid-clean-and-jerk lift, rendered as a bold black silhouette "
        "with intense orange rim-light tracing the muscles and barbell. "
        "Background is a fiery orange explosion radiating outward from the lifter, "
        "fading to deep navy and black at the edges. Embers and sparks fly upward "
        "through the scene, motion blur and heat-distortion effects. Vignette "
        "darkens significantly at top and bottom for UI legibility. Lower third "
        "of the frame fades to near-black so a login form sits cleanly on top. "
        "Color palette: deep orange #FF7A00, ember glow #FF9B2F, deep navy "
        "#091A3A, pure black #0A0A0A. Mood: gym hero shot meets cinematic movie "
        "poster. Photorealistic but stylized. No text, no logos."
    ),
}


async def gen_one(filename: str, prompt: str, api_key: str) -> bool:
    out = OUT_DIR / filename
    print(f"\n→ Generating {filename} …")
    chat = LlmChat(
        api_key=api_key,
        session_id=f"premium-bg-{filename}",
        system_message="You are an expert cinematic concept artist.",
    )
    chat.with_model("gemini", MODEL_ID).with_params(modalities=["image", "text"])

    msg = UserMessage(text=prompt)
    text, images = await chat.send_message_multimodal_response(msg)
    print(f"  text resp len: {len(text or '')}")
    if not images:
        print(f"  ❌ No images returned for {filename}")
        return False
    img = images[0]
    print(f"  mime: {img.get('mime_type')}  (saving {len(img['data'])} b64 chars)")
    image_bytes = base64.b64decode(img["data"])
    out.write_bytes(image_bytes)
    size_kb = out.stat().st_size / 1024
    print(f"  ✅ Saved {out}  ({size_kb:.1f} KB)")
    return True


async def main() -> int:
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        print("ERROR: EMERGENT_LLM_KEY missing from /app/backend/.env", file=sys.stderr)
        return 1
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ok = 0
    for filename, prompt in PROMPTS.items():
        if await gen_one(filename, prompt, api_key):
            ok += 1
    print(f"\nDone. {ok}/{len(PROMPTS)} images generated.")
    return 0 if ok == len(PROMPTS) else 2


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
