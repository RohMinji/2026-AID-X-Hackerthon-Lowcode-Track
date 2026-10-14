// /pdf/* 요청을 먼저 받아서 공개 시간에만 파일을 내줘요 (Cloudflare Pages Functions)
// - 공개 시간: 2026-10-15 00:00 ~ 18:00 (한국 시간), 서버 시계 기준
// - 운영진 미리보기: ?key=<PDF_PREVIEW_KEY>  (Cloudflare 설정 > Variables and Secrets 에 저장)
// - ALWAYS_OPEN 파일은 시간과 상관없이 열려요 (테스트용)
const OPEN = Date.parse("2026-10-15T00:00:00+09:00");
const CLOSE = Date.parse("2026-10-15T18:00:00+09:00");
const ALWAYS_OPEN = ["test_agenda.pdf"];

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  const name = decodeURIComponent(url.pathname.split("/").pop() || "");
  const key = env.PDF_PREVIEW_KEY;
  const preview = !!key && url.searchParams.get("key") === key;
  const now = Date.now();
  const state = now < OPEN ? "before" : now >= CLOSE ? "after" : "open";

  if (!ALWAYS_OPEN.includes(name) && !preview && state !== "open") {
    return new Response("발표 자료는 10.15(목) 00:00–18:00에만 볼 수 있습니다.", {
      status: 403,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-PDF-Lock": state,
        "X-Robots-Tag": "noindex",
      },
    });
  }

  const res = await next();
  const headers = new Headers(res.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("Content-Disposition", "inline");
  headers.set("X-Robots-Tag", "noindex");
  return new Response(res.body, { status: res.status, headers });
}
