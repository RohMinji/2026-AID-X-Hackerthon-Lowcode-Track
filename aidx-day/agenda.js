/* 전시 상세 페이지(agenda01~40) 렌더러 — 내용은 exhibits.js에서 가져와요 */
(function () {
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "style") el.style.cssText = v;
      else el.setAttribute(k, v);
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      el.appendChild(typeof kid === "string" || typeof kid === "number" ? document.createTextNode(kid) : kid);
    }
    return el;
  }
  // ---- 자료 뷰어 (이미지 slides/ 또는 PDF) — 화면 워터마크 + 우클릭/길게 눌러 저장 막기 ----
  const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
  const PDF_NOTICE = "본 자료는 kt의 자산으로, 무단 복제·배포 시 법적 조치를 받을 수 있습니다.";
  // 열람 가능할 때(서버가 200을 줄 때)만 box를 PDF 뷰어로 바꿔요. 아니면 원래 그림을 그대로 둬요
  function pdfViewer(box, url, onShow) {
    // 운영진 미리보기: 페이지 주소에 ?key=… 가 있으면 PDF 요청에도 붙여요
    const key = new URLSearchParams(location.search).get("key");
    const src = key ? `${url}?key=${encodeURIComponent(key)}` : url;
    fetch(src, { cache: "no-store" }).then(async res => {
      if (!res.ok) return;  // 잠김(403)·없음 → 그대로
      const data = await res.arrayBuffer();
      await new Promise((ok, no) => {
        const s = document.createElement("script");
        s.src = PDFJS + "pdf.min.js"; s.onload = ok; s.onerror = no;
        document.head.append(s);
      });
      pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js";
      const doc = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise;
      buildViewer(box, pdfSource(doc));
      if (onShow) onShow();
    }).catch(() => {});
  }
  // 이미지 자료: slides/<id>/list.json 순서대로 (열람 가능할 때만)
  function slidesViewer(box, id, onShow) {
    const key = new URLSearchParams(location.search).get("key");
    const q = key ? `?key=${encodeURIComponent(key)}` : "";
    fetch(`slides/${id}/list.json${q}`, { cache: "no-store" }).then(async res => {
      if (!res.ok || !/json/.test(res.headers.get("Content-Type") || "")) return;  // 잠김·없음 → 그대로
      const list = await res.json();
      if (!Array.isArray(list) || !list.length) return;
      const src = imageSource(list.map(f => `slides/${id}/${encodeURIComponent(f)}${q}`));
      await src.page(1);  // 첫 장이 실제로 열리는지 확인한 뒤에 바꿔요
      buildViewer(box, src);
      if (onShow) onShow();
    }).catch(() => {});
  }
  // 페이지 공급자: { numPages, page(n) → { w, h, draw(ctx, scale) } }
  function pdfSource(doc) {
    return {
      numPages: doc.numPages,
      async page(n) {
        const p = await doc.getPage(n), b = p.getViewport({ scale: 1 });
        return { w: b.width, h: b.height, draw: (ctx, s) => p.render({ canvasContext: ctx, viewport: p.getViewport({ scale: s }) }).promise };
      },
    };
  }
  function imageSource(urls) {
    const cache = {};
    const load = n => cache[n] || (cache[n] = fetch(urls[n - 1], { cache: "no-store" })
      .then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); })
      .then(b => createImageBitmap(b)));
    return {
      numPages: urls.length,
      async page(n) {
        const bmp = await load(n);
        if (n < urls.length) load(n + 1).catch(() => {});  // 다음 장 미리 받기
        return { w: bmp.width, h: bmp.height, draw: (ctx, s) => { ctx.imageSmoothingQuality = "high"; ctx.drawImage(bmp, 0, 0, bmp.width * s, bmp.height * s); } };
      },
    };
  }
  function buildViewer(box, doc) {
    box.textContent = "";
    box.classList.add("has-pdf");
    const canvas = h("canvas", { "aria-label": "발표 자료" });
    const wm = h("div", { class: "pdf-wm", "aria-hidden": "true" });
    wm.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='520' height='220'><text x='260' y='110' fill='rgba(255,255,255,.13)' font-size='15' font-family='sans-serif' text-anchor='middle' transform='rotate(-28 260 110)'>${PDF_NOTICE}</text></svg>`)}")`;
    const stage = h("div", { class: "pdf-stage" }, h("div", { class: "pdf-page" }, canvas, wm));
    const prev = h("button", { type: "button", class: "pdf-btn", "aria-label": "이전 페이지" }, "‹");
    const next = h("button", { type: "button", class: "pdf-btn", "aria-label": "다음 페이지" }, "›");
    const num = h("span", { class: "pdf-num" }, "");
    const full = h("button", { type: "button", class: "pdf-btn pdf-full-btn", "aria-label": "크게 보기" }, "⛶");
    const bar = h("div", { class: "pdf-bar" }, prev, num, next, full);
    box.append(stage, bar);
    // 꾹 눌러 저장/복사 막기: 메뉴·선택·드래그 차단 (+ CSS의 -webkit-touch-callout)
    ["contextmenu", "selectstart", "copy"].forEach(ev => box.addEventListener(ev, e => e.preventDefault()));
    box.addEventListener("dragstart", e => e.preventDefault());

    let pageNo = 1, busy = false, again = false;
    async function render() {
      if (!doc) return;
      if (busy) { again = true; return; }
      busy = true;
      const pg = await doc.page(pageNo);
      const isFull = box.classList.contains("full");
      const maxW = stage.clientWidth, maxH = isFull ? stage.clientHeight : Infinity;
      const css = Math.min(maxW / pg.w, maxH / pg.h);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(pg.w * css * dpr); canvas.height = Math.round(pg.h * css * dpr);
      canvas.style.width = `${pg.w * css}px`; canvas.style.height = `${pg.h * css}px`;
      await pg.draw(canvas.getContext("2d"), css * dpr);
      box.classList.add("ready");
      num.textContent = `${pageNo} / ${doc.numPages}`;
      prev.disabled = pageNo <= 1; next.disabled = pageNo >= doc.numPages;
      busy = false;
      if (again) { again = false; render(); }
    }
    const go = d => { const n = Math.min(Math.max(pageNo + d, 1), doc ? doc.numPages : 1); if (n !== pageNo) { pageNo = n; render(); } };
    prev.onclick = () => go(-1);
    next.onclick = () => go(1);
    full.onclick = () => {
      const on = box.classList.toggle("full");
      document.body.classList.toggle("pdf-open", on);
      full.textContent = on ? "✕" : "⛶";
      full.setAttribute("aria-label", on ? "닫기" : "크게 보기");
      render();
    };
    document.addEventListener("keydown", e => {
      if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "Escape" && box.classList.contains("full")) full.onclick();
    });
    let sx = null;
    stage.addEventListener("touchstart", e => { sx = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener("touchend", e => {
      if (sx == null) return;
      const dx = e.changedTouches[0].clientX - sx; sx = null;
      if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    });
    let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(render, 150); });

    render();
  }

  const svgBack = '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>';
  const LIST_URL = "./#program/exhibit";

  const id = document.body.dataset.id || (location.pathname.match(/agenda\d+/) || [""])[0];
  const LIST = ALL_EXHIBITS;
  const idx = LIST.findIndex(x => x.id === id);
  const app = document.getElementById("app");

  const back = h("a", { class: "back", href: LIST_URL });
  back.innerHTML = svgBack;
  back.append("전시 목록");
  const topbar = h("header", { class: "topbar" },
    h("div", { class: "topbar-inner" }, back, h("a", { class: "brand", href: "./" }, h("img", { src: "img/logo.webp", alt: "AID-X Day", width: "79", height: "20" }))));
  document.body.insertBefore(topbar, app);
  if (EXHIBIT_SAMPLE) {
    document.body.insertBefore(h("div", { class: "sample-banner" }, EXHIBIT_NOTICE), app);
  }

  const x = idx >= 0 ? LIST[idx] : id === TEST_EXHIBIT.id ? TEST_EXHIBIT : null;
  if (!x) {
    app.append(h("div", { class: "wrap notfound" },
      h("h1", {}, "전시를 찾을 수 없어요"),
      h("a", { class: "btn", href: LIST_URL, style: "display:inline-block;padding:12px 20px" }, "전시 목록으로")));
    return;
  }

  const isConnect = x.part === "connect";
  const part = isConnect ? { name: TECH_CONNECT.name, color: TECH_CONNECT.color, icon: TECH_CONNECT.icon }
    : PARTS[x.part] || { name: x.part, color: "#35e0ff" };
  const back2 = topbar.querySelector(".back");
  if (isConnect) back2.href = "./#program/connect";
  document.documentElement.style.setProperty("--c", part.color);
  document.title = `${exTitleText(x)} · AID-X Day 전시`;
  const titles = exTitles(x);

  const head = h("div", { class: "head" },
    h("div", { class: "row" },
      h("span", { class: "badge" }, part.name),
      x.label ? h("span", { class: "badge" }, x.label) : null,
      x.booth ? h("span", { class: "badge" }, `${x.booth} 부스`) : null,
      h("span", { class: "num" }, exNo(x))),
    titles.length > 1
      ? h("h1", { class: "multi" }, titles.map(t => h("span", {}, t)))
      : h("h1", {}, titles[0]),
    x.sub ? h("p", { class: "subtitle" }, x.sub) : null,
    exTeam(x) ? h("div", { class: "team" }, exTeam(x)) : null,
    x.summary ? h("p", { class: "summary" }, x.summary) : null);

  const visual = h("div", { class: "visual" });
  if (x.image) visual.append(h("img", { src: x.image, alt: exTitleText(x) }));
  else visual.append(h("div", { class: "ph" },
    part.icon ? h("img", { src: part.icon, alt: "", "aria-hidden": "true" }) : null,
    h("div", { class: "cap" }, h("b", {}, part.name), h("span", {}, x.booth ? `BOOTH ${x.booth}` : exNo(x)))));

  const main = h("div", { class: "grid" },
    h("section", { class: "card" }, h("h2", { class: "label" }, "소개"),
      x.desc && x.desc.length ? x.desc.map(p => h("p", {}, p)) : h("p", { class: "pending" }, "상세 소개를 준비하고 있어요. 곧 업데이트돼요.")),
    x.points && x.points.length ? h("section", { class: "card" }, h("h2", { class: "label" }, "핵심 포인트"),
      h("ul", { class: "points" }, x.points.map(p => h("li", {}, p)))) : null);

  const infoRows = [
    exTeam(x) ? ["담당", [exTeam(x)]] : null,
    ["위치", [(isConnect ? TECH_CONNECT.place : EXHIBIT_PLACE + ` · ${part.name} 존`) + (x.booth ? ` · ${x.booth} 부스` : ""), h("small", {}, h("a", { href: "./#floors" }, "층별 안내 보기"))]],
    ["운영", [h("small", { style: "font-size:14px;color:inherit;font-weight:600" }, EXHIBIT_HOURS)]],
    x.demo && x.demo.length ? ["시연", [h("div", { class: "chips time" }, x.demo.map(t => h("span", {}, t)))]] : null,
    x.tags && x.tags.length ? ["태그", [h("div", { class: "chips" }, x.tags.map(t => h("span", {}, "#" + t)))]] : null,
    x.contact ? ["문의", [x.contact]] : null,
  ].filter(Boolean);
  const side = h("div", { class: "grid side" },
    h("section", { class: "card" }, h("h2", { class: "label" }, "전시 정보"),
      h("dl", { class: "info" }, infoRows.map(([k, v]) => h("div", {}, h("dt", {}, k), h("dd", {}, v)))),
      x.link ? h("a", { class: "btn", href: x.link, target: "_blank", rel: "noopener" }, "관련 자료 보기") : null));

  // AX Tech Connect는 그 안에서만 이전/다음으로 이동
  const group = LIST.filter(e => (e.part === "connect") === isConnect), gi = group.indexOf(x);
  const prev = gi < 0 ? null : group[gi - 1], next = gi < 0 ? null : group[gi + 1];
  const pager = h("nav", { class: "pager", "aria-label": "이전·다음 전시" },
    prev ? h("a", { href: prev.id }, h("small", {}, "← 이전 전시"), h("span", {}, exTitleMain(prev))) : h("span", { class: "empty" }),
    next ? h("a", { class: "next", href: next.id }, h("small", {}, "다음 전시 →"), h("span", {}, exTitleMain(next))) : h("span", { class: "empty" }));

  const others = LIST.filter(e => e.part === x.part && e.id !== x.id);
  const same = others.length ? h("section", { class: "card" },
    h("h2", { class: "label" }, isConnect ? `${part.name} 다른 전시` : `${part.name} 존 다른 전시`),
    h("ul", { class: "same" }, others.map(e => h("li", {}, h("a", { href: e.id }, h("span", { class: "b" }, exNo(e)), h("span", { class: "t" }, exTitleMain(e), e.sub ? h("small", {}, e.sub) : null)))))) : null;

  side.append(same);
  const showNotice = () => main.prepend(h("p", { class: "pdf-notice" }, "🔒 " + PDF_NOTICE));
  if (x.pdf) pdfViewer(visual, x.pdf, showNotice);
  else slidesViewer(visual, x.id, showNotice);
  app.append(h("div", { class: "wrap" }, head, visual,
    h("div", { class: "layout" }, h("div", {}, main, pager), side),
    h("footer", {}, "kt AID-X Day & Hackathon")));
})();
