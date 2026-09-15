(() => {
  const { escapeHtml } = window.Leaderboard;

  const ROSTER_URL = './results.json';
  const MIN_STOP_S = 4;
  const MAX_STOP_S = 24;
  const DECEL_DURATION_S = 1.3;
  const FINALE_DELAY_S = 1.8;
  const STAR_COUNT = 140;

  const el = (id) => document.getElementById(id);
  const lanesEl = el('lanes');
  const starfieldEl = el('starfield');
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
  let lastFrame = 0;
  let orderCounter = 0;

  function easeOutQuad(t) { return 1 - (1 - t) * (1 - t); }

  function randomStopTime() {
    return MIN_STOP_S + Math.random() * (MAX_STOP_S - MIN_STOP_S);
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
        badgeEl: shipEl.querySelector('.order-badge'),
        x: 0,
        baseSpeed: 70 + Math.random() * 50,
        stopTime: randomStopTime(),
        decelStart: null,
        stopped: false,
        order: null,
      };
    });
  }

  function resetShips() {
    orderCounter = 0;
    orderListEl.innerHTML = '';
    ships.forEach((s) => {
      s.x = 0;
      s.decelStart = null;
      s.stopped = false;
      s.order = null;
      s.stopTime = randomStopTime();
      s.el.classList.remove('stopped');
      s.flameEl.classList.remove('out');
      s.badgeEl.hidden = true;
      s.el.style.transform = 'translate(0px, -50%)';
    });
  }

  function startDraw() {
    introOverlay.hidden = true;
    finaleOverlay.hidden = true;
    resetShips();
    startTs = performance.now();
    lastFrame = 0;
    animRunning = true;
    requestAnimationFrame(tick);
  }

  function tick(now) {
    if (!animRunning) return;
    const elapsed = (now - startTs) / 1000;
    const dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0;
    lastFrame = now;

    const trackWidth = Math.max(200, lanesEl.clientWidth - 120);
    let allStopped = true;

    ships.forEach((s) => {
      if (s.stopped) return;
      allStopped = false;

      if (s.decelStart === null) {
        if (elapsed >= s.stopTime) {
          s.decelStart = elapsed;
        } else {
          s.x += s.baseSpeed * dt;
        }
      }
      if (s.decelStart !== null) {
        const p = Math.min(1, (elapsed - s.decelStart) / DECEL_DURATION_S);
        const speedNow = s.baseSpeed * (1 - easeOutQuad(p));
        s.x += speedNow * dt;
        if (p >= 1) {
          s.stopped = true;
          orderCounter += 1;
          s.order = orderCounter;
          onShipStopped(s);
        }
      }

      const xMod = ((s.x % trackWidth) + trackWidth) % trackWidth;
      const bobY = Math.sin(elapsed * 1.6 + s.x * 0.01) * 3;
      s.el.style.transform = `translate(${xMod}px, calc(-50% + ${bobY}px))`;
    });

    if (allStopped) {
      animRunning = false;
      setTimeout(showFinale, FINALE_DELAY_S * 1000);
      return;
    }
    requestAnimationFrame(tick);
  }

  function onShipStopped(s) {
    s.el.classList.add('stopped');
    s.flameEl.classList.add('out');
    s.badgeEl.hidden = false;
    s.badgeEl.textContent = s.order;

    const li = document.createElement('li');
    li.className = 'order-item';
    li.innerHTML = `
      <span class="order-num">${s.order}</span>
      <span class="order-team">${escapeHtml(s.team)}</span>
      <span class="order-agent">${escapeHtml(s.agent)}</span>
    `;
    orderListEl.appendChild(li);
    li.scrollIntoView({ block: 'nearest' });
  }

  function showFinale() {
    finaleListEl.innerHTML = [...ships]
      .sort((a, b) => a.order - b.order)
      .map((s) => `
        <li>
          <span class="order-num">${s.order}</span>
          <span class="order-team">${escapeHtml(s.team)}</span>
          <span class="order-agent">${escapeHtml(s.agent)}</span>
        </li>
      `).join('');
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
    } catch (err) {
      introText.textContent = `팀 명단을 불러오지 못했습니다: ${err.message}`;
      btnStart.disabled = true;
    }
  })();
})();
