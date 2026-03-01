#!/usr/bin/env python3
"""Convert testing checklist markdown to a printable PDF."""

import markdown
import subprocess
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MD_PATH = os.path.join(SCRIPT_DIR, "RapidReps_Testing_Checklist.md")
HTML_PATH = os.path.join(SCRIPT_DIR, "checklist.html")
PDF_PATH = os.path.join(SCRIPT_DIR, "RapidReps_Testing_Checklist.pdf")

CSS = """
@page { size: A4; margin: 15mm; }
body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  color: #111;
  line-height: 1.5;
  font-size: 11px;
  max-width: 100%;
  padding: 0;
  margin: 0;
}
h1 { color: #0f3460; font-size: 20px; border-bottom: 3px solid #16c79a; padding-bottom: 6px; margin-top: 24px; }
h2 { color: #0f3460; font-size: 15px; border-bottom: 2px solid #ddd; padding-bottom: 4px; margin-top: 20px; page-break-after: avoid; }
h3 { color: #16213e; font-size: 13px; margin-top: 14px; page-break-after: avoid; }
table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 10px; page-break-inside: avoid; }
th, td { border: 1px solid #999; padding: 4px 6px; text-align: left; }
th { background: #0f3460; color: #fff; font-weight: 600; }
tr:nth-child(even) { background: #f4f8fc; }
td:last-child { width: 50px; text-align: center; }
hr { border: none; border-top: 1px solid #ccc; margin: 16px 0; }
strong { color: #0f3460; }
code { background: #f0f0f0; padding: 1px 4px; border-radius: 2px; font-size: 10px; }
ul, ol { padding-left: 20px; }
li { margin-bottom: 2px; }
"""

with open(MD_PATH, "r") as f:
    md_text = f.read()

html_body = markdown.markdown(md_text, extensions=["tables", "fenced_code"])

html_full = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>RapidReps Testing Checklist</title>
<style>{CSS}</style>
</head>
<body>
{html_body}
</body>
</html>"""

with open(HTML_PATH, "w") as f:
    f.write(html_full)

result = subprocess.run([
    "wkhtmltopdf", "--quiet",
    "--page-size", "A4",
    "--margin-top", "12mm", "--margin-bottom", "12mm",
    "--margin-left", "10mm", "--margin-right", "10mm",
    "--encoding", "UTF-8",
    "--enable-local-file-access",
    HTML_PATH, PDF_PATH
], capture_output=True, text=True)

if result.returncode == 0:
    size = os.path.getsize(PDF_PATH)
    print(f"Checklist PDF generated: {PDF_PATH} ({size:,} bytes)")
else:
    print(f"Error: {result.stderr}")
