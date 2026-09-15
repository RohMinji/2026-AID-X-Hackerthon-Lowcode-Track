(() => {
  const TEAM_COUNT = 16;
  const BOKEH_COUNT = 22;
  const DRAW_LOCK_MS = 700; // prevents double-clicking through the drop/crack animation

  const el = (id) => document.getElementById(id);
  const bokehEl = el('bokeh');
  const domeEl = el('dome');
  const trayEl = el('tray');
  const btnDraw = el('btnDraw');
  const remainingHint = el('remainingHint');
  const orderListEl = el('orderList');
  const finaleOverlay = el('finaleOverlay');
  const finaleListEl = el('finaleList');
  const btnCopy = el('btnCopy');
  const btnRestart = el('btnRestart');

  let capsules = []; // { number, color, domeEl }
  let pool = [];
  let drawnSequence = []; // numbers in the order they were drawn
  let drawing = false;

  function colorFor(i, total) {
    const hue = Math.round((360 / total) * i);
    return `hsl(${hue} 75% 62%)`;
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
      dot.style.background = colorFor(Math.floor(Math.random() * TEAM_COUNT), TEAM_COUNT);
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

  function buildCapsules() {
    capsules = Array.from({ length: TEAM_COUNT }, (_, i) => ({
      number: i + 1,
      color: colorFor(i, TEAM_COUNT),
      domeEl: null,
    }));
  }

  function buildDome() {
    domeEl.innerHTML = '';
    capsules.forEach((c) => {
      const pos = randomDiskPoint(36);
      const cap = document.createElement('div');
      cap.className = 'capsule';
      cap.style.left = `${pos.x}%`;
      cap.style.top = `${pos.y}%`;
      cap.style.setProperty('--cap-color', c.color);
      cap.style.setProperty('--dx', `${(Math.random() * 12 - 6).toFixed(1)}px`);
      cap.style.setProperty('--dy', `${(Math.random() * 12 - 6).toFixed(1)}px`);
      cap.style.animationDuration = `${1.6 + Math.random() * 1.2}s`;
      cap.style.animationDelay = `${Math.random() * 1.5}s`;
      cap.innerHTML = '<span class="cap-shine"></span>';
      domeEl.appendChild(cap);
      c.domeEl = cap;
    });
  }

  function updateRemaining() {
    remainingHint.textContent = `남은 캡슐: ${pool.length}개`;
  }

  function resetAll() {
    pool = [...capsules];
    drawnSequence = [];
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
    drawnSequence.push(picked.number);
    const turn = drawnSequence.length;
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
        <span class="reveal-num">${picked.number}</span>
      </div>
    `;
    trayEl.appendChild(reveal);
    requestAnimationFrame(() => reveal.classList.add('falling'));
    setTimeout(() => reveal.classList.add('cracked'), 460);

    const li = document.createElement('li');
    li.className = 'order-item';
    li.innerHTML = `
      <span class="order-num">${turn}</span>
      <span class="drawn-value">${picked.number}번</span>
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
    finaleListEl.innerHTML = drawnSequence.map((num, i) => `
      <li>
        <span class="order-num">${i + 1}</span>
        <span class="drawn-value">${num}번</span>
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
    const text = drawnSequence.map((num, i) => `${i + 1}번째 뽑기: ${num}번`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      const original = btnCopy.textContent;
      btnCopy.textContent = '복사됨!';
      setTimeout(() => { btnCopy.textContent = original; }, 1500);
    } catch {
      window.alert('클립보드 복사에 실패했습니다. 화면을 직접 캡처해주세요.');
    }
  });

  buildBokeh();
  buildCapsules();
  resetAll();
})();
