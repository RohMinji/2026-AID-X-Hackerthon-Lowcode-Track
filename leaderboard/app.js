(() => {
  const { escapeHtml, computeStandings, diffStandings, resolveSnapshots, teamKey, withRoster } = window.Leaderboard;

  // The board reads published.json (written by the admin page). Scores in it
  // stay hidden until its `reveal_at`; until then the previous snapshot is
  // what's on screen. agents.json holds the agent intro copy.
  const RESULTS_URL = './published.json';
  const AGENTS_URL = './agents.json';
  const POLL_MS = 15000;
  const SCREEN_MS = 10000;

  // Timeline of one hour: from :40 until the reveal the board shows the
  // "scoring" screens; for 30 minutes after a reveal it shows what changed;
  // the rest of the time it shows the current standings.
  const WAIT_START_MINUTE = 40;
  const WAIT_LEAD_MS = 20 * 60 * 1000;
  const REVEAL_WINDOW_MS = 30 * 60 * 1000;

  const STATUS_ROWS_PER_PAGE = 7;
  const REVEAL_PAGES = 3;
  const TOP_N = 7;

  const IMG = {
    ai: 'assets/ai.png',
    layers: 'assets/layers.png',
    cursor: 'assets/cursor.png',
    ring: 'assets/ring.png',
    sparkle: 'assets/sparkle.png',
  };

  const MODE_LABEL = { wait: '채점 중', reveal: '점수 공개', status: 'LIVE' };

  const el = (id) => document.getElementById(id);
  const stage = el('stage');
  const viewport = el('viewport');
  const screenDots = el('screenDots');
  const eventNameEl = el('eventName');
  const modeLabelEl = el('modeLabel');
  const clockEl = el('clock');
  const updatedAtEl = el('updatedAt');
  const countdownTextEl = el('countdownText');
  const countdownFillEl = el('countdownFill');
  const fetchStatusEl = el('fetchStatus');
  const scheduleStatusEl = el('scheduleStatus');

  const panelTab = el('panelTab');
  const controlPanel = el('controlPanel');
  const panelClose = el('panelClose');
  const modeSelect = el('modeSelect');
  const btnPrev = el('btnPrev');
  const btnNext = el('btnNext');
  const btnPause = el('btnPause');
  const btnRefresh = el('btnRefresh');

  const params = new URLSearchParams(window.location.search);
  const DEMO = params.has('demo');
  const DEMO_REVEAL_AT = Date.now();

  const state = {
    raw: null,
    rawText: '',
    agents: {},
    override: ['wait', 'reveal', 'status'].includes(params.get('mode')) ? params.get('mode') : 'auto',
    modeKey: '',
    dataKey: '',
    view: null, // { mode, target, visible, previous, revealAt }
    screens: [],
    index: 0,
    nextAt: 0,
    paused: false,
  };
  modeSelect.value = state.override;

  // ---------- formatting ----------

  function fmtScore(v) {
    const r = Math.round(Number(v) * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
  }

  function fmtDelta(v) {
    const r = Math.round(Number(v) * 10) / 10;
    if (r > 0) return `+${fmtScore(r)}`;
    if (r < 0) return `−${fmtScore(Math.abs(r))}`;
    return '±0';
  }

  function fmtHM(ms) {
    return new Date(ms).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  function fmtRemain(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }

  function nextTopOfHour(t) {
    const d = new Date(t);
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    return d.getTime();
  }

  function deco(list) {
    return list.map(([name, pos]) => `<img class="deco ${pos}" src="${IMG[name]}" alt="">`).join('');
  }

  function medal(rank) {
    return `<span class="medal${rank <= 3 ? ` m${rank}` : ''}">${rank}</span>`;
  }

  const TYPE_LABEL = { agentic: 'Agentic', workflow: 'Workflow' };

  // Members when agents.json lists them, otherwise the agent type.
  function members(t) {
    if ((t.members || []).length) return escapeHtml(t.members.join(', '));
    return escapeHtml(TYPE_LABEL[t.agent_type] || t.agent_type || '');
  }

  // The agent name shown next to the team name; hidden while the team has no
  // name of its own yet (agents.json empty) and both would read the same.
  function agentOf(t) {
    return t.agent && t.agent !== t.team ? t.agent : '';
  }

  function teamLine(t) {
    const parts = [agentOf(t) ? escapeHtml(t.team) : '', members(t)].filter(Boolean);
    return parts.join(' · ');
  }

  function count(from, to, { dec = true, delay = 0 } = {}) {
    const shown = dec ? fmtScore(from) : String(from);
    return `<span class="count" data-from="${from}" data-to="${to}" data-dec="${dec ? 1 : 0}" data-delay="${delay}">${shown}</span>`;
  }

  function paginate(list, pages) {
    if (!list.length) return [];
    const n = Math.min(pages, list.length);
    const base = Math.floor(list.length / n);
    const remainder = list.length - base * n;
    const out = [];
    let idx = 0;
    for (let p = 0; p < n; p++) {
      const size = base + (p === n - 1 ? remainder : 0);
      out.push(list.slice(idx, idx + size));
      idx += size;
    }
    return out;
  }

  function rangeLabel(teams) {
    const first = teams[0].rank;
    const last = teams[teams.length - 1].rank;
    return first === last ? `${first}위` : `${first}–${last}위`;
  }

  // ---------- mode ----------

  function computeView(t) {
    const raw = state.raw || {};
    const snap = resolveSnapshots(raw, t);
    const base = {
      visible: withRoster(snap.visible, state.agents),
      previous: withRoster(snap.previous, state.agents),
      revealAt: snap.revealAt,
    };
    const waitTarget = snap.pending ? snap.revealAt : nextTopOfHour(t);
    const minute = new Date(t).getMinutes();

    let mode;
    if (state.override !== 'auto') {
      mode = state.override;
    } else if (snap.pending) {
      mode = (snap.revealAt - t <= WAIT_LEAD_MS || minute >= WAIT_START_MINUTE) ? 'wait' : 'status';
    } else if (snap.revealAt !== null && t < snap.revealAt + REVEAL_WINDOW_MS) {
      mode = 'reveal';
    } else {
      mode = minute >= WAIT_START_MINUTE ? 'wait' : 'status';
    }

    // Nothing has ever been revealed: there is no board to show yet.
    if (mode !== 'wait' && !(snap.visible && (snap.visible.teams || []).length)) mode = 'wait';

    return { ...base, mode, target: mode === 'wait' ? waitTarget : null };
  }

  // ---------- screens ----------

  function waitScreens(view) {
    const target = view.target;
    return [
      {
        label: '채점 중',
        html: () => `
          ${deco([['layers', 'd-left'], ['sparkle', 'd-top-right'], ['cursor', 'd-bottom-right-sm']])}
          <div class="hero">
            <div class="eyebrow">SCORING IN PROGRESS</div>
            <h2 class="hero-title">채점 중</h2>
            <p class="hero-sub">에이전트들의 최신 결과를 채점하고 있어요</p>
            <div class="scan"><span></span></div>
            <div class="hero-note">다음 점수 공개 <strong>${fmtHM(target)}</strong></div>
          </div>`,
      },
      {
        label: '공개 예정',
        html: () => `
          ${deco([['ring', 'd-right'], ['ai', 'd-bottom-left-sm'], ['sparkle', 'd-top-left-sm']])}
          <div class="hero">
            <div class="eyebrow">NEXT LEADERBOARD</div>
            <div class="hero-time">${fmtHM(target)}</div>
            <h2 class="hero-title sm">새로운 점수 공개 예정</h2>
            <div class="hero-countdown">공개까지 <strong data-countdown-to="${target}">${fmtRemain(target - Date.now())}</strong></div>
          </div>`,
      },
    ];
  }

  function revealScreens(view) {
    const curr = computeStandings(view.visible);
    const prev = view.previous ? computeStandings(view.previous) : null;
    const diff = diffStandings(prev ? prev.teams : [], curr.teams).map((t) => ({
      ...t,
      delta: t.prevTotal === null ? null : t.total - t.prevTotal,
    }));
    const basis = view.revealAt !== null ? fmtHM(view.revealAt) : fmtHM(Date.now());
    const round = view.visible.event && view.visible.event.round;

    const screens = [{
      label: '공개',
      html: () => `
        ${deco([['ai', 'd-left'], ['ring', 'd-right-sm'], ['sparkle', 'd-top-right'], ['sparkle', 'd-bottom-left-xs']])}
        <div class="hero">
          <div class="eyebrow">NEW LEADERBOARD</div>
          <h2 class="hero-title">새로운 리더보드를<br>공개합니다!</h2>
          <div class="hero-pill">${round ? `${round}회차 · ` : ''}${basis} 점수 기준</div>
        </div>`,
    }];

    // Lowest group first, building up to the top of the table.
    paginate(diff, REVEAL_PAGES).reverse().forEach((page) => {
      screens.push({
        label: rangeLabel(page),
        html: () => revealRankPage(page, curr.maxTotal),
      });
    });

    const withDelta = diff.filter((t) => t.delta !== null);
    if (withDelta.length) {
      const byGain = (a, b) => (b.delta - a.delta) || (a.rank - b.rank);
      const entered = withDelta.filter((t) => t.rank <= TOP_N && t.prevRank > TOP_N).sort(byGain);
      const rising = entered.length ? entered : withDelta.filter((t) => t.rank <= TOP_N).sort(byGain);
      screens.push({
        label: '라이징 스타',
        html: () => spotlight({
          eyebrow: 'RISING STAR',
          title: '떠오르는 라이징 스타 어디?',
          sub: entered.length
            ? `Top ${TOP_N}에 새로 진입한 팀 중 점수가 가장 많이 오른 팀`
            : `이번에는 Top ${TOP_N}에 새로 진입한 팀이 없어요 · Top ${TOP_N} 중 가장 많이 오른 팀`,
          list: rising.slice(0, 3),
          art: 'cursor',
        }),
      });
      screens.push({
        label: '다크호스',
        html: () => spotlight({
          eyebrow: 'DARK HORSE',
          title: '다크호스는 어디?',
          sub: '전체 팀 중 점수가 가장 많이 오른 팀',
          list: [...withDelta].sort(byGain).slice(0, 3),
          art: 'layers',
        }),
      });
    }
    return screens;
  }

  function moveBadge(t) {
    if (t.change === 'new') return '<span class="move new">NEW</span>';
    if (t.change === 'up') return `<span class="move up">▲ ${t.rankDiff}</span>`;
    if (t.change === 'down') return `<span class="move down">▼ ${Math.abs(t.rankDiff)}</span>`;
    return '<span class="move same">–</span>';
  }

  function revealRankPage(page, maxTotal) {
    return `
      <div class="screen-head">
        <div class="eyebrow">RANK CHANGES</div>
        <h2 class="screen-title">순위 변동 <span>${rangeLabel(page)}</span></h2>
      </div>
      <div class="rk-list">
        ${page.map((t, i) => {
          const delay = 500 + i * 140;
          const fromRank = t.prevRank ?? t.rank;
          return `
          <div class="rk-row is-${t.change}" style="--i:${i}">
            <div class="rk-rank">${count(fromRank, t.rank, { dec: false, delay })}</div>
            <div class="rk-move">${moveBadge(t)}</div>
            <div class="rk-info">
              <div class="rk-team">${escapeHtml(t.team)}<span class="rk-agent">${escapeHtml(agentOf(t))}</span></div>
              <div class="rk-members">${members(t)}</div>
            </div>
            <div class="rk-path">${t.prevRank !== null ? `${t.prevRank}위 <i>→</i> <b>${t.rank}위</b>` : `<b>${t.rank}위</b> 첫 진입`}</div>
            <div class="rk-score">
              <div class="rk-total">${count(t.prevTotal ?? t.total, t.total, { delay })}<small>/${maxTotal}</small></div>
              ${t.delta !== null ? `<div class="rk-delta ${t.delta > 0 ? 'plus' : t.delta < 0 ? 'minus' : 'zero'}">${fmtDelta(t.delta)}</div>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>`;
  }

  function spotlight({ eyebrow, title, sub, list, art }) {
    // With runners-up beside the main card the shape moves out of their way.
    const decor = [[art, list.length > 1 ? 'd-bottom-right-sm' : 'd-right'], ['sparkle', 'd-top-right']];
    if (!list.length) {
      return `
        ${deco(decor)}
        <div class="hero">
          <div class="eyebrow">${eyebrow}</div>
          <h2 class="hero-title sm">${title}</h2>
          <p class="hero-sub">이번 공개에서는 점수가 오른 팀이 없어요</p>
        </div>`;
    }
    const [top, ...rest] = list;
    return `
      ${deco(decor)}
      <div class="spot">
        <div class="screen-head">
          <div class="eyebrow">${eyebrow}</div>
          <h2 class="screen-title">${title}</h2>
          <p class="screen-sub">${sub}</p>
        </div>
        <div class="spot-body">
          <div class="spot-main card">
            <div class="spot-crown">${eyebrow === 'DARK HORSE' ? '🐎' : '🚀'}</div>
            <div class="spot-journey">
              <span class="j-from">${top.prevRank}위</span>
              <span class="j-arrow">→</span>
              <span class="j-to">${top.rank}위</span>
            </div>
            <div class="spot-team">${escapeHtml(top.team)}</div>
            <div class="spot-agent">${escapeHtml(agentOf(top))}</div>
            <div class="spot-members">${members(top)}</div>
            <div class="spot-gain">+${count(0, top.delta, { delay: 600 })}<span class="spot-gain-label">점 상승</span></div>
            <div class="spot-scores">${fmtScore(top.prevTotal)}점 → <b>${fmtScore(top.total)}점</b></div>
          </div>
          ${rest.length ? `
          <div class="spot-side">
            ${rest.map((t, i) => `
              <div class="card spot-mini" style="--i:${i + 1}">
                <div class="mini-place">${i + 2}</div>
                <div class="mini-info">
                  <div class="mini-team">${escapeHtml(t.team)} <span>${escapeHtml(agentOf(t))}</span></div>
                  <div class="mini-path">${t.prevRank}위 → ${t.rank}위</div>
                </div>
                <div class="mini-gain">${fmtDelta(t.delta)}</div>
              </div>`).join('')}
          </div>` : ''}
        </div>
      </div>`;
  }

  function statusScreens(view) {
    const { maxTotal, teams } = computeStandings(view.visible);
    const screens = [];

    // Same running order as the original board: lowest group first, TOP 3 last.
    // 16 teams -> 10–16위, 4–9위, then TOP 3.
    const rest = teams.slice(3);
    paginate(rest, Math.ceil(rest.length / STATUS_ROWS_PER_PAGE)).reverse().forEach((page) => {
      screens.push({ label: rangeLabel(page), html: () => statusRankPage(page, maxTotal) });
    });
    if (teams.length) screens.push({ label: 'TOP 3', html: () => podium(teams.slice(0, 3), maxTotal) });

    teams.slice(0, 3).forEach((t) => {
      screens.push({ label: `${t.rank}위 소개`, html: () => agentHero(t, maxTotal) });
    });
    const next = teams.slice(3, TOP_N);
    if (next.length) screens.push({ label: `${rangeLabel(next)} 소개`, html: () => agentGrid(next, maxTotal) });
    return screens;
  }

  function statusRankPage(page, maxTotal) {
    return `
      <div class="screen-head">
        <div class="eyebrow">LEADERBOARD</div>
        <h2 class="screen-title">순위 <span>${rangeLabel(page)}</span></h2>
      </div>
      <div class="lb-list">
        ${page.map((t, i) => `
          <div class="lb-row" style="--i:${i}">
            ${medal(t.rank)}
            <div class="lb-info">
              <div class="lb-team">${escapeHtml(t.team)}<span class="lb-agent">${escapeHtml(agentOf(t))}</span></div>
              <div class="lb-members">${members(t)}</div>
            </div>
            <div class="bar-track"><div class="bar-fill" style="--w:${Math.min(100, t.pct).toFixed(1)}%"></div></div>
            <div class="lb-score">${fmtScore(t.total)}<small>/${maxTotal}</small></div>
          </div>`).join('')}
      </div>`;
  }

  function podium(top3, maxTotal) {
    const order = [top3[1], top3[0], top3[2]].filter(Boolean);
    return `
      ${deco([['sparkle', 'd-top-left-sm'], ['sparkle', 'd-top-right-xs']])}
      <div class="screen-head center">
        <div class="eyebrow">TOP 3</div>
        <h2 class="screen-title">지금의 TOP 3</h2>
      </div>
      <div class="podium">
        ${order.map((t) => `
          <div class="podium-card p${t.rank}">
            ${medal(t.rank)}
            <div class="p-team">${escapeHtml(t.team)}</div>
            <div class="p-agent">${escapeHtml(agentOf(t))}</div>
            <div class="p-members">${members(t)}</div>
            <div class="p-score">${fmtScore(t.total)}<small> / ${maxTotal}</small></div>
            <div class="p-step">${t.rank}</div>
          </div>`).join('')}
      </div>`;
  }

  function agentInfo(t) {
    return state.agents[teamKey(t)] || {};
  }

  function agentHero(t, maxTotal) {
    const a = agentInfo(t);
    const art = ['ai', 'layers', 'ring'][(t.rank - 1) % 3];
    return `
      ${deco([['sparkle', 'd-top-right-xs']])}
      <div class="agent-hero">
        <div class="agent-copy">
          <div class="agent-rank">${medal(t.rank)}<span>현재 ${t.rank}위 에이전트</span></div>
          <h2 class="agent-name">${escapeHtml(t.agent || t.team)}</h2>
          <div class="agent-team">${teamLine(t)}</div>
          <p class="agent-tagline">${escapeHtml(a.tagline || '에이전트 소개를 준비하고 있어요')}</p>
          ${a.description ? `<p class="agent-desc">${escapeHtml(a.description)}</p>` : ''}
          ${(a.features || []).length ? `
            <ul class="agent-features">
              ${a.features.map((f, i) => `<li style="--i:${i}">${escapeHtml(f)}</li>`).join('')}
            </ul>` : ''}
        </div>
        <div class="agent-art">
          <img class="agent-art-img" src="${IMG[art]}" alt="">
          <div class="agent-score card">
            <span>총점</span>
            <b>${fmtScore(t.total)}</b><small>/ ${maxTotal}</small>
          </div>
        </div>
      </div>`;
  }

  function agentGrid(teams, maxTotal) {
    return `
      <div class="screen-head">
        <div class="eyebrow">AGENTS</div>
        <h2 class="screen-title">Top ${TOP_N}의 에이전트 <span>${rangeLabel(teams)}</span></h2>
      </div>
      <div class="agent-grid">
        ${teams.map((t, i) => {
          const a = agentInfo(t);
          return `
          <div class="card agent-card" style="--i:${i}">
            <div class="ac-head">
              ${medal(t.rank)}
              <div class="ac-title"><div class="ac-name">${escapeHtml(t.agent || t.team)}</div><div class="ac-team">${teamLine(t)}</div></div>
              <div class="ac-score">${fmtScore(t.total)}<small>/${maxTotal}</small></div>
            </div>
            <p class="ac-tagline">${escapeHtml(a.tagline || '에이전트 소개를 준비하고 있어요')}</p>
            ${a.description ? `<p class="ac-desc">${escapeHtml(a.description)}</p>` : ''}
            ${(a.features || []).length ? `<div class="ac-tags">${a.features.map((f) => `<span>${escapeHtml(f)}</span>`).join('')}</div>` : ''}
          </div>`;
        }).join('')}
      </div>`;
  }

  function buildScreens(view) {
    if (view.mode === 'wait') return waitScreens(view);
    if (view.mode === 'reveal') return revealScreens(view);
    return statusScreens(view);
  }

  // ---------- DOM ----------

  function rebuild(resetIndex) {
    const view = state.view;
    state.screens = buildScreens(view);
    if (resetIndex || state.index >= state.screens.length) state.index = 0;

    viewport.innerHTML = '';
    state.screens.forEach((s, i) => {
      const sec = document.createElement('section');
      sec.className = `screen screen-${view.mode}`;
      sec.innerHTML = s.html();
      viewport.appendChild(sec);
      s.el = sec;
      s.i = i;
    });
    screenDots.innerHTML = state.screens.map((s) => `<span title="${escapeHtml(s.label)}"></span>`).join('');

    stage.dataset.mode = view.mode;
    modeLabelEl.textContent = MODE_LABEL[view.mode];
    activate();
  }

  function activate() {
    state.screens.forEach((s, i) => s.el.classList.toggle('active', i === state.index));
    [...screenDots.children].forEach((d, i) => d.classList.toggle('active', i === state.index));
    const current = state.screens[state.index];
    if (current) {
      // Restart entrance animations every time a screen comes back around.
      current.el.classList.remove('enter');
      void current.el.offsetWidth;
      current.el.classList.add('enter');
      runCounts(current.el);
    }
  }

  function runCounts(root) {
    root.querySelectorAll('.count').forEach((node) => {
      const from = Number(node.dataset.from);
      const to = Number(node.dataset.to);
      const dec = node.dataset.dec === '1';
      const delay = Number(node.dataset.delay) || 0;
      const dur = 1400;
      const fmt = (v) => (dec ? fmtScore(v) : String(Math.round(v)));
      node.textContent = fmt(from);
      const startAt = performance.now() + delay;
      const step = (ts) => {
        const p = Math.min(1, Math.max(0, (ts - startAt) / dur));
        const eased = 1 - (1 - p) ** 3;
        node.textContent = fmt(from + (to - from) * eased);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  function goTo(i) {
    if (!state.screens.length) return;
    state.index = ((i % state.screens.length) + state.screens.length) % state.screens.length;
    state.nextAt = Date.now() + SCREEN_MS;
    activate();
  }

  // ---------- main loop ----------

  function tick() {
    const t = Date.now();
    const d = new Date(t);
    clockEl.textContent = [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');

    if (state.raw) {
      const view = computeView(t);
      const modeKey = `${view.mode}|${view.target ?? ''}`;
      const dataKey = `${state.rawText.length}|${state.rawText}|${JSON.stringify(state.agents).length}`;
      if (modeKey !== state.modeKey) {
        state.view = view;
        state.modeKey = modeKey;
        state.dataKey = dataKey;
        rebuild(true);
        state.nextAt = t + SCREEN_MS;
      } else if (dataKey !== state.dataKey) {
        state.view = view;
        state.dataKey = dataKey;
        rebuild(false);
      }
      updateFooter(view);
    }

    if (state.screens.length && !state.paused && t >= state.nextAt) {
      goTo(state.index + 1);
    }

    const remain = state.paused ? SCREEN_MS : Math.max(0, state.nextAt - t);
    countdownFillEl.style.transform = `scaleX(${state.screens.length ? remain / SCREEN_MS : 0})`;
    countdownTextEl.textContent = state.paused ? '일시정지됨' : `다음 화면까지 ${Math.ceil(remain / 1000)}초`;

    document.querySelectorAll('[data-countdown-to]').forEach((node) => {
      node.textContent = fmtRemain(Number(node.dataset.countdownTo) - t);
    });
  }

  function updateFooter(view) {
    const snap = resolveSnapshots(state.raw);
    const visible = view.visible;
    if (visible && visible.reveal_at) {
      updatedAtEl.textContent = `${fmtHM(new Date(visible.reveal_at).getTime())} 점수 기준`;
    } else if (visible && visible.event && visible.event.updated_at) {
      updatedAtEl.textContent = `${fmtHM(new Date(visible.event.updated_at).getTime())} 점수 기준`;
    } else {
      updatedAtEl.textContent = '';
    }
    scheduleStatusEl.textContent = snap.revealAt === null
      ? '공개 일정: 없음 (즉시 공개된 게시본)'
      : `공개 일정: ${new Date(snap.revealAt).toLocaleString('ko-KR', { hour12: false })} ${snap.pending ? '(대기 중)' : '(공개됨)'}`;
  }

  // Preview of the reveal screens without touching published.json: invents a
  // "previous" round by knocking a little off every score.
  function makeDemo(json) {
    let seed = 7;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const previous = {
      ...json,
      teams: (json.teams || []).map((t) => {
        const cut = 0.04 + rand() * 0.3;
        const scores = Object.fromEntries(Object.entries(t.scores || {}).map(([k, v]) => [k, Math.max(0, Math.round(Number(v) * (1 - cut)))]));
        const out = { ...t, scores };
        if (t.total !== undefined) out.total = Math.round(Number(t.total) * (1 - cut) * 10) / 10;
        return out;
      }),
    };
    return { ...json, reveal_at: new Date(DEMO_REVEAL_AT).toISOString(), previous };
  }

  async function fetchJson(url) {
    const res = await fetch(`${url}?_=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }

  async function fetchAll() {
    try {
      const [text, agentsText] = await Promise.all([
        fetchJson(RESULTS_URL),
        fetchJson(AGENTS_URL).catch(() => '{}'),
      ]);
      let json = JSON.parse(text);
      if (DEMO) json = makeDemo(json);
      state.raw = json;
      state.rawText = DEMO ? JSON.stringify(json) : text;
      try { state.agents = JSON.parse(agentsText).agents || {}; } catch { state.agents = {}; }
      eventNameEl.textContent = (json.event && json.event.name) || '해커톤 라이브 리더보드';
      fetchStatusEl.textContent = `상태: 정상 (${new Date().toLocaleTimeString('ko-KR', { hour12: false })})`;
      tick();
    } catch (err) {
      fetchStatusEl.textContent = `상태: 오류 - ${err.message}`;
    }
  }

  // ---------- host panel ----------

  panelTab.addEventListener('click', () => { controlPanel.hidden = !controlPanel.hidden; });
  panelClose.addEventListener('click', () => { controlPanel.hidden = true; });
  modeSelect.addEventListener('change', () => {
    state.override = modeSelect.value;
    state.modeKey = '';
    tick();
  });
  btnPrev.addEventListener('click', () => goTo(state.index - 1));
  btnNext.addEventListener('click', () => goTo(state.index + 1));
  btnPause.addEventListener('click', () => {
    state.paused = !state.paused;
    btnPause.textContent = state.paused ? '재생' : '일시정지';
    btnPause.classList.toggle('active-state', state.paused);
    if (!state.paused) state.nextAt = Date.now() + SCREEN_MS;
  });
  btnRefresh.addEventListener('click', fetchAll);

  document.addEventListener('keydown', (e) => {
    if (e.target && ['SELECT', 'INPUT'].includes(e.target.tagName)) return;
    if (e.key === 'p' || e.key === 'P') controlPanel.hidden = !controlPanel.hidden;
    if (e.key === 'ArrowRight') goTo(state.index + 1);
    if (e.key === 'ArrowLeft') goTo(state.index - 1);
    if (e.key === ' ') { e.preventDefault(); btnPause.click(); }
  });

  // ---------- boot ----------

  fetchAll();
  setInterval(fetchAll, POLL_MS);
  setInterval(tick, 250);
  tick();
})();
