/* =====================================================================
   전시 데이터 — 메인 페이지(전시 목록)와 agenda01~28 상세 페이지가 함께 써요.
   이 파일만 고치면 목록과 상세 페이지에 모두 반영돼요.

   id      : 상세 페이지 주소 (agenda01 → https://aidxday.pages.dev/agenda01)
   part    : 아래 PARTS의 키 (works / biz / innovation / tech)
   label   : 제목 앞 말머리 (예: "Garage") — 선택
   title   : 전시 제목 (여러 개면 ["(1) ...", "(2) ..."] 배열로)
   team    : 사이트에 보이는 담당 조직 (표의 '사이트입력용')
   org     : 담당 부서 (기록용, 화면에는 안 보여요)
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

// 전시 위치·운영 시간이 아직 확정 전이면 true로 두세요 (상단에 안내 띠가 보여요)
const EXHIBIT_SAMPLE = true;
const EXHIBIT_NOTICE = "전시 위치·운영 시간은 예시예요. 전시별 상세 소개는 곧 업데이트돼요.";

const PARTS = {
  works:      { name: "Works",      color: "#35e0ff" },
  biz:        { name: "Biz",        color: "#ffb35c" },
  innovation: { name: "Innovation", color: "#a58bff" },
  tech:       { name: "Tech",       color: "#35ffa0" },
};

const EXHIBIT_PLACE = "1F 전시홀";
const EXHIBIT_HOURS = "10.14 (수) 13:00–17:00 · 10.15 (목) 10:00–15:00";

const EXHIBITS = [
  // ---------------- Works (6) ----------------
  { id: "agenda01", part: "works", org: "IT부문", team: "IT전략",
    title: "kode:crew + kode:harness" },
  { id: "agenda02", part: "works", org: "IT부문", team: "AX플랫폼",
    title: "KDS 2.0 기반 AI디자인 파이프라인 구축과 바이브코딩 개발 가속화" },
  { id: "agenda03", part: "works", org: "IT부문", team: "AX플랫폼",
    title: "Enterprise AI Agent Platform ‘AX Works’ 구축 사례" },
  { id: "agenda04", part: "works", org: "그룹사", team: "KTDS",
    title: "Metis" },
  { id: "agenda05", part: "works", org: "그룹사", team: "KTDS",
    title: "Auto Builder" },
  { id: "agenda06", part: "works", org: "Microsoft", team: "Microsoft",
    title: "Enterprise AI/Agent Transformation의 흐름과 Best Practice" },

  // ---------------- Biz (9) ----------------
  { id: "agenda07", part: "biz", org: "IT부문", team: "IT플랫폼", label: "Garage",
    title: "AI, 고객의 목소리를 듣다 (앱 리뷰와 VoC분석을 통한 서비스 개선사례)" },
  { id: "agenda08", part: "biz", org: "IT부문", team: "IT플랫폼", label: "Garage",
    title: ["(1) Loop Engineering 기반 모델 분석·설계–개발–검증을 잇는 단일 순환 체계 구축",
            "(2) Github Cloud Agent를 활용한 개발업무 AX 전환"] },
  { id: "agenda09", part: "biz", org: "IT부문", team: "AX플랫폼",
    title: "MAGMA BIDW" },
  { id: "agenda10", part: "biz", org: "Enterprise부문", team: "E부문",
    title: "B2B 사업지원 프로젝트 (B2B세일즈Agent, B2B통합마케팅플랫폼 등)" },
  { id: "agenda11", part: "biz", org: "AX미래기술원", team: "Agentic AI Lab",
    title: "믿음 Arena (믿음 K3.0 Pro/ 독파모 비교), Agentic AICC (Sound AI)" },
  { id: "agenda12", part: "biz", org: "AX미래기술원", team: "Frontier AI Lab",
    title: "Agentic AICC_Sound AI (믿:음 SLM 2.0 (Full Duplex Speech To Speech)" },
  { id: "agenda13", part: "biz", org: "AX미래기술원", team: "Agentic AI Lab",
    title: "산업특화 AX (공공/의료/금융/특허)" },
  { id: "agenda14", part: "biz", org: "AX미래기술원", team: "Agentic AI Lab",
    title: "외부협력(리벨리온) NPU 서빙박스 믿:음 K 2.5 Pro 모델 전시" },
  { id: "agenda15", part: "biz", org: "AX미래기술원", team: "Agentic AI Lab",
    title: "외부협력(PRIVIT AI) Appliance 솔루션에 KT 가드레일을 탑재" },

  // ---------------- Innovation (6) ----------------
  { id: "agenda16", part: "innovation", org: "IT부문", team: "IT플랫폼",
    title: "휴머노이드 Physical AI개발" },
  { id: "agenda17", part: "innovation", org: "IT부문", team: "IT플랫폼",
    title: "Manufacturing AX Agent Pack(with Glasses)" },
  { id: "agenda18", part: "innovation", org: "IT부문", team: "AX플랫폼",
    title: "AX기반 UAM개발(UAM Agent)" },
  { id: "agenda19", part: "innovation", org: "IT부문", team: "IT플랫폼",
    title: "AI/ChatOps운영자 포탈" },
  { id: "agenda20", part: "innovation", org: "그룹사", team: "KT m&s",
    title: "KT m&s 유통혁신AX" },
  { id: "agenda21", part: "innovation", org: "그룹사", team: "kt genie music",
    title: "AX 기반 음원 매출 인사이트 시스템" },

  // ---------------- Tech (7) ----------------
  { id: "agenda22", part: "tech", org: "정보보안실", team: "정보보안실",
    title: "KRONOS: AI Pentest Agent" },
  { id: "agenda23", part: "tech", org: "네트워크부문", team: "네트워크부문",
    title: "6G" },
  { id: "agenda24", part: "tech", org: "네트워크부문", team: "네트워크부문",
    title: "Quantum security" },
  { id: "agenda25", part: "tech", org: "네트워크부문", team: "네트워크부문",
    title: "AI Edge" },
  { id: "agenda26", part: "tech", org: "네트워크부문", team: "네트워크부문",
    title: "Anti Fraud" },
  { id: "agenda27", part: "tech", org: "네트워크부문", team: "네트워크부문",
    title: "OSP" },
  { id: "agenda28", part: "tech", org: "AX미래기술원", team: "AX미래기술원",
    title: "Agentic On (AX사업부문 협업)" },
];

// 화면 표시용 도우미 (목록·상세 페이지 공통)
const exTitles = e => Array.isArray(e.title) ? e.title : [e.title];
const exTitleText = e => (e.label ? `[${e.label}] ` : "") + exTitles(e).join(" / ");
const exTeam = e => e.team;
const exNo = e => e.id.replace(/\D/g, "");
