"""exhibits.js의 전시 목록으로 agenda01.html ~ agendaNN.html 껍데기 페이지를 만들어요.

각 페이지는 내용이 없는 껍데기이고, 실제 내용은 exhibits.js + agenda.js가 그려요.
전시 제목·설명만 바꿀 때는 다시 실행할 필요가 없어요.
전시 개수가 바뀌거나 제목(공유 미리보기용)을 맞추고 싶을 때 실행하세요:

    python3 tools/make_agenda_pages.py
"""
import html
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
src = (ROOT / "exhibits.js").read_text(encoding="utf-8")
items = re.findall(r'id:\s*"(agenda\d+)".*?title:\s*"([^"]*)".*?summary:\s*"([^"]*)"', src, re.S)

TEMPLATE = """<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#05070f">
<title>{title} · AID-X Day 전시</title>
<meta name="description" content="{summary}">
<meta property="og:title" content="{title} · AID-X Day 전시">
<meta property="og:description" content="{summary}">
<link rel="stylesheet" href="agenda.css">
</head>
<body data-id="{id}">
<div class="bg" aria-hidden="true"></div>
<main id="app"></main>
<script src="exhibits.js"></script>
<script src="agenda.js"></script>
</body>
</html>
"""

for old in ROOT.glob("agenda[0-9]*.html"):
    old.unlink()
for id_, title, summary in items:
    (ROOT / f"{id_}.html").write_text(
        TEMPLATE.format(id=id_, title=html.escape(title), summary=html.escape(summary)), encoding="utf-8")
print(f"{len(items)} pages:", ", ".join(i for i, _, _ in items))
