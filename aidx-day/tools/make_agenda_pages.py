"""exhibits.js의 전시 목록으로 agenda01.html ~ agendaNN.html 껍데기 페이지를 만들어요.

각 페이지는 내용이 없는 껍데기이고, 실제 내용은 exhibits.js + agenda.js가 그려요.
전시 제목·설명만 바꿀 때는 다시 실행할 필요가 없어요.
전시 개수나 제목이 바뀌면 실행해서 공유 미리보기용 제목을 맞춰 주세요 (node 필요):

    python3 tools/make_agenda_pages.py
"""
import html
import json
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
# exhibits.js를 node로 읽어서 [id, 제목, 설명] 목록을 얻어요 (node 필요)
JS = """
const fs = require("fs");
eval(fs.readFileSync(process.argv[1], "utf8") + "; globalThis.__E = ALL_EXHIBITS; globalThis.__T = exTitleText; globalThis.__M = exTeam;");
console.log(JSON.stringify(__E.map(e => [e.id, __T(e), e.summary || (__M(e) ? `${__M(e)} · AID-X Day 전시` : (e.part === 'connect' ? 'AX Tech Connect · AID-X Day 전시' : 'AID-X Day 전시'))])));
"""
items = json.loads(subprocess.run(["node", "-e", JS, str(ROOT / "exhibits.js")],
                                  capture_output=True, text=True, check=True).stdout)

TEMPLATE = """<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0a0a1f">
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
