(() => {
  const RESULTS_URL = './results.json';
  const POLL_MS = 15000;
  const DEFAULT_ROTATE_MS = 8000;
  const TARGET_ROWS_PER_PAGE = 7;
  const FLASH_MS = 1600;

  const el = (id) => document.getElementById(id);

  const viewport = el('viewport');
  const podiumScreen = el('screen-podium');
  const podiumWrap = el('podiumWrap');
  const screenDots = el('screenDots');
  const eventNameEl = el('eventName');
  const eventNoteEl = el('eventNote');
  const updatedAtEl = el('updatedAt');
  const clockEl = el('clock');
  const fetchStatusEl = el('fetchStatus');
  const teamCountEl = el('teamCount');
  const countdownTextEl = el('countdownText');
  const countdownFillEl = el('countdownFill');

  const panelTab = el('panelTab');
  const controlPanel = el('controlPanel');
  const panelClose = el('panelClose');
  const btnPrev = el('btnPrev');
  const btnNext = el('btnNext');
  const btnPodium = el('btnPodium');
  const btnPause = el('btnPause');
  const btnRefresh = el('btnRefresh');
  const rotateRange = el('rotateRange');
  const rotateVal = el('rotateVal');

  const state = {
    maxTotal: 0,
    teams: [],
    screens: [], // [{type:'podium', el}, {type:'rank', teams:[...], el}]
    currentIndex: 0,
    rotateMs: DEFAULT_ROTATE_MS,
    rotateTimer: null,
    countdownTimer: null,
    nextRotateAt: 0,
    paused: false,
    prevRank: new Map(),
    prevTotal: new Map(),
  };

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function fmtDateTime(iso) {
    if (!iso) return '-';
    try {
      return new Date(iso).toLocaleString('ko-KR', {
        hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  function tickClock() {
    clockEl.textContent = new Date().toLocaleTimeString('ko-KR', { hour12: false });
  }

  function paginate(list, targetMax) {
    if (list.length === 0) return [];
    const pages = Math.ceil(list.length / targetMax);
    const base = Math.floor(list.length / pages);
    const remainder = list.length - base * pages;
    const out = [];
    let idx = 0;
    for (let p = 0; p < pages; p++) {
      const size = base + (p === pages - 1 ? remainder : 0);
      out.push(list.slice(idx, idx + size));
      idx += size;
    }
    return out;
  }

  function computeStandings(json) {
    const criteria = json.criteria || [];
    const maxTotal = criteria.reduce((s, c) => s + (c.max || 0), 0);
    const teams = (json.teams || []).map((t) => {
      const total = criteria.reduce((s, c) => s + (Number(t.scores?.[c.key]) || 0), 0);
      return { ...t, total, pct: maxTotal ? (total / maxTotal) * 100 : 0 };
    });
    teams.sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      const at = a.submitted_at ? new Date(a.submitted_at).getTime() : Infinity;
      const bt = b.submitted_at ? new Date(b.submitted_at).getTime() : Infinity;
      if (at !== bt) return at - bt;
      return a.team.localeCompare(b.team);
    });
    teams.forEach((t, i) => { t.rank = i + 1; });
    return { criteria, maxTotal, teams };
  }

  function buildScreens(teams) {
    // Lowest-ranked group first, working up to the podium last: e.g. for 16
    // teams the order is 10-16위 -> 4-9위 -> TOP 3, building toward the reveal.
    const pages = paginate(teams.slice(3), TARGET_ROWS_PER_PAGE);
    const rankScreens = pages.map((page) => ({ type: 'rank', teams: page })).reverse();
    return [...rankScreens, { type: 'podium' }];
  }

  function medalFor(rank) {
    return rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';
  }

  function moveClassFor(team) {
    const prev = state.prevRank.get(team.team);
    if (prev === undefined) return '';
    if (prev > team.rank) return ' rank-up';
    if (prev < team.rank) return ' rank-down';
    return '';
  }

  function bumpClassFor(team) {
    const prev = state.prevTotal.get(team.team);
    return prev !== undefined && team.total > prev ? ' score-bump' : '';
  }

  function deltaMarkup(team) {
    const prev = state.prevRank.get(team.team);
    if (prev === undefined) return '<span class="delta new">NEW</span>';
    const diff = prev - team.rank;
    if (diff > 0) return `<span class="delta up">▲ ${diff}</span>`;
    if (diff < 0) return `<span class="delta down">▼ ${Math.abs(diff)}</span>`;
    return '';
  }

  function renderPodium(teams) {
    const top3 = teams.slice(0, 3);
    podiumWrap.innerHTML = top3.map((t) => `
      <div class="podium-card podium-${t.rank}${moveClassFor(t)}${bumpClassFor(t)}">
        <div class="medal">${medalFor(t.rank)}</div>
        <div class="rank-num">${t.rank}위</div>
        <div class="team-name">${escapeHtml(t.team)}</div>
        <div class="agent-name">${escapeHtml(t.agent || '')}</div>
        <div class="members">${escapeHtml((t.members || []).join(', '))}</div>
        <div class="score">${Math.round(t.total)}<small> / ${state.maxTotal}</small></div>
      </div>
    `).join('');
  }

  function renderRankScreen(container, teams) {
    const first = teams[0]?.rank ?? '';
    const last = teams[teams.length - 1]?.rank ?? '';
    container.innerHTML = `
      <h2 class="screen-title">순위 ${first} - ${last}</h2>
      <div class="rank-list">
        ${teams.map((t) => `
          <div class="rank-row${moveClassFor(t)}${bumpClassFor(t)}">
            <div class="rank-badge">${t.rank}</div>
            <div class="info">
              <div class="team-line">
                <span class="team-name">${escapeHtml(t.team)}</span>
                <span class="agent-name">${escapeHtml(t.agent || '')}</span>
                ${deltaMarkup(t)}
              </div>
              <div class="members">${escapeHtml((t.members || []).join(', '))}</div>
            </div>
            <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, t.pct).toFixed(1)}%"></div></div>
            <div class="score">${Math.round(t.total)}<small> /${state.maxTotal}</small></div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function rebuildDom() {
    viewport.querySelectorAll('.rank-screen').forEach((n) => n.remove());
    renderPodium(state.teams);
    state.screens.forEach((s, idx) => {
      if (s.type === 'podium') { s.el = podiumScreen; return; }
      const sec = document.createElement('section');
      sec.className = 'screen rank-screen';
      sec.dataset.screen = `rank-${idx}`;
      renderRankScreen(sec, s.teams);
      viewport.appendChild(sec);
      s.el = sec;
    });
    renderDots();
    applyActiveScreen();
    scheduleFlashClear();
  }

  function scheduleFlashClear() {
    setTimeout(() => {
      document.querySelectorAll('.rank-up, .rank-down, .score-bump').forEach((n) => {
        n.classList.remove('rank-up', 'rank-down', 'score-bump');
      });
    }, FLASH_MS);
  }

  function renderDots() {
    screenDots.innerHTML = state.screens.map((_, i) => `<span data-i="${i}"></span>`).join('');
  }

  function applyActiveScreen() {
    if (!state.screens.length) return;
    if (state.currentIndex >= state.screens.length) state.currentIndex = 0;
    state.screens.forEach((s, i) => {
      if (s.el) s.el.classList.toggle('active', i === state.currentIndex);
    });
    [...screenDots.children].forEach((d, i) => d.classList.toggle('active', i === state.currentIndex));
  }

  function goTo(index) {
    if (!state.screens.length) return;
    state.currentIndex = ((index % state.screens.length) + state.screens.length) % state.screens.length;
    applyActiveScreen();
  }

  function next() { goTo(state.currentIndex + 1); }
  function prev() { goTo(state.currentIndex - 1); }

  function startRotation() {
    stopRotation();
    restartCountdownVisual();
    if (state.paused) return;
    state.rotateTimer = setInterval(next, state.rotateMs);
  }

  function stopRotation() {
    if (state.rotateTimer) clearInterval(state.rotateTimer);
    state.rotateTimer = null;
  }

  function restartCountdownVisual() {
    clearInterval(state.countdownTimer);
    state.countdownTimer = null;

    if (state.paused) {
      countdownTextEl.textContent = '일시정지됨';
      countdownFillEl.style.animation = 'none';
      return;
    }

    state.nextRotateAt = Date.now() + state.rotateMs;
    countdownFillEl.style.animation = 'none';
    void countdownFillEl.offsetWidth; // force reflow so the animation restarts
    countdownFillEl.style.animation = `countdownDrain ${state.rotateMs}ms linear forwards`;

    updateCountdownText();
    state.countdownTimer = setInterval(updateCountdownText, 200);
  }

  function updateCountdownText() {
    const remainMs = state.nextRotateAt - Date.now();
    const remainSec = Math.max(0, Math.ceil(remainMs / 1000));
    countdownTextEl.textContent = `다음 화면까지 ${remainSec}초`;
  }

  async function fetchResults() {
    try {
      const res = await fetch(`${RESULTS_URL}?_=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      applyData(json);
      fetchStatusEl.textContent = `상태: 정상 (${new Date().toLocaleTimeString('ko-KR', { hour12: false })})`;
    } catch (err) {
      fetchStatusEl.textContent = `상태: 오류 - ${err.message}`;
    }
  }

  function applyData(json) {
    const { maxTotal, teams } = computeStandings(json);

    eventNameEl.textContent = json.event?.name || '해커톤 라이브 리더보드';
    eventNoteEl.textContent = json.event?.note || '';
    updatedAtEl.textContent = `마지막 갱신 ${fmtDateTime(json.event?.updated_at)}`;
    teamCountEl.textContent = `팀 수: ${teams.length}`;

    state.maxTotal = maxTotal;
    state.teams = teams;
    state.screens = buildScreens(teams);

    rebuildDom();

    state.prevRank = new Map(teams.map((t) => [t.team, t.rank]));
    state.prevTotal = new Map(teams.map((t) => [t.team, t.total]));
  }

  // ---- Hidden control panel wiring ----
  panelTab.addEventListener('click', () => { controlPanel.hidden = !controlPanel.hidden; });
  panelClose.addEventListener('click', () => { controlPanel.hidden = true; });
  btnPrev.addEventListener('click', () => { prev(); startRotation(); });
  btnNext.addEventListener('click', () => { next(); startRotation(); });
  btnPodium.addEventListener('click', () => {
    goTo(state.screens.findIndex((s) => s.type === 'podium'));
    startRotation();
  });
  btnPause.addEventListener('click', () => {
    state.paused = !state.paused;
    btnPause.textContent = state.paused ? '재생' : '일시정지';
    btnPause.classList.toggle('active-state', state.paused);
    if (state.paused) { stopRotation(); restartCountdownVisual(); } else { startRotation(); }
  });
  btnRefresh.addEventListener('click', fetchResults);
  rotateRange.addEventListener('input', () => {
    state.rotateMs = Number(rotateRange.value) * 1000;
    rotateVal.textContent = rotateRange.value;
    startRotation();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'p' || e.key === 'P') controlPanel.hidden = !controlPanel.hidden;
    if (e.key === 'ArrowRight') { next(); startRotation(); }
    if (e.key === 'ArrowLeft') { prev(); startRotation(); }
    if (e.key === ' ') { e.preventDefault(); btnPause.click(); }
  });

  // ---- Boot ----
  tickClock();
  setInterval(tickClock, 1000);
  fetchResults();
  setInterval(fetchResults, POLL_MS);
  startRotation();
})();
