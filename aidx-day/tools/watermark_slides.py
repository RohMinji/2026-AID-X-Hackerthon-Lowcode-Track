"""slides/ 의 이미지 파일 자체에 워터마크를 새겨요 (이미 새긴 파일은 건너뛰어요).

    pip install pillow pymupdf pymupdf-fonts
    python3 tools/watermark_slides.py

- 대각선 반복 문구 + 아래쪽 안내 한 줄
- 새긴 파일 이름은 각 폴더의 .watermarked 에 기록해서 두 번 새기지 않아요
- 너무 큰 이미지는 가로 2560px로 줄여요
GitHub에 이미지를 올리면 GitHub Actions(.github/workflows/slides.yml)가 자동으로 실행해요.
"""
import io
import math
import pathlib

import pymupdf
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent / "slides"
EXTS = {".jpg", ".jpeg", ".png", ".webp"}
MARK = "본 자료는 kt의 자산으로, 무단 복제, 배포 시 법적 조치를 받을 수 있습니다."
SKIP = {"test_agenda"}
MAX_W = 2560
FONT_BYTES = pymupdf.Font("cjk").buffer  # 한글 글꼴 (pymupdf-fonts)


def font(size):
    return ImageFont.truetype(io.BytesIO(FONT_BYTES), size)


def stamp(im):
    im = im.convert("RGB")
    if im.width > MAX_W:
        im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
    w, h = im.size
    size = max(14, w // 60)
    f = font(size)
    tw = f.getlength(MARK)
    # 대각선 반복 문구: 큰 투명 레이어에 그린 뒤 회전해서 덮어요
    side = int(math.hypot(w, h)) + int(tw)
    layer = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    step_x, step_y = int(tw + size * 5), size * 7
    for j, y in enumerate(range(0, side, step_y)):
        for x in range(-step_x + (j % 2) * step_x // 2, side, step_x):
            d.text((x, y), MARK, font=f, fill=(90, 90, 110, 46))
    layer = layer.rotate(28, resample=Image.BICUBIC)
    left, top = (side - w) // 2, (side - h) // 2
    out = im.convert("RGBA")
    out.alpha_composite(layer.crop((left, top, left + w, top + h)))
    # 아래쪽 안내 한 줄
    fs = max(12, w // 95)
    ff = font(fs)
    foot = "ⓒ kt Corp. " + MARK
    fw = ff.getlength(foot)
    bar = Image.new("RGBA", (w, int(fs * 1.9)), (255, 255, 255, 170))
    ImageDraw.Draw(bar).text(((w - fw) / 2, fs * 0.4), foot, font=ff, fill=(60, 60, 80, 255))
    out.alpha_composite(bar, (0, h - bar.height))
    return out.convert("RGB")


def main():
    n = 0
    for d in sorted(x for x in ROOT.iterdir() if x.is_dir() and x.name not in SKIP):
        done_file = d / ".watermarked"
        done = set(done_file.read_text(encoding="utf-8").split("\n")) if done_file.exists() else set()
        for p in sorted(x for x in d.iterdir() if x.suffix.lower() in EXTS):
            if p.name in done:
                continue
            im = stamp(Image.open(p))
            if p.suffix.lower() in {".jpg", ".jpeg"}:
                im.save(p, quality=88)
            elif p.suffix.lower() == ".webp":
                im.save(p, quality=88)
            else:
                im.save(p, optimize=True)
            done.add(p.name)
            n += 1
            print("워터마크:", p.relative_to(ROOT))
        if done - {""}:
            done_file.write_text("\n".join(sorted(done - {""})) + "\n", encoding="utf-8")
    print(f"새로 새긴 파일 {n}개")


if __name__ == "__main__":
    main()
