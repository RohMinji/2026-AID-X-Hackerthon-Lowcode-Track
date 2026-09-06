(() => {
  const { escapeHtml, computeStandings, diffStandings } = window.Leaderboard;

  // Must match the branch the GitHub Pages deploy workflow actually builds
  // from (see .github/workflows/deploy-pages.yml). Update this once the repo
  // settles on `main` as its default branch.
  const REPO_OWNER = 'RohMinji';
  const REPO_NAME = '2026-AID-X-Hackerthon-Lowcode-Track';
  const BRANCH = 'claude/hackathon-live-leaderboard-px880u';
  const PUBLISHED_PATH = 'leaderboard/published.json';

  const DRAFT_URL = './results.json';
  const PUBLISHED_URL = './published.json';
  const TOKEN_KEY = 'lb_admin_token';

  const el = (id) => document.getElementById(id);
  const tokenInput = el('tokenInput');
  const btnSaveToken = el('btnSaveToken');
  const btnClearToken = el('btnClearToken');
  const tokenMsg = el('tokenMsg');
  const btnReload = el('btnReload');
  const btnPublish = el('btnPublish');
  const draftMeta = el('draftMeta');
  const draftTableBody = el('draftTableBody');
  const publishMsg = el('publishMsg');
  const revealCard = el('revealCard');
  const revealMeta = el('revealMeta');
  const revealTableBody = el('revealTableBody');

  let draftDataRaw = null;
  let publishedDataRaw = null;
  let draftStandings = null;
  let publishedStandings = null;

  function setMsg(node, kind, text) {
    node.className = `status-msg show ${kind}`;
    node.textContent = text;
  }
  function clearMsg(node) {
    node.className = 'status-msg';
    node.textContent = '';
  }

  function loadTokenStatus() {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (token) setMsg(tokenMsg, 'info', '저장된 토큰을 사용합니다 (이 브라우저 세션에만 유지됩니다).');
    else clearMsg(tokenMsg);
  }

  btnSaveToken.addEventListener('click', () => {
    const value = tokenInput.value.trim();
    if (!value) { setMsg(tokenMsg, 'err', '토큰을 입력하세요.'); return; }
    sessionStorage.setItem(TOKEN_KEY, value);
    setMsg(tokenMsg, 'ok', '토큰이 저장되었습니다.');
  });

  btnClearToken.addEventListener('click', () => {
    sessionStorage.removeItem(TOKEN_KEY);
    tokenInput.value = '';
    setMsg(tokenMsg, 'info', '토큰을 삭제했습니다.');
  });

  function badgeFor(t) {
    if (t.change === 'new') return '<span class="badge new">NEW</span>';
    if (t.change === 'up') return `<span class="badge up">▲ ${t.rankDiff}</span>`;
    if (t.change === 'down') return `<span class="badge down">▼ ${Math.abs(t.rankDiff)}</span>`;
    return '<span class="badge same">-</span>';
  }

  function renderDraftTable(maxTotal, diffList) {
    if (!diffList.length) {
      draftTableBody.innerHTML = '<tr><td colspan="5" class="empty-note">results.json에 팀 데이터가 없습니다.</td></tr>';
      return;
    }
    draftTableBody.innerHTML = diffList.map((t) => `
      <tr>
        <td class="rank-cell">${t.rank}</td>
        <td class="team-cell">
          <strong>${escapeHtml(t.team)}</strong>
          <span>${escapeHtml(t.agent || '')}</span>
        </td>
        <td class="members-cell">${escapeHtml((t.members || []).join(', '))}</td>
        <td class="num total-cell">${Math.round(t.total)} / ${maxTotal}</td>
        <td>${badgeFor(t)}</td>
      </tr>
    `).join('');
  }

  async function fetchJson(url) {
    const res = await fetch(`${url}?_=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function loadData() {
    revealCard.hidden = true;
    clearMsg(publishMsg);
    draftMeta.textContent = '불러오는 중...';
    draftTableBody.innerHTML = '<tr><td colspan="5" class="empty-note">불러오는 중...</td></tr>';
    try {
      const [draftJson, publishedJson] = await Promise.all([
        fetchJson(DRAFT_URL),
        fetchJson(PUBLISHED_URL).catch(() => ({ criteria: [], teams: [] })),
      ]);
      draftDataRaw = draftJson;
      publishedDataRaw = publishedJson;
      draftStandings = computeStandings(draftJson);
      publishedStandings = computeStandings(publishedJson);

      const diffList = diffStandings(publishedStandings.teams, draftStandings.teams);
      renderDraftTable(draftStandings.maxTotal, diffList);

      const changed = diffList.filter((t) => t.change !== 'same').length;
      draftMeta.textContent = `${draftJson.event?.name || ''} · 팀 ${draftStandings.teams.length}개 · ` +
        `게시본 대비 변동 예상 ${changed}팀 (results.json 기준 미리보기)`;
    } catch (err) {
      draftMeta.textContent = `불러오기 실패: ${err.message}`;
      draftTableBody.innerHTML = `<tr><td colspan="5" class="empty-note">불러오기 실패: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  function authHeaders(token) {
    return { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' };
  }

  async function describeError(res) {
    try {
      const body = await res.json();
      return `${body.message || res.statusText} (${res.status})`;
    } catch {
      return `HTTP ${res.status}`;
    }
  }

  function base64EncodeUtf8(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  function renderReveal(prevStandings, currStandings) {
    const diffList = diffStandings(prevStandings.teams, currStandings.teams);
    revealTableBody.innerHTML = diffList.map((t) => `
      <tr>
        <td class="rank-cell">${t.rank <= 3 ? '🏆 ' : ''}${t.rank}</td>
        <td class="team-cell">
          <strong>${escapeHtml(t.team)}</strong>
          <span>${escapeHtml(t.agent || '')}</span>
        </td>
        <td class="num">${t.prevTotal === null ? '-' : Math.round(t.prevTotal)} → ${Math.round(t.total)}</td>
        <td>${badgeFor(t)}</td>
      </tr>
    `).join('');
    revealMeta.textContent = `게시 시각: ${new Date().toLocaleString('ko-KR', { hour12: false })}`;
    revealCard.hidden = false;
    revealCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function publish() {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) {
      setMsg(tokenMsg, 'err', '먼저 GitHub 토큰을 저장하세요.');
      tokenInput.focus();
      return;
    }
    if (!draftDataRaw || !draftStandings) return;

    const ok = window.confirm(
      `정말 게시하시겠습니까?\n실시간 화면과 현황 화면에 바로 반영됩니다. (팀 ${draftStandings.teams.length}개)`
    );
    if (!ok) return;

    btnPublish.disabled = true;
    setMsg(publishMsg, 'info', '게시 중...');

    try {
      const apiBase = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${PUBLISHED_PATH}`;
      const getRes = await fetch(`${apiBase}?ref=${encodeURIComponent(BRANCH)}`, { headers: authHeaders(token) });
      if (!getRes.ok) throw new Error(await describeError(getRes));
      const getData = await getRes.json();

      const prettyContent = `${JSON.stringify(draftDataRaw, null, 2)}\n`;
      const putRes = await fetch(apiBase, {
        method: 'PUT',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Publish leaderboard results (${new Date().toISOString()})`,
          content: base64EncodeUtf8(prettyContent),
          sha: getData.sha,
          branch: BRANCH,
        }),
      });
      if (!putRes.ok) throw new Error(await describeError(putRes));
      const putData = await putRes.json();

      setMsg(publishMsg, 'ok', `게시 완료 (commit ${(putData.commit && putData.commit.sha || '').slice(0, 7)}). 실시간 화면은 15초 이내에 반영됩니다.`);
      renderReveal(publishedStandings, draftStandings);

      publishedDataRaw = draftDataRaw;
      publishedStandings = draftStandings;
      renderDraftTable(draftStandings.maxTotal, diffStandings(publishedStandings.teams, draftStandings.teams));
    } catch (err) {
      setMsg(publishMsg, 'err', `게시 실패: ${err.message}`);
    } finally {
      btnPublish.disabled = false;
    }
  }

  btnReload.addEventListener('click', loadData);
  btnPublish.addEventListener('click', publish);

  loadTokenStatus();
  loadData();
})();
