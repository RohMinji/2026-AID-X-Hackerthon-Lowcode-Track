"""PDF 파일 자체에 워터마크를 새겨요 (사이트에 올리기 전에 실행).

    pip install pymupdf pymupdf-fonts
    python3 tools/watermark_pdf.py 원본.pdf pdf/agenda01.pdf

모든 페이지에 대각선 반복 문구 + 아래쪽 안내 한 줄이 들어가요.
"""
import math
import sys

import pymupdf

MARK = "본 자료는 kt의 자산으로, 무단 복제·배포 시 법적 조치를 받을 수 있습니다."
FOOT = "ⓒ kt Corp. " + MARK + " · AID-X Day 2026"


FONT = pymupdf.Font("cjk")  # 한글 글꼴 (pymupdf-fonts)


def stamp(page):
    page.insert_font(fontname="wm", fontbuffer=FONT.buffer)
    r = page.rect
    size = max(r.width, r.height) / 46
    tw = FONT.text_length(MARK, size)
    ang = 30
    step_x, step_y = tw + size * 6, size * 9
    rot = pymupdf.Matrix(ang)
    cx, cy = r.width / 2, r.height / 2
    span = int(math.hypot(r.width, r.height) / step_y) + 2
    for j in range(-span, span + 1):
        for i in range(-3, 4):
            x = cx + i * step_x - tw / 2 + (j % 2) * step_x / 2
            y = cy + j * step_y
            page.insert_text((x, y), MARK, fontname="wm", fontsize=size, color=(0.45, 0.45, 0.5),
                             fill_opacity=0.16, morph=(pymupdf.Point(cx, cy), rot), overlay=True)
    fs = size * 0.62
    fw = FONT.text_length(FOOT, fs)
    page.insert_text(((r.width - fw) / 2, r.height - fs * 1.2), FOOT, fontname="wm",
                     fontsize=fs, color=(0.35, 0.35, 0.4), fill_opacity=0.75, overlay=True)


def main(src, dst):
    doc = pymupdf.open(src)
    for page in doc:
        page.clean_contents()
        stamp(page)
    doc.subset_fonts()
    doc.set_metadata({"title": "AID-X Day 2026", "author": "kt", "subject": MARK})
    doc.save(dst, garbage=4, deflate=True)
    print(f"{dst}: {doc.page_count} pages")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
