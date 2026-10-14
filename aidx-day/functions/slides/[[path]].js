// /slides/* (상세 페이지 이미지 자료) 요청을 먼저 받아서 공개 시간에만 내줘요 (Cloudflare Pages Functions)
// - 공개 시간: 2026-10-15 00:00 ~ 18:00 (한국 시간), 서버 시계 기준
// - 운영진 미리보기: ?key=<PDF_PREVIEW_KEY>  (Cloudflare 설정 > Variables and Secrets 에 저장)
// - ALWAYS_OPEN 폴더는 시간과 상관없이 열려요 (테스트용)
const OPEN = Date.parse("2026-10-15T00:00:00+09:00");
const CLOSE = Date.parse("2026-10-15T18:00:00+09:00");
const ALWAYS_OPEN = ["test_agenda"];

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  const folder = decodeURIComponent(url.pathname.split("/")[2] || "");
  const key = env.PDF_PREVIEW_KEY;
  const preview = !!key && url.searchParams.get("key") === key;
  const now = Date.now();
  const state = now < OPEN ? "before" : now >= CLOSE ? "after" : "open";
  const isReadme = /README\.txt$/i.test(url.pathname);

  if (isReadme || (!ALWAYS_OPEN.includes(folder) && !preview && state !== "open")) {
    return new Response("공개 시간이 아닙니다.", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Slides-Lock": state, "X-Robots-Tag": "noindex" },
    });
  }

  const res = await next();
  const headers = new Headers(res.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Robots-Tag", "noindex");
  return new Response(res.body, { status: res.status, headers });
}
