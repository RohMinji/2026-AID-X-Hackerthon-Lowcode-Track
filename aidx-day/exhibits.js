/* =====================================================================
   전시 데이터 — 메인 페이지(전시 목록)와 agenda01~29 상세 페이지가 함께 써요.
   이 파일만 고치면 목록과 상세 페이지에 모두 반영돼요.

   id      : 상세 페이지 주소 = 리플릿 전시 번호 (agenda01 → https://aidxday.pages.dev/agenda01)
   part    : 아래 PARTS의 키 (works / biz / innovation / tech)
   label   : 제목 앞 말머리 (예: "Garage") — 선택
   title   : 전시 제목 (여러 개면 ["(1) ...", "(2) ..."] 배열로)
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
const EXHIBIT_HOURS = "10.15 (목) 10:00–17:00";

// 출처: (260923) AID-X DAY 리플릿 아젠다리스트 — 테이블보드 '제목(최종확정)'
const EXHIBITS = [
  // ---------------- Innovation (7) ----------------
  { id: "agenda01", part: "innovation", org: "IT부문", team: "IT플랫폼본부",
    title: "휴머노이드 Physical AI: 제조·물류AX를 위한 Robot Skill 학습·현장 적용 Flywheel" },
  { id: "agenda02", part: "innovation", org: "IT부문", team: "IT플랫폼본부",
    title: "정비/보증 AX Agent Pack(feat. Glasses): 연결부터 예측·정비·학습까지, Full Cycle AX" },
  { id: "agenda03", part: "innovation", org: "IT부문", team: "AX플랫폼본부",
    title: "UAM 교통관리 AX 플랫폼: UAM Agent 기반 도심항공 관제체계 혁신" },
  { id: "agenda04", part: "innovation", org: "KT m&s", team: "KT m&s",
    title: "KT m&s 유통 AX 혁신" },
  { id: "agenda05", part: "innovation", org: "kt genie music", team: "kt genie music",
    title: "AX 기반 글로벌 음악 콘텐츠 매출 인텔리전스" },
  { id: "agenda06", part: "innovation", org: "Microsoft", team: "Microsoft",
    title: "Copilot 시나리오 플레이어" },
  { id: "agenda07", part: "innovation", org: "Microsoft", team: "Microsoft",
    title: "MS Foundry agent를 통해 Microsoft IQ 활용하기" },

  // ---------------- Biz (9) ----------------
  { id: "agenda08", part: "biz", org: "IT부문", team: "IT플랫폼본부",
    title: "AI, 고객의 목소리를 듣다: 다양한 채널의 고객 이슈와 개선 요구 발굴" },
  { id: "agenda09", part: "biz", org: "IT부문", team: "IT플랫폼본부",
    title: "태양광 발전량 예측 모델 개발 & 24시간 취약점 · 오픈소스 대응 Agent" },
  { id: "agenda10", part: "biz", org: "Enterprise부문/IT부문", team: "Enterprise전략본부 · IT플랫폼본부",
    title: "AX B2B 사업혁신 - AI Agent로 B2B 영업·마케팅·고객접점을 E2E로 혁신" },
  { id: "agenda11", part: "biz", org: "IT부문", team: "AX플랫폼본부",
    title: "MAGMA BIDW: ‘찾는’ 분석에서 ‘AI에게 묻는’ 분석으로" },
  { id: "agenda12", part: "biz", org: "AX미래기술원/IT부문", team: "Agentic AI Lab · AX플랫폼본부",
    title: "더 똑똑해진 마이케이티 AI Agent (마이 AI)" },
  { id: "agenda13", part: "biz", org: "AX미래기술원", team: "Agentic AI Lab",
    title: "취향까지 이해하는 지니 TV: Evolving Persona" },
  { id: "agenda14", part: "biz", org: "AX미래기술원", team: "Agentic AI Lab",
    title: "'암묵지와 Agentic AI' 기반 산업특화 AX (특허/수주전략/공공)" },
  { id: "agenda15", part: "biz", org: "AX미래기술원", team: "Frontier AI Lab",
    title: "믿을수 있는 안전한 통합 AI 가드레일 (토큰팩토리)" },
  { id: "agenda16", part: "biz", org: "AX미래기술원", team: "Frontier AI Lab",
    title: "N2SF 대응을 위한 AI보안 솔루션 (PRIBIT AI)" },

  // ---------------- Tech (7) ----------------
  { id: "agenda17", part: "tech", org: "정보보안실", team: "정보보안기획그룹",
    title: "KRONOS - AI 보안 진단 플랫폼" },
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
    title: "kode: - 기획부터 설계/개발 그리고 자산화까지 , AI 네이티브 개발 플랫폼" },
  { id: "agenda25", part: "works", org: "IT부문", team: "AX플랫폼본부",
    title: "KDS AI: KDS 기반으로 기획, 디자인, 개발을 AI로 연계해 프로젝트 생산성 향상" },
  { id: "agenda26", part: "works", org: "IT부문", team: "AX플랫폼본부",
    title: "AX Works, 전사 AI·Agent 활용을 위한 통합 플랫폼" },
  { id: "agenda27", part: "works", org: "KTDS", team: "KTDS ICT AX사업본부",
    title: "AgentOps 거버넌스플랫폼 Metis.AI" },
  { id: "agenda28", part: "works", org: "KTDS", team: "KTDS Cloud사업본부",
    title: "AI로 완성하는 코드 전환, Auto Builder" },
  { id: "agenda29", part: "works", org: "IT부문", team: "IT플랫폼본부",
    title: "AI Agent 기반 장애 관리 플랫폼" },
];

// 별도 전시 · AX Tech Connect (8F) — 상세 페이지 없이 목록만 보여줘요. place가 있으면 장소 표시
const TECH_CONNECT = {
  name: "AX Tech Connect", place: "KT 판교 빌딩 8F", color: "#f2c46d",
  items: [
    { title: "토큰팩토리", place: "전략회의실" },
    { title: "KT AI 경쟁력 믿:음 K 3.0 / Arena", place: "교육장" },
    { title: "차세대 음성 에이전트 Full-Duplex Speech to Speech" },
    { title: "나만의 1:1 Agent KT-Claw (모두의 AI)" },
    { title: "소상공인 맞춤상담 Agent (모두의 AI)" },
    { title: "프롬프트 압축 KompaKT (토큰팩토리)" },
    { title: "최적의 AI 선택 Model Router (토큰팩토리)" },
    { title: "데이터 의미를 이해하는 KT Ontology 구축" },
    { title: "연결된 지식을 분석하는 KT Ontology 활용" },
    { title: "Agentic On 적용 핵심기술" },
    { title: "AI 모델 품질 자동 평가 플랫폼 (AEGIS)" },
    { title: "문서 조각을 잇는 지도 (DocuMap)" },
    { title: "임상 데이터 정밀진단 의료 특화 모델" },
  ],
};

// 화면 표시용 도우미 (목록·상세 페이지 공통)
const exTitles = e => Array.isArray(e.title) ? e.title : [e.title];
const exTitleText = e => (e.label ? `[${e.label}] ` : "") + exTitles(e).join(" / ");
const exTeam = e => e.team;
const exNo = e => e.id.replace(/\D/g, "");
