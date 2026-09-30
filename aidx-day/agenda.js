/* 전시 상세 페이지(agenda01~28) 렌더러 — 내용은 exhibits.js에서 가져와요 */
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
  const svgBack = '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>';
  const LIST_URL = "./#program/exhibit";

  const id = document.body.dataset.id || (location.pathname.match(/agenda\d+/) || [""])[0];
  const idx = EXHIBITS.findIndex(x => x.id === id);
  const app = document.getElementById("app");

  const back = h("a", { class: "back", href: LIST_URL });
  back.innerHTML = svgBack;
  back.append("전시 목록");
  const topbar = h("header", { class: "topbar" },
    h("div", { class: "topbar-inner" }, back, h("a", { class: "brand", href: "./" }, h("b", {}, "AID-X Day"))));
  document.body.insertBefore(topbar, app);
  if (EXHIBIT_SAMPLE) {
    document.body.insertBefore(h("div", { class: "sample-banner" }, EXHIBIT_NOTICE), app);
  }

  if (idx < 0) {
    app.append(h("div", { class: "wrap notfound" },
      h("h1", {}, "전시를 찾을 수 없어요"),
      h("a", { class: "btn", href: LIST_URL, style: "display:inline-block;padding:12px 20px" }, "전시 목록으로")));
    return;
  }

  const x = EXHIBITS[idx];
  const part = PARTS[x.part] || { name: x.part, color: "#35e0ff" };
  document.documentElement.style.setProperty("--c", part.color);
  document.title = `${exTitleText(x)} · AID-X Day 전시`;
  const titles = exTitles(x);

  const head = h("div", { class: "head" },
    h("div", { class: "row" },
      h("span", { class: "badge" }, part.name),
      x.label ? h("span", { class: "badge" }, x.label) : null,
      x.booth ? h("span", { class: "badge" }, `${x.booth} 부스`) : null,
      h("span", { class: "num" }, `Agenda ${exNo(x)} / ${EXHIBITS.length}`)),
    titles.length > 1
      ? h("h1", { class: "multi" }, titles.map(t => h("span", {}, t)))
      : h("h1", {}, titles[0]),
    h("div", { class: "team" }, exTeam(x)),
    x.summary ? h("p", { class: "summary" }, x.summary) : null);

  const visual = h("div", { class: "visual" });
  if (x.image) visual.append(h("img", { src: x.image, alt: exTitleText(x) }));
  else visual.append(h("div", { class: "ph" }, h("div", {}, h("b", {}, part.name), h("span", {}, x.booth ? `BOOTH ${x.booth}` : `AGENDA ${exNo(x)}`))));

  const main = h("div", { class: "grid" },
    h("section", { class: "card" }, h("h2", { class: "label" }, "소개"),
      x.desc && x.desc.length ? x.desc.map(p => h("p", {}, p)) : h("p", { class: "pending" }, "상세 소개를 준비하고 있어요. 곧 업데이트돼요.")),
    x.points && x.points.length ? h("section", { class: "card" }, h("h2", { class: "label" }, "핵심 포인트"),
      h("ul", { class: "points" }, x.points.map(p => h("li", {}, p)))) : null);

  const infoRows = [
    ["담당", [exTeam(x)]],
    ["위치", [EXHIBIT_PLACE + (x.booth ? ` · ${x.booth} 부스` : ""), h("small", {}, h("a", { href: "./#floors" }, "층별 안내 보기"))]],
    ["운영", [h("small", { style: "font-size:14px;color:inherit;font-weight:600" }, EXHIBIT_HOURS)]],
    x.demo && x.demo.length ? ["시연", [h("div", { class: "chips time" }, x.demo.map(t => h("span", {}, t)))]] : null,
    x.tags && x.tags.length ? ["태그", [h("div", { class: "chips" }, x.tags.map(t => h("span", {}, "#" + t)))]] : null,
    x.contact ? ["문의", [x.contact]] : null,
  ].filter(Boolean);
  const side = h("div", { class: "grid side" },
    h("section", { class: "card" }, h("h2", { class: "label" }, "전시 정보"),
      h("dl", { class: "info" }, infoRows.map(([k, v]) => h("div", {}, h("dt", {}, k), h("dd", {}, v)))),
      x.link ? h("a", { class: "btn", href: x.link, target: "_blank", rel: "noopener" }, "관련 자료 보기") : null));

  const prev = EXHIBITS[idx - 1], next = EXHIBITS[idx + 1];
  const pager = h("nav", { class: "pager", "aria-label": "이전·다음 전시" },
    prev ? h("a", { href: prev.id }, h("small", {}, "← 이전 전시"), h("span", {}, exTitleText(prev))) : h("span", { class: "empty" }),
    next ? h("a", { class: "next", href: next.id }, h("small", {}, "다음 전시 →"), h("span", {}, exTitleText(next))) : h("span", { class: "empty" }));

  const others = EXHIBITS.filter(e => e.part === x.part && e.id !== x.id);
  const same = others.length ? h("section", { class: "card" },
    h("h2", { class: "label" }, `${part.name} 파트 다른 전시`),
    h("ul", { class: "same" }, others.map(e => h("li", {}, h("a", { href: e.id }, h("span", { class: "b" }, exNo(e)), h("span", { class: "t" }, exTitleText(e))))))) : null;

  side.append(same);
  app.append(h("div", { class: "wrap" }, head, visual,
    h("div", { class: "layout" }, h("div", {}, main, pager), side),
    h("footer", {}, "© 2026 AID-X")));
})();
