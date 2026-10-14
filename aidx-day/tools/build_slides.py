"""slides/<agenda>/ 폴더의 이미지 목록(list.json)을 만들어요.

이미지는 파일 이름 끝 숫자가 작은 순서대로 보여요 (예: 자료_1.png → 자료_2.png → 자료_10.png).
GitHub에 이미지를 올리면 GitHub Actions(.github/workflows/slides.yml)가 자동으로 실행해요.
직접 돌릴 때: python3 tools/build_slides.py
"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent / "slides"
EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


def order(p):
    m = re.search(r"(\d+)\D*$", p.stem)
    return (0, int(m.group(1)), p.name) if m else (1, 0, p.name)


changed = 0
for d in sorted(x for x in ROOT.iterdir() if x.is_dir()):
    files = sorted((f for f in d.iterdir() if f.suffix.lower() in EXTS), key=order)
    out = d / "list.json"
    text = json.dumps([f.name for f in files], ensure_ascii=False, indent=1) + "\n"
    if files:
        if not out.exists() or out.read_text(encoding="utf-8") != text:
            out.write_text(text, encoding="utf-8")
            changed += 1
        print(f"{d.name}: {len(files)}장")
    elif out.exists():
        out.unlink()
        changed += 1
print(f"list.json 변경 {changed}개")
