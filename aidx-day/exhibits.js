/* =====================================================================
   전시 데이터 — 메인 페이지(전시 목록)와 agenda01~29 상세 페이지가 함께 써요.
   이 파일만 고치면 목록과 상세 페이지에 모두 반영돼요.

   id      : 상세 페이지 주소 = 리플릿 전시 번호 (agenda01 → https://aidxday.pages.dev/agenda01)
   part    : 아래 PARTS의 키 (works / biz / innovation / tech)
   label   : 제목 앞 말머리 (예: "Garage") — 선택
   title   : 전시 제목 (여러 개면 ["(1) ...", "(2) ..."] 배열로)
   sub     : 부제목 — 제목 아래 작고 가는 글씨로 보여요 (선택)
   ※ 제목·부제목 안의 \n 은 화면에서 줄바꿈돼요
   team    : 사이트에 보이는 담당 조직 (리플릿 테이블보드의 본부/조직)
   org     : 담당 부문 (기록용, 화면에는 안 보여요)
   ── 아래는 준비되는 대로 채우면 돼요. 비어 있으면 화면에서 숨기거나 '준비 중'으로 보여요.
   summary : 목록에 보이는 한 줄 소개
   desc    : 상세 페이지 본문 (문단 배열)
   points  : 핵심 포인트 (목록)
   booth   : 부스 번호 (예: "A-01")
   demo    : 시연 시간 (예: ["10.14 14:00"])
   tags    : 태그
   contact : 문의
   link    : 관련 자료 링크
   image   : 대표 이미지 주소 (예: "img/agenda01.jpg")
   ===================================================================== */

// true로 두면 상세 페이지 위쪽에 EXHIBIT_NOTICE 안내 띠가 보여요
const EXHIBIT_SAMPLE = false;
const EXHIBIT_NOTICE = "전시별 상세 소개는 곧 업데이트돼요.";

// 목록에 보이는 순서대로 적어요 (리플릿: Innovation > Biz > Tech > Work)
const PARTS = {
  innovation: { name: "Innovation", color: "#e27bff", icon: "img/star.webp" },
  biz:        { name: "Biz",        color: "#a88bff", icon: "img/ring.webp" },
  tech:       { name: "Tech",       color: "#ff8fc7", icon: "img/layers.webp" },
  works:      { name: "Work",       color: "#6f95ff", icon: "img/cursor.webp" },
};

const EXHIBIT_PLACE = "KT 판교 빌딩 1F";
const EXHIBIT_HOURS = "10.15 (목) 09:00–16:00";

// 출처: (260923) AID-X DAY 리플릿 아젠다리스트 — 테이블보드 '제목(최종확정)'
const EXHIBITS = [
  // ---------------- Innovation (7) ----------------
  { id: "agenda01", part: "innovation", org: "IT부문", team: "IT플랫폼본부",
    title: "휴머노이드 Physical AI 학습•적용 모델", sub: "제조•물류 AX Robot Skill Flywheel" },
  { id: "agenda02", part: "innovation", org: "IT부문", team: "IT플랫폼본부",
    title: "차량정비/보증 AX Agent Pack(feat. Glasses)", sub: "연결부터 예측·정비·학습까지, Full Cycle AX" },
  { id: "agenda03", part: "innovation", org: "IT부문", team: "AX플랫폼본부",
    title: "UAM 교통관리 AX플랫폼", sub: "UAM Agent 기반 도심항공 관제체계 혁신" },
  { id: "agenda04", part: "innovation", org: "그룹사", team: "KT m&s",
    title: "KT m&s 유통 AX 혁신" },
  { id: "agenda05", part: "innovation", org: "그룹사", team: "kt genie music",
    title: "AX기반 글로벌 음악 콘텐츠 매출 인텔리전스" },
  { id: "agenda06", part: "innovation", org: "협력사", team: "Microsoft",
    title: "Copilot 시나리오 플레이어" },
  { id: "agenda07", part: "innovation", org: "협력사", team: "Microsoft",
    title: "MS Foundry Agent를 통해 Microsoft IQ 활용하기" },

  // ---------------- Biz (9) ----------------
  { id: "agenda08", part: "biz", org: "IT부문", team: "IT플랫폼본부",
    title: "AI, 고객의 목소리를 듣다", sub: "다양한 채널의 고객 이슈와 개선 요구 발굴" },
  { id: "agenda09", part: "biz", org: "IT부문", team: "IT플랫폼본부",
    title: "태양광 발전량 예측 모델 개발 & 24시간 취약점 · 오픈소스 대응 Agent" },
  { id: "agenda10", part: "biz", org: "Enterprise부문/IT부문", team: "Enterprise전략본부 · IT플랫폼본부",
    title: "AX B2B 사업혁신", sub: "AI Agent로 B2B 영업·마케팅·고객접점을 E2E로 혁신" },
  { id: "agenda11", part: "biz", org: "IT부문", team: "AX플랫폼본부",
    title: "MAGMA BIDW", sub: "‘찾는’ 분석에서 ‘AI에게 묻는’ 분석으로" },
  { id: "agenda12", part: "biz", org: "AX미래기술원/IT부문", team: "Agentic AI Lab · AX플랫폼본부",
    title: "Orchestrator 기술로 더 똑똑해진\n마이케이티 AI Agent" },
  { id: "agenda13", part: "biz", org: "AX미래기술원", team: "Agentic AI Lab",
    title: "취향까지 이해하는 지니 TV : Evolving Persona" },
  { id: "agenda14", part: "biz", org: "AX미래기술원", team: "Agentic AI Lab",
    title: "암묵지와 Agentic AI 기반 산업특화 AX (특허/수주전략/공공)" },
  { id: "agenda15", part: "biz", org: "AX미래기술원", team: "Frontier AI Lab",
    title: "믿을 수 있는 안전한 통합 AI 가드레일 (토큰팩토리)" },
  { id: "agenda16", part: "biz", org: "AX미래기술원", team: "Frontier AI Lab",
    title: "N2SF 대응을 위한 AI보안 솔루션 (PRIBIT AI)" },

  // ---------------- Tech (7) ----------------
  { id: "agenda17", part: "tech", org: "정보보안실", team: "정보보안기획그룹",
    title: "KRONOS : AI 보안 진단 플랫폼" },
  { id: "agenda18", part: "tech", org: "AX미래기술원", team: "Frontier AI Lab",
    title: "Edge AI 기반 Physical AI 핵심기술" },
  { id: "agenda19", part: "tech", org: "네트워크부문", team: "미래네트워크Lab",
    title: "6G" },
  { id: "agenda20", part: "tech", org: "네트워크부문", team: "미래네트워크Lab",
    title: "Quantum Security" },
  { id: "agenda21", part: "tech", org: "네트워크부문", team: "미래네트워크Lab",
    title: "Autonomous Operation: ① AI Operator" },
  { id: "agenda22", part: "tech", org: "네트워크부문", team: "미래네트워크Lab",
    title: "Autonomous Operation: ② Infra Robot" },
  { id: "agenda23", part: "tech", org: "네트워크부문", team: "미래네트워크Lab",
    title: "고객·네트워크 보호" },

  // ---------------- Work (6) ----------------
  { id: "agenda24", part: "works", org: "IT부문", team: "IT전략본부",
    title: "kode: series- 기획부터 설계/개발 그리고 자산화까지,\nAI 네이티브 개발 플랫폼" },
  { id: "agenda25", part: "works", org: "IT부문", team: "AX플랫폼본부",
    title: "AI로 하는 디자인", sub: "KDS(KT Design System) 기반 기획-디자인-개발을\nAI로 연계해 생산성 향상" },
  { id: "agenda26", part: "works", org: "IT부문", team: "AX플랫폼본부",
    title: "AX Works, 전사 AI·Agent 활용을 위한 통합 플랫폼" },
  { id: "agenda27", part: "works", org: "그룹사", team: "kt ds",
    title: "AgentOps 거버넌스플랫폼 Metis.AI" },
  { id: "agenda28", part: "works", org: "그룹사", team: "kt ds",
    title: "AI로 완성하는 코드 전환, Auto Builder" },
  { id: "agenda29", part: "works", org: "IT부문", team: "IT플랫폼본부",
    title: "AI Agent 기반 장애 분석 플랫폼" },
];

// AX Tech Connect (8F) — agenda30~ 상세 페이지가 있어요. place가 있으면 장소 표시
const TECH_CONNECT = {
  name: "AX Tech Connect", place: "KT 판교 빌딩 8F", color: "#f2c46d", icon: "img/ring.webp",
  items: [
    { id: "agenda30", title: "KT AI 경쟁력 믿:음 K 3.0 / Arena", team: "Frontier AI Lab · Agentic AI Lab" },
    { id: "agenda31", title: "차세대 음성 에이전트 Full-Duplex Speech to Speech", team: "Frontier AI Lab" },
    { id: "agenda32", title: "나만의 1:1 Agent KT-Claw (모두의 AI)", team: "Agentic AI Lab" },
    { id: "agenda33", title: "소상공인 맞춤상담 Agent (모두의 AI)", team: "Agentic AI Lab" },
    { id: "agenda34", title: "프롬프트 압축 KompaKT (토큰팩토리)", team: "Agentic AI Lab" },
    { id: "agenda35", title: "최적의 AI 선택 Model Router (토큰팩토리)", team: "Agentic AI Lab" },
    { id: "agenda36", title: "기업의 데이터 의미를 이해하는 KT Ontology 구축", team: "AX Data Lab · Agentic AI Lab" },
    { id: "agenda37", title: "기업의 업무를 실행하는 KT Ontology 활용", team: "Agentic AI Lab · AX Data Lab" },
    { id: "agenda38", title: "통합 AI 평가 플랫폼 (AEGIS)", team: "Frontier AI Lab" },
    { id: "agenda39", title: "문서 조각을 잇는 지도 (DocuMap)", team: "Frontier AI Lab" },
    { id: "agenda40", title: "임상 데이터 정밀진단 의료 특화 모델", team: "Agentic AI Lab" },
  ],
};

// 상세 페이지용 전체 목록: 1F 전시 + AX Tech Connect
const ALL_EXHIBITS = [...EXHIBITS, ...TECH_CONNECT.items.map(x => ({ ...x, part: "connect", team: x.team || "" }))];

// 화면 표시용 도우미 (목록·상세 페이지 공통)
const exTitles = e => Array.isArray(e.title) ? e.title : [e.title];
const flat = t => t.replace(/\s*\n\s*/g, " ");
const exTitleMain = e => flat((e.label ? `[${e.label}] ` : "") + exTitles(e).join(" / "));
const exTitleText = e => exTitleMain(e) + (e.sub ? " " + flat(e.sub) : "");  // 페이지 제목·미리보기용 (부제목 포함)
const exTeam = e => e.team;
// 화면에 보이는 번호 = 분류 안에서의 순서 (Innovation 01, Tech 01 …). 링크 주소(id)와는 별개예요
const exNo = e => {
  const part = ALL_EXHIBITS.find(x => x.id === e.id).part;
  return String(ALL_EXHIBITS.filter(x => x.part === part).findIndex(x => x.id === e.id) + 1).padStart(2, "0");
};
