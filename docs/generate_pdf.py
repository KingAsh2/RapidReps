#!/usr/bin/env python3
"""Convert user_manual.md to a styled HTML, then to PDF via wkhtmltopdf."""

import markdown
import subprocess
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MD_PATH = os.path.join(SCRIPT_DIR, "user_manual.md")
HTML_PATH = os.path.join(SCRIPT_DIR, "user_manual.html")
PDF_PATH = os.path.join(SCRIPT_DIR, "RapidReps_User_Manual_v2.pdf")

CSS = """
body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  color: #1a1a2e;
  line-height: 1.7;
  max-width: 900px;
  margin: 0 auto;
  padding: 40px 32px;
  background: #fff;
}
h1 {
  color: #0f3460;
  border-bottom: 3px solid #16c79a;
  padding-bottom: 10px;
  font-size: 2em;
}
h2 {
  color: #0f3460;
  border-bottom: 2px solid #e0e0e0;
  padding-bottom: 6px;
  margin-top: 36px;
  font-size: 1.5em;
}
h3 { color: #16213e; margin-top: 24px; font-size: 1.2em; }
h4 { color: #333; }
table {
  border-collapse: collapse;
  width: 100%;
  margin: 16px 0;
  font-size: 0.92em;
}
th, td {
  border: 1px solid #ccc;
  padding: 8px 12px;
  text-align: left;
}
th { background: #0f3460; color: #fff; }
tr:nth-child(even) { background: #f4f8fc; }
blockquote {
  border-left: 4px solid #16c79a;
  margin: 16px 0;
  padding: 10px 20px;
  background: #f0faf6;
  font-style: italic;
}
code {
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.9em;
}
hr { border: none; border-top: 1px solid #ddd; margin: 32px 0; }
strong { color: #0f3460; }
em { color: #555; }
ul, ol { padding-left: 24px; }
li { margin-bottom: 4px; }
"""

with open(MD_PATH, "r") as f:
    md_text = f.read()

html_body = markdown.markdown(md_text, extensions=["tables", "fenced_code"])

html_full = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>RapidReps User Manual v3.0</title>
<style>{CSS}</style>
</head>
<body>
{html_body}
</body>
</html>"""

with open(HTML_PATH, "w") as f:
    f.write(html_full)

print(f"HTML written to {HTML_PATH}")

result = subprocess.run([
    "wkhtmltopdf",
    "--quiet",
    "--page-size", "A4",
    "--margin-top", "20mm",
    "--margin-bottom", "20mm",
    "--margin-left", "15mm",
    "--margin-right", "15mm",
    "--encoding", "UTF-8",
    "--enable-local-file-access",
    HTML_PATH, PDF_PATH
], capture_output=True, text=True)

if result.returncode == 0:
    size = os.path.getsize(PDF_PATH)
    print(f"PDF generated: {PDF_PATH} ({size:,} bytes)")
else:
    print(f"Error: {result.stderr}")
