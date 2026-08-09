"""
iter118m — Public documentation routes.
Serves the user manual as pretty rendered HTML so the app owner can bookmark
a URL and share it. No auth required — the docs contain no secrets.
"""
import os
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse, PlainTextResponse
import markdown as md

router = APIRouter(prefix="/api")

MANUAL_PATH = Path('/app/memory/USER_MANUAL.md')

HTML_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>RapidReps — User Manual</title>
<style>
  :root {{
    --bg: #0A0E1A;
    --card: #141929;
    --text: #E8ECF2;
    --dim: #94A3B8;
    --orange: #FF6A00;
    --border: rgba(255,255,255,0.08);
    --code-bg: #10141F;
  }}
  * {{ box-sizing: border-box; }}
  html, body {{ margin: 0; padding: 0; background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.65; }}
  .wrap {{ max-width: 860px; margin: 0 auto; padding: 32px 24px 96px; }}
  .toolbar {{
    position: sticky; top: 0; z-index: 10;
    background: linear-gradient(180deg, rgba(10,14,26,0.98) 0%, rgba(10,14,26,0.9) 90%, rgba(10,14,26,0) 100%);
    padding: 12px 0 20px;
    display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
  }}
  .btn {{
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 14px; border-radius: 8px;
    background: var(--orange); color: #fff; text-decoration: none;
    font-weight: 700; font-size: 13px; letter-spacing: 0.3px;
  }}
  .btn.secondary {{ background: transparent; border: 1px solid var(--border); color: var(--dim); }}
  h1, h2, h3, h4 {{ color: #fff; letter-spacing: -0.3px; }}
  h1 {{ font-size: 32px; border-bottom: 2px solid var(--orange); padding-bottom: 12px; margin-top: 0; }}
  h2 {{ font-size: 24px; margin-top: 48px; color: var(--orange); }}
  h3 {{ font-size: 19px; margin-top: 32px; }}
  h4 {{ font-size: 16px; color: var(--dim); }}
  a {{ color: var(--orange); }}
  code {{
    background: var(--code-bg); padding: 2px 6px; border-radius: 4px;
    font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 13px;
    color: #FFC28A;
  }}
  pre {{ background: var(--code-bg); padding: 16px; border-radius: 10px; overflow-x: auto; border: 1px solid var(--border); }}
  pre code {{ background: transparent; padding: 0; color: var(--text); }}
  table {{
    width: 100%; border-collapse: collapse; margin: 16px 0;
    background: var(--card); border-radius: 10px; overflow: hidden;
  }}
  th, td {{ padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--border); vertical-align: top; }}
  th {{ background: rgba(255,106,0,0.1); color: #fff; font-size: 13px; letter-spacing: 0.5px; }}
  tr:last-child td {{ border-bottom: none; }}
  strong {{ color: #fff; }}
  ul, ol {{ padding-left: 22px; }}
  li {{ margin: 6px 0; }}
  blockquote {{ border-left: 3px solid var(--orange); padding: 4px 16px; background: var(--card); border-radius: 0 8px 8px 0; }}
  hr {{ border: none; border-top: 1px solid var(--border); margin: 40px 0; }}
  .footer {{ margin-top: 60px; padding-top: 24px; border-top: 1px solid var(--border); color: var(--dim); font-size: 12px; }}
</style>
</head>
<body>
  <div class="wrap">
    <div class="toolbar">
      <a class="btn" href="/api/docs/manual.md" download="RapidReps-Manual.md">⬇ Download .md</a>
      <a class="btn secondary" href="javascript:window.print()">🖨 Print / Save as PDF</a>
      <a class="btn secondary" href="#top">↑ Top</a>
    </div>
    <div id="top">{content}</div>
    <div class="footer">
      Bookmark this page: <code>{url}</code><br>
      Generated live from <code>/app/memory/USER_MANUAL.md</code> — updated when the file changes.
    </div>
  </div>
</body>
</html>
"""


@router.get("/docs/manual", response_class=HTMLResponse)
async def get_manual_html():
    """Render the RapidReps user manual as styled HTML."""
    if not MANUAL_PATH.exists():
        raise HTTPException(404, "Manual not found on server")
    text = MANUAL_PATH.read_text(encoding='utf-8')
    html_body = md.markdown(text, extensions=['fenced_code', 'tables', 'toc'])
    backend_url = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://trainer-finder-9.emergent.host')
    return HTMLResponse(HTML_TEMPLATE.format(content=html_body, url=f"{backend_url}/api/docs/manual"))


@router.get("/docs/manual.md", response_class=PlainTextResponse)
async def get_manual_markdown():
    """Raw markdown download."""
    if not MANUAL_PATH.exists():
        raise HTTPException(404, "Manual not found on server")
    return PlainTextResponse(
        MANUAL_PATH.read_text(encoding='utf-8'),
        media_type='text/markdown',
        headers={'Content-Disposition': 'attachment; filename="RapidReps-Manual.md"'},
    )
