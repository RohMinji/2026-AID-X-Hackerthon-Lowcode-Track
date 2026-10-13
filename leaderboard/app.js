(() => {
  const {
    escapeHtml, computeStandings, diffStandings, resolveSnapshots, withRoster, rosterEntry, sameName, peopleOf,
    deadlinesOf,
  } = window.Leaderboard;

  // The board reads published.json (written by the admin page). Scores in it
  // stay hidden until its `reveal_at`; until then the previous snapshot is
  // what's on screen. agents.json holds team names and agent intro copy,
  // schedule.json the submission deadlines, scoring items and the form link.
  const RESULTS_URL = './published.json';
  const AGENTS_URL = './agents.json';
  const SCHEDULE_URL = './schedule.json';
  const POLL_MS = 15000;
  const SCREEN_MS = 10000;

  const ROWS_PER_PAGE = 8;
  const REVEAL_REPEATS = 3;
  const TOP_N = 7;
  const MIN = 60 * 1000;

  const DEFAULT_SCHEDULE = {
    date: '',
    deadlines: ['13:30', '14:30', '15:30', '16:30', '17:30', '18:30'],
    reveal_delay_minutes: 30,
    reveal_window_minutes: 5,
    final_results_at: '',
    criteria: [
      { label: '개선미션', points: 50 },
      { label: '품질미션', points: 30 },
      { label: '크레딧미션', points: 20 },
    ],
    form: { url: '', guide: [] },
  };

  const IMG = {
    ai: 'assets/ai.png',
    layers: 'assets/layers.png',
    cursor: 'assets/cursor.png',
    ring: 'assets/ring.png',
    sparkle: 'assets/sparkle.png',
  };

  const MODE_LABEL = { wait: '채점 중', reveal: '점수 공개', status: 'LIVE', final: '최종 결과' };

  const el = (id) => document.getElementById(id);
  const stage = el('stage');
  const viewport = el('viewport');
  const screenDots = el('screenDots');
  const modeLabelEl = el('modeLabel');
  const clockEl = el('clock');
  const basisChipEl = el('basisChip');
  const countdownTextEl = el('countdownText');
  const countdownFillEl = el('countdownFill');
  const fetchStatusEl = el('fetchStatus');
  const scheduleStatusEl = el('scheduleStatus');

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
  const MODE_ALIASES = { scoring: 'wait', wait: 'wait', reveal: 'reveal', status: 'status', final: 'final' };

  const state = {
    raw: null,
    rawText: '',
    agents: {},
    schedule: DEFAULT_SCHEDULE,
    scheduleText: '',
    override: MODE_ALIASES[params.get('mode')] || 'auto',
    modeKey: '',
    dataKey: '',
    view: null,
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

  function pad2(n) { return String(n).padStart(2, '0'); }

  function fmtHM(ms) {
    const d = new Date(ms);
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  function fmtRemain(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
  }

  function deco(list) {
    return list.map(([name, pos]) => `<img class="deco ${pos}" src="${IMG[name]}" alt="">`).join('');
  }

  function medal(rank) {
    return `<span class="medal${rank <= 3 ? ` m${rank}` : ''}">${rank}</span>`;
  }

  const TYPE_LABEL = { agentic: 'Agentic', workflow: 'Workflow' };

  // "소속 · 팀장, 팀원, 팀원" from agents.json, otherwise the agent type.
  function members(t) {
    const line = [t.org, peopleOf(t).join(', ')].filter(Boolean).join(' · ');
    return escapeHtml(line || TYPE_LABEL[t.agent_type] || t.agent_type || '');
  }

  // The agent name shown next to the team name; hidden while the team has no
  // name of its own yet (agents.json empty) and both would read the same.
  function agentOf(t) {
    return t.agent && !sameName(t.agent, t.team) ? t.agent : '';
  }

  // Longer form for the agent intro screens: 소속 · 팀장 ○○○ · 팀원 ○○○, ○○○
  function teamLine(t) {
    const others = (t.members || []).filter(Boolean);
    const people = t.leader
      ? [`팀장 ${t.leader}`, others.length ? `팀원 ${others.join(', ')}` : ''].filter(Boolean).join(' · ')
      : others.join(', ');
    const parts = [agentOf(t) ? t.team : '', t.org, people].filter(Boolean).map((x) => escapeHtml(x));
    return parts.length ? parts.join(' · ') : members(t);
  }

  function count(from, to, { dec = true, delay = 0 } = {}) {
    const shown = dec ? fmtScore(from) : String(from);
    return `<span class="count" data-from="${from}" data-to="${to}" data-dec="${dec ? 1 : 0}" data-delay="${delay}">${shown}</span>`;
  }

  function chunk(list, size) {
    const out = [];
    for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    return out;
  }

  function rangeLabel(teams) {
    const first = teams[0].rank;
    const last = teams[teams.length - 1].rank;
    return first === last ? `${first}위` : `${first}–${last}위`;
  }

  function basisOf(view) {
    const snap = view.visible || {};
    const ms = snap.reveal_at ? new Date(snap.reveal_at).getTime()
      : snap.event && snap.event.updated_at ? new Date(snap.event.updated_at).getTime() : null;
    return ms !== null && Number.isFinite(ms) ? fmtHM(ms) : '';
  }

  // ---------- schedule ----------

  function deadlinesAt(t) {
    return deadlinesOf(state.schedule, t);
  }

  // "08:30" when on the same day as now, "10/15 08:30" otherwise.
  function fmtWhen(ms) {
    const d = new Date(ms);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    return sameDay ? fmtHM(ms) : `${d.getMonth() + 1}/${d.getDate()} ${fmtHM(ms)}`;
  }

  function finalAt() {
    const s = state.schedule.final_results_at;
    if (!s) return null;
    const ms = new Date(String(s).replace(' ', 'T')).getTime();
    return Number.isFinite(ms) ? ms : null;
  }

  function revealWindowMs() { return (Number(state.schedule.reveal_window_minutes) || 5) * MIN; }
  function revealDelayMs() { return (Number(state.schedule.reveal_delay_minutes) || 30) * MIN; }

  // ---------- mode ----------
  //
  // One cycle, e.g. the 12:30 deadline revealed at 13:00:
  //   12:30 ~ 13:00  wait    criteria, remaining chances, "scoring"
  //   13:00 ~ 13:05  reveal  intro (once), board with moves, dark horse,
  //                          rising stars, closest race
  //   13:05 ~ 13:30  status  board, top 3 intros, 4–7, criteria,
  //                          remaining chances, form QR
  // The reveal time is the admin's reveal_at; until a publish arrives the
  // board waits on deadline + reveal_delay_minutes.

  function computeView(t) {
    const raw = state.raw || {};
    const snap = resolveSnapshots(raw, t);
    const base = {
      visible: withRoster(snap.visible, state.agents),
      previous: withRoster(snap.previous, state.agents),
      revealAt: snap.revealAt,
      pending: snap.pending,
    };
    const deadlines = deadlinesAt(t);
    const lastDeadline = [...deadlines].reverse().find((d) => d <= t) ?? null;
    const final = finalAt();
    const hasBoard = !!(base.visible && (base.visible.teams || []).length);

    let mode;
    let target = null;
    if (state.override !== 'auto') {
      mode = state.override;
      if (snap.pending) target = snap.revealAt;
      else if (lastDeadline !== null) target = lastDeadline + revealDelayMs();
    } else if (final !== null && t >= final) {
      mode = 'final';
    } else if (snap.revealAt !== null && t >= snap.revealAt && t < snap.revealAt + revealWindowMs()) {
      mode = 'reveal';
    } else if (snap.pending) {
      // Published ahead of time: wait once that round's deadline has passed.
      const cycleDeadline = [...deadlines].reverse().find((d) => d < snap.revealAt) ?? snap.revealAt - revealDelayMs();
      mode = t >= cycleDeadline ? 'wait' : 'status';
      target = snap.revealAt;
    } else if (lastDeadline !== null && (snap.revealAt === null || snap.revealAt < lastDeadline)) {
      // Deadline passed and this round has not been published yet.
      mode = 'wait';
      target = lastDeadline + revealDelayMs();
    } else {
      mode = 'status';
    }

    if ((mode === 'reveal' || mode === 'final') && !hasBoard) mode = 'status';
    return { ...base, mode, target, deadlines, hasBoard };
  }

  // ---------- shared screens ----------

  function criteriaScreen() {
    const items = state.schedule.criteria || [];
    const total = items.reduce((s, c) => s + (Number(c.points) || 0), 0) || 1;
    return {
      label: '채점 항목',
      html: () => `
        ${deco([['layers', 'd-bottom-right-sm'], ['sparkle', 'd-top-right']])}
        <div class="screen-head">
          <div class="eyebrow">SCORING CRITERIA</div>
          <h2 class="screen-title">채점 항목 <span>총 ${total}점</span></h2>
        </div>
        <div class="crit">
          <div class="crit-bar">
            ${items.map((c, i) => `<span class="cb${i % 3}" style="--w:${(Number(c.points) / total) * 100}%"></span>`).join('')}
          </div>
          <div class="crit-cards">
            ${items.map((c, i) => `
              <div class="card crit-card" style="--i:${i}">
                <span class="crit-dot cb${i % 3}"></span>
                <div class="crit-name">${escapeHtml(c.label)}</div>
                ${c.desc ? `<p class="crit-desc">${escapeHtml(c.desc)}</p>` : ''}
                <div class="crit-points">${escapeHtml(String(c.points))}<small>점</small></div>
              </div>`).join('')}
          </div>
        </div>`,
    };
  }

  function remainingScreen(view) {
    return {
      label: '남은 접수',
      html: () => {
        const now = Date.now();
        const upcoming = view.deadlines.filter((d) => d > now);
        const next = upcoming[0];
        return `
          ${deco([['ring', 'd-top-right'], ['sparkle', 'd-top-left-sm']])}
          <div class="remain">
            <div class="eyebrow">SUBMISSIONS</div>
            ${next ? `
              <h2 class="remain-title">남은 접수 기회 <b>${upcoming.length}</b>회</h2>
              <div class="remain-next">다음 접수 마감 <strong>${fmtWhen(next)}</strong>
                <span class="remain-count">마감까지 <b data-countdown-to="${next}">${fmtRemain(next - now)}</b></span></div>`
              : '<h2 class="remain-title">모든 접수가 마감되었습니다</h2>'}
            <div class="remain-times" style="--n:${view.deadlines.length}">
              ${view.deadlines.map((d, i) => {
                // The date goes on the first card and wherever the day changes.
                const day = new Date(d);
                const newDay = i === 0 || day.toDateString() !== new Date(view.deadlines[i - 1]).toDateString();
                return `
                <div class="rt ${d <= now ? 'done' : d === next ? 'next' : ''}" style="--i:${i}">
                  <span class="rt-no">${i + 1}회차</span>
                  <span class="rt-day">${newDay ? `${day.getMonth() + 1}/${day.getDate()}` : '&nbsp;'}</span>
                  <span class="rt-time">${fmtHM(d)}</span>
                  <span class="rt-state">${d <= now ? '마감' : d === next ? '접수 중' : '예정'}</span>
                </div>`;
              }).join('')}
            </div>
          </div>`;
      },
    };
  }

  function scoringScreen(view) {
    return {
      label: '채점 중',
      html: () => {
        const target = view.target;
        const due = target !== null && target > Date.now();
        return `
          ${deco([['layers', 'd-left'], ['sparkle', 'd-top-right'], ['cursor', 'd-bottom-right-sm']])}
          <div class="hero">
            <div class="eyebrow">SCORING IN PROGRESS</div>
            <h2 class="hero-title">채점 중</h2>
            <p class="hero-sub">접수된 에이전트를 채점하고 있어요</p>
            <div class="scan"><span></span></div>
            ${due ? `
              <div class="hero-pill">점수 공개 ${fmtHM(target)}</div>
              <div class="hero-countdown">공개까지 <strong data-countdown-to="${target}">${fmtRemain(target - Date.now())}</strong></div>`
              : '<div class="hero-pill">점수 공개 준비 중</div>'}
          </div>`;
      },
    };
  }

  // ---------- leaderboard pages ----------

  function moveBadge(t) {
    if (t.change === 'new') return '<span class="move new">NEW</span>';
    if (t.change === 'up') return `<span class="move up">▲ ${t.rankDiff}</span>`;
    if (t.change === 'down') return `<span class="move down">▼ ${Math.abs(t.rankDiff)}</span>`;
    return '<span class="move same">–</span>';
  }

  // Board right after a reveal: rows start where each team stood last round
  // and slide to their new place (see animateMoves).
  function moveBoardPage(page, maxTotal, basis) {
    const start = page[0].rank;
    return {
      label: rangeLabel(page),
      enter: animateMoves,
      html: () => `
        <div class="screen-head compact">
          <div class="eyebrow">LEADERBOARD · ${escapeHtml(basis)} 기준</div>
          <h2 class="screen-title">순위 변동 <span>${rangeLabel(page)}</span></h2>
        </div>
        <div class="mv-list" data-size="${page.length}">
          ${page.map((t, i) => `
            <div class="mv-row is-${t.change}" data-slot="${i}" data-from="${t.prevRank === null ? '' : t.prevRank - start}">
              <div class="mv-rank">${count(t.prevRank ?? t.rank, t.rank, { dec: false, delay: 1700 })}</div>
              <div class="mv-move">${moveBadge(t)}</div>
              <div class="mv-info">
                <div class="mv-team">${escapeHtml(t.team)}<span class="mv-agent">${escapeHtml(agentOf(t))}</span></div>
                <div class="mv-members">${members(t)}</div>
              </div>
              <div class="mv-path">${t.prevRank !== null ? `${t.prevRank}위 <i>→</i> <b>${t.rank}위</b>` : `<b>${t.rank}위</b>`}</div>
              <div class="mv-score">
                <span class="mv-total">${count(t.prevTotal ?? t.total, t.total, { delay: 1700 })}<small>/${maxTotal}</small></span>
                ${t.delta !== null ? `<span class="mv-delta ${t.delta > 0 ? 'plus' : t.delta < 0 ? 'minus' : 'zero'}">${fmtDelta(t.delta)}</span>` : ''}
              </div>
            </div>`).join('')}
        </div>`,
    };
  }

  function animateMoves(root) {
    const rows = [...root.querySelectorAll('.mv-row')];
    if (!rows.length || typeof rows[0].animate !== 'function') return;
    const size = rows.length;
    const step = rows.length > 1 ? rows[1].offsetTop - rows[0].offsetTop : rows[0].offsetHeight;
    rows.forEach((row) => {
      const slot = Number(row.dataset.slot);
      const raw = row.dataset.from;
      let fromY;
      let fromOpacity = 1;
      if (raw === '') {
        fromY = 0; fromOpacity = 0; // new on the board: fade in
      } else {
        const from = Number(raw);
        if (from < 0) { fromY = (-1 - slot) * step; fromOpacity = 0; } // came from the page above
        else if (from >= size) { fromY = (size - slot) * step; fromOpacity = 0; } // came from below
        else fromY = (from - slot) * step;
      }
      const moving = fromY !== 0 || fromOpacity !== 1;
      if (moving) row.classList.add('lifting');
      row.style.zIndex = row.classList.contains('is-up') ? 3 : moving ? 2 : 1;
      const anim = row.animate([
        { offset: 0, transform: `translateY(${fromY}px) scale(1)`, opacity: fromOpacity },
        { offset: 0.38, transform: `translateY(${fromY}px) scale(${moving ? 1.025 : 1})`, opacity: fromOpacity },
        { offset: 0.85, transform: `translateY(0) scale(${moving ? 1.025 : 1})`, opacity: 1 },
        { offset: 1, transform: 'translateY(0) scale(1)', opacity: 1 },
      ], { duration: 3000, easing: 'cubic-bezier(.45,.05,.25,1)', fill: 'backwards' });
      anim.onfinish = () => row.classList.remove('lifting');
    });
  }

  function boardPage(page, maxTotal, basis) {
    return {
      label: rangeLabel(page),
      html: () => `
        <div class="screen-head compact">
          <div class="eyebrow">LEADERBOARD · ${escapeHtml(basis)} 기준</div>
          <h2 class="screen-title">리더보드 <span>${rangeLabel(page)}</span></h2>
        </div>
        <div class="lb-list dense">
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
        </div>`,
    };
  }

  // ---------- reveal & regular rotation ----------

  // Standings of the visible round compared with the round before it.
  function analyse(view) {
    const curr = computeStandings(view.visible);
    const prev = view.previous ? computeStandings(view.previous) : null;
    const diff = diffStandings(prev ? prev.teams : [], curr.teams).map((t) => ({
      ...t,
      delta: t.prevTotal === null ? null : t.total - t.prevTotal,
    }));
    return { curr, diff, basis: basisOf(view), round: view.visible.event && view.visible.event.round };
  }

  // Dark horse, rising stars (new Top 7 entries, one screen each) and the
  // closest race. Dark horse and rising stars need a previous round.
  function highlightScreens(a) {
    const screens = [];
    const withDelta = a.diff.filter((t) => t.delta !== null);
    const byGain = (x, y) => (y.delta - x.delta) || (x.rank - y.rank);
    if (withDelta.length) {
      screens.push({
        label: '다크호스',
        html: () => spotlight({
          eyebrow: 'DARK HORSE', title: '다크호스는 어디?', sub: '전체 팀 중 점수가 가장 많이 오른 팀',
          list: [...withDelta].sort(byGain).slice(0, 3), art: 'layers', icon: '🐎',
        }),
      });
      const rising = withDelta.filter((t) => t.rank <= TOP_N && t.prevRank > TOP_N).sort(byGain);
      rising.forEach((t, i) => {
        screens.push({
          label: rising.length > 1 ? `라이징 스타 ${i + 1}` : '라이징 스타',
          html: () => spotlight({
            eyebrow: rising.length > 1 ? `RISING STAR ${i + 1}` : 'RISING STAR',
            title: rising.length > 1 ? `라이징 스타 ${i + 1}` : '라이징 스타',
            sub: `Top ${TOP_N} 밖에서 Top ${TOP_N} 안으로 들어온 팀`,
            list: [t], art: 'cursor', icon: '🚀',
          }),
        });
      });
    }
    const rivals = closestPair(a.curr.teams);
    if (rivals) screens.push({ label: '치열한 경쟁', html: () => rivalry(rivals, a.curr.maxTotal) });
    return screens;
  }

  // The loop shown whenever there is no one-off sequence to play:
  // board, dark horse, rising stars, closest race, Top 7 agents, scoring
  // items, form QR, remaining chances. `scoring` (the "채점 중" screen) is put
  // first and again after the agents while a round is being scored.
  function regularScreens(view, scoring) {
    const screens = [];
    if (scoring) screens.push(scoring);
    if (view.hasBoard) {
      const a = analyse(view);
      // Lower ranks first, everywhere.
      chunk(a.curr.teams, ROWS_PER_PAGE).reverse().forEach((page) => screens.push(boardPage(page, a.curr.maxTotal, a.basis)));
      screens.push(...highlightScreens(a));
      screens.push(...topAgentScreens(a.curr.teams, a.curr.maxTotal, '현재'));
      if (scoring) screens.push({ ...scoring });
    }
    screens.push(criteriaScreen());
    if (view.deadlines.some((d) => d > Date.now())) screens.push(remainingScreen(view));
    return screens;
  }

  // Right after a reveal: "새로운 점수를 공개합니다!" (10 s), then the rank-move
  // pages three times over, all played once; the regular loop follows.
  function revealScreens(view) {
    const a = analyse(view);
    const once = (s) => ({ ...s, once: true });
    const screens = [once({
      label: '공개',
      html: () => `
        ${deco([['ai', 'd-left'], ['ring', 'd-right-sm'], ['sparkle', 'd-top-right'], ['sparkle', 'd-bottom-left-xs']])}
        <div class="hero">
          <div class="eyebrow">NEW LEADERBOARD</div>
          <h2 class="hero-title">새로운 점수를<br>공개합니다!</h2>
          <div class="hero-pill">${a.round ? `${a.round}회차 · ` : ''}${a.basis} 점수 기준</div>
        </div>`,
    })];
    // Lower half first, building up to the top of the table.
    const pages = chunk(a.diff, ROWS_PER_PAGE).reverse();
    for (let r = 0; r < REVEAL_REPEATS; r++) {
      pages.forEach((page) => screens.push(once(moveBoardPage(page, a.curr.maxTotal, a.basis))));
    }
    return [...screens, ...regularScreens(view, null)];
  }

  // Adjacent ranks with the smallest score gap; ties go to the higher pair.
  // Two teams both still on 0 points are not a race, so they are skipped.
  function closestPair(teams) {
    let best = null;
    for (let i = 0; i + 1 < teams.length; i++) {
      const a = teams[i];
      const b = teams[i + 1];
      if (a.total === 0 && b.total === 0) continue;
      const gap = Math.abs(a.total - b.total);
      if (!best || gap < best.gap - 1e-9) best = { a, b, gap };
    }
    return best;
  }

  function rivalry({ a, b, gap }, maxTotal) {
    const side = (t, cls) => `
      <div class="card vs-card ${cls}">
        <div class="vs-rank">${t.rank}위</div>
        <div class="vs-team">${escapeHtml(t.team)}</div>
        <div class="vs-agent">${escapeHtml(agentOf(t) || members(t))}</div>
        <div class="vs-score">${fmtScore(t.total)}<small>/${maxTotal}</small></div>
      </div>`;
    const tie = Math.round(gap * 10) === 0;
    return `
      ${deco([['sparkle', 'd-top-right'], ['sparkle', 'd-bottom-left-xs']])}
      <div class="screen-head center">
        <div class="eyebrow">CLOSEST RACE</div>
        <h2 class="screen-title">치열한 경쟁 중!</h2>
        <p class="screen-sub">점수 차가 가장 작은 두 팀</p>
      </div>
      <div class="vs">
        ${side(a, 'left')}
        <div class="vs-mid">
          <div class="vs-badge">VS</div>
          <div class="vs-gap">${tie ? '동점!' : `<b>${fmtScore(gap)}</b>점 차`}</div>
        </div>
        ${side(b, 'right')}
      </div>`;
  }

  function spotlight({ eyebrow, title, sub, list, art, icon }) {
    const decor = [[art, list.length > 1 ? 'd-bottom-right-sm' : 'd-right'], ['sparkle', 'd-top-right']];
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
            <div class="spot-crown">${icon}</div>
            <div class="spot-journey">
              <span class="j-from">${top.prevRank}위</span>
              <span class="j-arrow">→</span>
              <span class="j-to">${top.rank}위</span>
            </div>
            <div class="spot-team">${escapeHtml(top.team)}</div>
            <div class="spot-agent">${escapeHtml(agentOf(top))}</div>
            <div class="spot-members">${members(top)}</div>
            <div class="spot-gain">${top.delta >= 0 ? '+' : '−'}${count(0, Math.abs(top.delta), { delay: 600 })}<span class="spot-gain-label">점 ${top.delta >= 0 ? '상승' : '하락'}</span></div>
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

  // ---------- status / final ----------

  function agentInfo(t) {
    return rosterEntry(state.agents, t) || {};
  }

  function agentHero(t, maxTotal, prefix) {
    const a = agentInfo(t);
    const art = ['ai', 'layers', 'ring'][(t.rank - 1) % 3];
    return {
      label: `${t.rank}위 소개`,
      html: () => `
        ${deco([['sparkle', 'd-top-right-xs']])}
        <div class="agent-hero">
          <div class="agent-copy">
            <div class="agent-rank">${medal(t.rank)}<span>${prefix} ${t.rank}위 에이전트</span></div>
            <h2 class="agent-name">${escapeHtml(t.team || t.agent)}</h2>
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
        </div>`,
    };
  }

  function agentGrid(teams, maxTotal) {
    return {
      label: `${rangeLabel(teams)} 소개`,
      html: () => `
        <div class="screen-head">
          <div class="eyebrow">TOP ${TOP_N} AGENTS</div>
          <h2 class="screen-title">Top ${TOP_N} 에이전트 <span>${rangeLabel(teams)}</span></h2>
        </div>
        <div class="agent-grid">
          ${teams.map((t, i) => {
            const a = agentInfo(t);
            return `
            <div class="card agent-card" style="--i:${i}">
              <div class="ac-head">
                ${medal(t.rank)}
                <div class="ac-title"><div class="ac-name">${escapeHtml(t.team || t.agent)}</div><div class="ac-team">${teamLine(t)}</div></div>
                <div class="ac-score">${fmtScore(t.total)}<small>/${maxTotal}</small></div>
              </div>
              <p class="ac-tagline">${escapeHtml(a.tagline || '에이전트 소개를 준비하고 있어요')}</p>
              ${a.description ? `<p class="ac-desc">${escapeHtml(a.description)}</p>` : ''}
              ${(a.features || []).length ? `<div class="ac-tags">${a.features.map((f) => `<span>${escapeHtml(f)}</span>`).join('')}</div>` : ''}
            </div>`;
          }).join('')}
        </div>`,
    };
  }

  // 4–7위 first, then 3위, 2위, 1위 (lower ranks first).
  function topAgentScreens(teams, maxTotal, prefix) {
    const screens = [];
    const next = teams.slice(3, TOP_N);
    if (next.length) screens.push(agentGrid(next, maxTotal));
    teams.slice(0, 3).reverse().forEach((t) => screens.push(agentHero(t, maxTotal, prefix)));
    return screens;
  }

  function statusScreens(view) {
    return regularScreens(view, null);
  }

  function podium(top3, maxTotal) {
    const order = [top3[1], top3[0], top3[2]].filter(Boolean);
    return {
      label: '최종 TOP 3',
      html: () => `
        ${deco([['sparkle', 'd-top-left-sm'], ['sparkle', 'd-top-right-xs']])}
        <div class="screen-head center">
          <div class="eyebrow">FINAL TOP 3</div>
          <h2 class="screen-title">최종 TOP 3</h2>
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
        </div>`,
    };
  }

  function finalScreens(view) {
    const { maxTotal, teams } = computeStandings(view.visible);
    const basis = basisOf(view);
    const screens = [{
      label: '최종 결과',
      html: () => `
        ${deco([['ai', 'd-left'], ['ring', 'd-right-sm'], ['sparkle', 'd-top-right'], ['sparkle', 'd-bottom-left-xs']])}
        <div class="hero">
          <div class="eyebrow">FINAL RESULTS</div>
          <h2 class="hero-title">최종 결과를<br>발표합니다</h2>
          <div class="hero-pill">최종 순위 · ${basis} 기준</div>
        </div>`,
    }];
    chunk(teams, ROWS_PER_PAGE).reverse().forEach((page) => screens.push(boardPage(page, maxTotal, basis)));
    screens.push(podium(teams.slice(0, 3), maxTotal));
    screens.push(...topAgentScreens(teams, maxTotal, '최종'));
    return screens;
  }

  function buildScreens(view) {
    if (view.mode === 'wait') return regularScreens(view, scoringScreen(view));
    if (view.mode === 'reveal') return revealScreens(view);
    if (view.mode === 'final') return finalScreens(view);
    return statusScreens(view);
  }

  // ---------- DOM ----------

  function rebuild(resetIndex) {
    const view = state.view;
    state.screens = buildScreens(view).filter(Boolean);
    if (resetIndex || state.index >= state.screens.length) state.index = 0;

    viewport.innerHTML = '';
    state.screens.forEach((s) => {
      const sec = document.createElement('section');
      sec.className = `screen screen-${view.mode}`;
      sec.innerHTML = s.html();
      viewport.appendChild(sec);
      s.el = sec;
    });
    screenDots.innerHTML = state.screens.map((s) => `<span title="${escapeHtml(s.label)}"></span>`).join('');

    stage.dataset.mode = view.mode;
    modeLabelEl.textContent = MODE_LABEL[view.mode];
    activate();
  }

  function activate() {
    state.screens.forEach((s, i) => s.el.classList.toggle('active', i === state.index));
    [...screenDots.children].forEach((d, i) => {
      d.classList.toggle('active', i === state.index);
      d.classList.toggle('spent', !!(state.screens[i].once && state.screens[i].shown && i !== state.index));
    });
    const current = state.screens[state.index];
    if (!current) return;
    current.shown = true;
    // Live countdowns are rendered once; refresh the screen's html when it
    // comes back so time-based text (next deadline, remaining count) is current.
    if (current.refreshed) current.el.innerHTML = current.html();
    current.refreshed = true;
    current.el.classList.remove('enter');
    void current.el.offsetWidth;
    current.el.classList.add('enter');
    runCounts(current.el);
    if (current.enter) current.enter(current.el);
  }

  function runCounts(root) {
    root.querySelectorAll('.count').forEach((node) => {
      const from = Number(node.dataset.from);
      const to = Number(node.dataset.to);
      const dec = node.dataset.dec === '1';
      const delay = Number(node.dataset.delay) || 0;
      const dur = 1300;
      const fmt = (v) => (dec ? fmtScore(v) : String(Math.round(v)));
      node.textContent = fmt(from);
      const startAt = performance.now() + delay;
      const stepFn = (ts) => {
        const p = Math.min(1, Math.max(0, (ts - startAt) / dur));
        node.textContent = fmt(from + (to - from) * (1 - (1 - p) ** 3));
        if (p < 1) requestAnimationFrame(stepFn);
      };
      requestAnimationFrame(stepFn);
    });
  }

  // The reveal intro ("점수를 공개합니다!") is shown once per reveal, then the
  // rotation skips it.
  function nextIndex(from, dir) {
    const n = state.screens.length;
    for (let k = 1; k <= n; k++) {
      const i = (((from + dir * k) % n) + n) % n;
      const s = state.screens[i];
      if (!(s.once && s.shown)) return i;
    }
    return from;
  }

  function goTo(i) {
    if (!state.screens.length) return;
    state.index = i;
    state.nextAt = Date.now() + SCREEN_MS;
    activate();
  }

  // ---------- main loop ----------

  function tick() {
    const t = Date.now();
    const d = new Date(t);
    clockEl.textContent = [d.getHours(), d.getMinutes(), d.getSeconds()].map(pad2).join(':');

    if (state.raw) {
      const view = computeView(t);
      const modeKey = `${view.mode}|${view.target ?? ''}|${view.revealAt ?? ''}`;
      const dataKey = `${state.rawText}|${JSON.stringify(state.agents)}|${state.scheduleText}`;
      if (modeKey !== state.modeKey) {
        const fromReveal = state.view && state.view.mode === 'reveal' && view.mode === 'status';
        const current = state.screens[state.index];
        state.view = view;
        state.modeKey = modeKey;
        state.dataKey = dataKey;
        rebuild(true);
        const keep = fromReveal && current && !current.once
          ? state.screens.findIndex((s) => s.label === current.label) : -1;
        if (keep > 0) { state.index = keep; activate(); } // same loop, so carry on where it was
        else state.nextAt = t + SCREEN_MS;
      } else if (dataKey !== state.dataKey) {
        state.view = view;
        state.dataKey = dataKey;
        rebuild(false);
      }
      updateFooter(view);
    }

    if (state.screens.length && !state.paused && t >= state.nextAt) {
      goTo(nextIndex(state.index, 1));
    }

    const remain = state.paused ? SCREEN_MS : Math.max(0, state.nextAt - t);
    countdownFillEl.style.transform = `scaleX(${state.screens.length ? remain / SCREEN_MS : 0})`;
    countdownTextEl.textContent = state.paused ? '일시정지됨' : `다음 화면까지 ${Math.ceil(remain / 1000)}초`;

    document.querySelectorAll('[data-countdown-to]').forEach((node) => {
      node.textContent = fmtRemain(Number(node.dataset.countdownTo) - t);
    });
  }

  function updateFooter(view) {
    const basis = view.hasBoard ? basisOf(view) : '';
    basisChipEl.textContent = basis ? `${basis} 점수 기준` : '';
    basisChipEl.hidden = !basis;
    const snap = resolveSnapshots(state.raw);
    scheduleStatusEl.textContent = snap.revealAt === null
      ? '공개 일정: 없음'
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

  async function fetchText(url) {
    const res = await fetch(`${url}?_=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }

  async function fetchAll() {
    try {
      const [text, agentsText, scheduleText] = await Promise.all([
        fetchText(RESULTS_URL),
        fetchText(AGENTS_URL).catch(() => '{}'),
        fetchText(SCHEDULE_URL).catch(() => ''),
      ]);
      let json = JSON.parse(text);
      if (DEMO) json = makeDemo(json);
      state.raw = json;
      state.rawText = DEMO ? JSON.stringify(json) : text;
      try { state.agents = JSON.parse(agentsText).agents || {}; } catch { state.agents = {}; }
      try {
        state.schedule = scheduleText ? { ...DEFAULT_SCHEDULE, ...JSON.parse(scheduleText) } : DEFAULT_SCHEDULE;
        state.scheduleText = scheduleText;
      } catch { /* keep the last good schedule */ }
      fetchStatusEl.textContent = `상태: 정상 (${new Date().toLocaleTimeString('ko-KR', { hour12: false })})`;
      tick();
    } catch (err) {
      fetchStatusEl.textContent = `상태: 오류 - ${err.message}`;
    }
  }

  // ---------- host panel (P key) ----------

  panelClose.addEventListener('click', () => { controlPanel.hidden = true; });
  modeSelect.addEventListener('change', () => {
    state.override = modeSelect.value;
    state.modeKey = '';
    tick();
  });
  btnPrev.addEventListener('click', () => goTo(nextIndex(state.index, -1)));
  btnNext.addEventListener('click', () => goTo(nextIndex(state.index, 1)));
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
    if (e.key === 'ArrowRight') goTo(nextIndex(state.index, 1));
    if (e.key === 'ArrowLeft') goTo(nextIndex(state.index, -1));
    if (e.key === ' ') { e.preventDefault(); btnPause.click(); }
  });

  // ---------- boot ----------

  fetchAll();
  setInterval(fetchAll, POLL_MS);
  setInterval(tick, 250);
  tick();
})();
