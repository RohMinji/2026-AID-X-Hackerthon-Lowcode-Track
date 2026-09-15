(() => {
  const { escapeHtml } = window.Leaderboard;

  const ROSTER_URL = './results.json';
  const BOKEH_COUNT = 22;
  const DRAW_LOCK_MS = 700; // prevents double-clicking through the drop/crack animation

  const el = (id) => document.getElementById(id);
  const bokehEl = el('bokeh');
  const domeEl = el('dome');
  const trayEl = el('tray');
  const btnDraw = el('btnDraw');
  const remainingHint = el('remainingHint');
  const introText = el('introText');
  const orderListEl = el('orderList');
  const finaleOverlay = el('finaleOverlay');
  const finaleListEl = el('finaleList');
  const btnCopy = el('btnCopy');
  const btnRestart = el('btnRestart');

  let teams = [];
  let pool = [];
  let drawnCount = 0;
  let drawing = false;

  function colorFor(i, total) {
    const hue = Math.round((360 / total) * i);
    return `hsl(${hue} 75% 62%)`;
  }

  async function loadRoster() {
    const res = await fetch(`${ROSTER_URL}?_=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const list = json.teams || [];
    if (!list.length) throw new Error('results.json에 팀 데이터가 없습니다');
    return list.map((t, i) => ({
      team: t.team,
      agent: t.agent || '',
      color: colorFor(i, list.length),
      order: null,
      domeEl: null,
    }));
  }

  function buildBokeh() {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < BOKEH_COUNT; i++) {
      const dot = document.createElement('span');
      const size = 20 + Math.random() * 60;
      dot.style.width = `${size}px`;
      dot.style.height = `${size}px`;
      dot.style.left = `${Math.random() * 100}%`;
      dot.style.top = `${Math.random() * 100}%`;
      dot.style.background = colorFor(Math.floor(Math.random() * 16), 16);
      dot.style.animationDuration = `${3 + Math.random() * 4}s`;
      dot.style.animationDelay = `${Math.random() * 3}s`;
      frag.appendChild(dot);
    }
    bokehEl.appendChild(frag);
  }

  function randomDiskPoint(radiusPct) {
    const r = radiusPct * Math.sqrt(Math.random());
    const a = Math.random() * Math.PI * 2;
    return { x: 50 + r * Math.cos(a), y: 50 + r * Math.sin(a) };
  }

  function buildDome() {
    domeEl.innerHTML = '';
    teams.forEach((t) => {
      const pos = randomDiskPoint(36);
      const cap = document.createElement('div');
      cap.className = 'capsule';
      cap.style.left = `${pos.x}%`;
      cap.style.top = `${pos.y}%`;
      cap.style.setProperty('--cap-color', t.color);
      cap.style.setProperty('--dx', `${(Math.random() * 12 - 6).toFixed(1)}px`);
      cap.style.setProperty('--dy', `${(Math.random() * 12 - 6).toFixed(1)}px`);
      cap.style.animationDuration = `${1.6 + Math.random() * 1.2}s`;
      cap.style.animationDelay = `${Math.random() * 1.5}s`;
      cap.innerHTML = '<span class="cap-shine"></span>';
      domeEl.appendChild(cap);
      t.domeEl = cap;
    });
  }

  function updateRemaining() {
    remainingHint.textContent = `남은 캡슐: ${pool.length}개`;
  }

  function resetAll() {
    pool = [...teams];
    drawnCount = 0;
    drawing = false;
    orderListEl.innerHTML = '';
    trayEl.innerHTML = '<div class="tray-placeholder">캡슐을 뽑아보세요</div>';
    finaleOverlay.hidden = true;
    buildDome();
    updateRemaining();
    btnDraw.disabled = false;
    btnDraw.textContent = '🎰 캡슐 뽑기';
  }

  function drawCapsule() {
    if (drawing || !pool.length) return;
    drawing = true;
    btnDraw.disabled = true;

    const idx = Math.floor(Math.random() * pool.length);
    const picked = pool.splice(idx, 1)[0];
    drawnCount += 1;
    picked.order = drawnCount;
    updateRemaining();

    if (picked.domeEl) {
      picked.domeEl.classList.add('sucked');
      const domeNode = picked.domeEl;
      setTimeout(() => domeNode.remove(), 260);
    }

    trayEl.innerHTML = '';
    const reveal = document.createElement('div');
    reveal.className = 'capsule-reveal';
    reveal.style.setProperty('--cap-color', picked.color);
    reveal.innerHTML = `
      <div class="cap-half cap-top"></div>
      <div class="cap-half cap-bottom"></div>
      <div class="reveal-card">
        <span class="reveal-num">${picked.order}</span>
        <span class="reveal-team">${escapeHtml(picked.team)}</span>
        <span class="reveal-agent">${escapeHtml(picked.agent)}</span>
      </div>
    `;
    trayEl.appendChild(reveal);
    requestAnimationFrame(() => reveal.classList.add('falling'));
    setTimeout(() => reveal.classList.add('cracked'), 460);

    const li = document.createElement('li');
    li.className = 'order-item';
    li.innerHTML = `
      <span class="order-num">${picked.order}</span>
      <span class="order-team">${escapeHtml(picked.team)}</span>
      <span class="order-agent">${escapeHtml(picked.agent)}</span>
    `;
    orderListEl.appendChild(li);
    li.scrollIntoView({ block: 'nearest' });

    setTimeout(() => {
      drawing = false;
      if (pool.length) {
        btnDraw.disabled = false;
      } else {
        btnDraw.textContent = '완료!';
        setTimeout(showFinale, 900);
      }
    }, DRAW_LOCK_MS);
  }

  function showFinale() {
    const ranked = [...teams].sort((a, b) => a.order - b.order);
    finaleListEl.innerHTML = ranked.map((t) => `
      <li>
        <span class="order-num">${t.order}</span>
        <span class="order-team">${escapeHtml(t.team)}</span>
        <span class="order-agent">${escapeHtml(t.agent)}</span>
      </li>
    `).join('');
    finaleOverlay.hidden = false;
  }

  btnDraw.addEventListener('click', drawCapsule);

  btnRestart.addEventListener('click', () => {
    if (!window.confirm('다시 뽑으시겠습니까? 지금 결과는 사라집니다.')) return;
    resetAll();
  });

  btnCopy.addEventListener('click', async () => {
    const text = [...teams]
      .sort((a, b) => a.order - b.order)
      .map((t) => `${t.order}. ${t.team}${t.agent ? ` - ${t.agent}` : ''}`)
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
      buildBokeh();
      teams = await loadRoster();
      resetAll();
    } catch (err) {
      introText.textContent = `팀 명단을 불러오지 못했습니다: ${err.message}`;
      remainingHint.textContent = '';
      btnDraw.disabled = true;
    }
  })();
})();
