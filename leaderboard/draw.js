(() => {
  const { escapeHtml } = window.Leaderboard;

  const ROSTER_URL = './results.json';
  const LAUNCH_DELAY_MAX_S = 10; // ships depart from Earth at staggered random times
  const MIN_FLIGHT_S = 4;
  const MAX_FLIGHT_S = 18;
  const DECEL_DURATION_S = 1.3;
  const FINALE_DELAY_S = 1.8;
  const STAR_COUNT = 140;
  const STREAK_COUNT = 26;
  const COAST_PX = 36; // small identical overshoot for every ship while it eases to a stop

  const el = (id) => document.getElementById(id);
  const stageEl = el('stage');
  const spaceCanvasEl = el('spaceCanvas');
  const lanesEl = el('lanes');
  const starfieldEl = el('starfield');
  const warpStreaksEl = el('warpStreaks');
  const orderListEl = el('orderList');
  const introOverlay = el('introOverlay');
  const introText = el('introText');
  const finaleOverlay = el('finaleOverlay');
  const finaleListEl = el('finaleList');
  const btnStart = el('btnStart');
  const btnRestart = el('btnRestart');
  const btnCopy = el('btnCopy');

  let ships = [];
  let animRunning = false;
  let startTs = 0;

  function easeOutQuad(t) { return 1 - (1 - t) * (1 - t); }

  function randomLaunchDelay() {
    return Math.random() * LAUNCH_DELAY_MAX_S;
  }

  function randomFlightDuration() {
    return MIN_FLIGHT_S + Math.random() * (MAX_FLIGHT_S - MIN_FLIGHT_S);
  }

  async function loadRoster() {
    const res = await fetch(`${ROSTER_URL}?_=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const teams = (json.teams || []).map((t) => ({ team: t.team, agent: t.agent || '' }));
    if (!teams.length) throw new Error('results.json에 팀 데이터가 없습니다');
    return teams;
  }

  function buildStarfield() {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < STAR_COUNT; i++) {
      const star = document.createElement('span');
      star.className = 'star';
      star.style.left = `${Math.random() * 100}%`;
      star.style.top = `${Math.random() * 100}%`;
      const size = 1 + Math.random() * 2;
      star.style.width = `${size}px`;
      star.style.height = `${size}px`;
      star.style.animationDuration = `${2 + Math.random() * 3}s`;
      star.style.animationDelay = `${Math.random() * 3}s`;
      frag.appendChild(star);
    }
    starfieldEl.appendChild(frag);
  }

  function buildWarpStreaks() {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < STREAK_COUNT; i++) {
      const streak = document.createElement('span');
      streak.className = 'streak';
      streak.style.top = `${Math.random() * 100}%`;
      streak.style.width = `${40 + Math.random() * 90}px`;
      streak.style.animationDuration = `${0.6 + Math.random() * 0.9}s`;
      streak.style.animationDelay = `${Math.random() * 1.5}s`;
      streak.style.opacity = String(0.25 + Math.random() * 0.4);
      frag.appendChild(streak);
    }
    warpStreaksEl.appendChild(frag);
  }

  function buildLanes(teams) {
    lanesEl.innerHTML = '';
    ships = teams.map((t, i) => {
      const hue = Math.round((360 / teams.length) * i);
      const laneEl = document.createElement('div');
      laneEl.className = 'lane';

      const shipEl = document.createElement('div');
      shipEl.className = 'ship';
      shipEl.style.setProperty('--lane-color', `hsl(${hue} 85% 65%)`);
      shipEl.innerHTML = `
        <span class="order-badge" hidden></span>
        <span class="trail"></span>
        <span class="flame"></span>
        <span class="rocket">🚀</span>
        <span class="ship-label">${escapeHtml(t.team)}</span>
      `;
      laneEl.appendChild(shipEl);
      lanesEl.appendChild(laneEl);

      return {
        team: t.team,
        agent: t.agent,
        el: shipEl,
        flameEl: shipEl.querySelector('.flame'),
        trailEl: shipEl.querySelector('.trail'),
        badgeEl: shipEl.querySelector('.order-badge'),
        launchDelay: randomLaunchDelay(),
        flightDuration: randomFlightDuration(),
        launched: false,
        stopped: false,
        order: null,
        // Two overlapping sine waves per ship give each a distinct,
        // organically crooked flight path instead of a straight line.
        wobbleAmp1: 8 + Math.random() * 8,
        wobbleFreq1: 0.6 + Math.random() * 0.9,
        wobblePhase1: Math.random() * Math.PI * 2,
        wobbleAmp2: 3 + Math.random() * 4,
        wobbleFreq2: 2 + Math.random() * 2.5,
        wobblePhase2: Math.random() * Math.PI * 2,
      };
    });
  }

  function resetShips() {
    orderListEl.innerHTML = '';
    ships.forEach((s) => {
      s.launchDelay = randomLaunchDelay();
      s.flightDuration = randomFlightDuration();
      s.launched = false;
      s.stopped = false;
      s.order = null;
      s.el.classList.remove('stopped', 'launched');
      s.flameEl.classList.remove('out');
      s.trailEl.style.opacity = '0';
      s.badgeEl.hidden = true;
      s.el.style.transform = 'translate(0px, -50%)';
    });
  }

  function startDraw() {
    introOverlay.hidden = true;
    finaleOverlay.hidden = true;
    resetShips();
    stageEl.classList.add('flying');
    startTs = performance.now();
    animRunning = true;
    requestAnimationFrame(tick);
  }

  function tick(now) {
    if (!animRunning) return;
    const elapsed = (now - startTs) / 1000;

    const trackWidth = Math.max(200, lanesEl.clientWidth - 120);
    let allStopped = true;

    ships.forEach((s) => {
      if (s.stopped) return;
      allStopped = false;

      const sinceLaunch = elapsed - s.launchDelay;
      if (sinceLaunch < 0) {
        applyTransform(s, 0, elapsed);
        return;
      }
      if (!s.launched) {
        s.launched = true;
        s.el.classList.add('launched');
        s.trailEl.style.opacity = '1';
      }

      // A ship's on-screen distance from Earth is a direct, monotonic
      // function of how long IT (not the clock) has been flying - so the
      // ship with the shortest flight always ends up closest to Earth,
      // whenever it happens to launch.
      const rampElapsed = Math.min(sinceLaunch, s.flightDuration);
      const baseX = trackWidth * (rampElapsed / MAX_FLIGHT_S);

      if (sinceLaunch >= s.flightDuration) {
        const p = Math.min(1, (sinceLaunch - s.flightDuration) / DECEL_DURATION_S);
        const x = baseX + COAST_PX * easeOutQuad(p);
        s.trailEl.style.opacity = String(1 - p);
        if (p >= 1) {
          s.stopped = true;
          onShipStopped(s);
        }
        applyTransform(s, x, elapsed);
      } else {
        applyTransform(s, baseX, elapsed);
      }
    });

    if (allStopped) {
      animRunning = false;
      stageEl.classList.remove('flying');
      setTimeout(revealFinalOrder, FINALE_DELAY_S * 1000);
      return;
    }
    requestAnimationFrame(tick);
  }

  function applyTransform(s, x, elapsed) {
    const bobY =
      Math.sin(elapsed * s.wobbleFreq1 + s.wobblePhase1) * s.wobbleAmp1 +
      Math.sin(elapsed * s.wobbleFreq2 + s.wobblePhase2) * s.wobbleAmp2;
    s.el.style.transform = `translate(${x}px, calc(-50% + ${bobY}px))`;
  }

  function triggerImpact() {
    spaceCanvasEl.classList.remove('impact');
    void spaceCanvasEl.offsetWidth; // force reflow so the shake can retrigger
    spaceCanvasEl.classList.add('impact');
  }

  // Ships stop in an order that reveals nothing about final rank (a late
  // launcher can still have the shortest flight). So while the draw is
  // running we only show WHICH teams have stopped so far, with no number -
  // final order stays unknown to everyone until revealFinalOrder() runs.
  function onShipStopped(s) {
    s.el.classList.add('stopped');
    s.flameEl.classList.add('out');
    s.trailEl.style.opacity = '0';
    triggerImpact();

    const li = document.createElement('li');
    li.className = 'order-item pending';
    li.dataset.team = s.team;
    li.innerHTML = `
      <span class="order-num">·</span>
      <span class="order-team">${escapeHtml(s.team)}</span>
      <span class="order-agent">${escapeHtml(s.agent)}</span>
    `;
    orderListEl.appendChild(li);
    li.scrollIntoView({ block: 'nearest' });
  }

  function revealFinalOrder() {
    const ranked = [...ships].sort((a, b) => a.flightDuration - b.flightDuration);
    ranked.forEach((s, i) => {
      s.order = i + 1;
      s.badgeEl.hidden = false;
      s.badgeEl.textContent = s.order;
    });

    const rowsHtml = (s) => `
      <li>
        <span class="order-num">${s.order}</span>
        <span class="order-team">${escapeHtml(s.team)}</span>
        <span class="order-agent">${escapeHtml(s.agent)}</span>
      </li>
    `;
    orderListEl.innerHTML = ranked.map(rowsHtml).join('');
    finaleListEl.innerHTML = ranked.map(rowsHtml).join('');
    finaleOverlay.hidden = false;
  }

  btnStart.addEventListener('click', startDraw);

  btnRestart.addEventListener('click', () => {
    if (!window.confirm('다시 추첨하시겠습니까? 지금 결과는 사라집니다.')) return;
    startDraw();
  });

  btnCopy.addEventListener('click', async () => {
    const text = [...ships]
      .sort((a, b) => a.order - b.order)
      .map((s) => `${s.order}. ${s.team}${s.agent ? ` - ${s.agent}` : ''}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      const original = btnCopy.textContent;
      btnCopy.textContent = '복사됨!';
      setTimeout(() => { btnCopy.textContent = original; }, 1500);
    } catch {
      window.alert('클립보드 복사에 실패했습니다. 화면을 직접 캡처해주세요.');
    }
  });

  (async () => {
    try {
      const teams = await loadRoster();
      buildLanes(teams);
      buildStarfield();
      buildWarpStreaks();
    } catch (err) {
      introText.textContent = `팀 명단을 불러오지 못했습니다: ${err.message}`;
      btnStart.disabled = true;
    }
  })();
})();
