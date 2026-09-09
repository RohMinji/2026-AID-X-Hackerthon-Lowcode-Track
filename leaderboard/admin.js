(() => {
  const { escapeHtml, computeStandings, diffStandings } = window.Leaderboard;

  // Must match the branch the GitHub Pages deploy workflow actually builds
  // from (see .github/workflows/deploy-pages.yml). Update this once the repo
  // settles on `main` as its default branch.
  const REPO_OWNER = 'RohMinji';
  const REPO_NAME = '2026-AID-X-Hackerthon-Lowcode-Track';
  const BRANCH = 'claude/hackathon-live-leaderboard-px880u';
  const PUBLISHED_PATH = 'leaderboard/published.json';
  const HISTORY_PATH = 'leaderboard/history.json';

  const DRAFT_URL = './results.json';
  const PUBLISHED_URL = './published.json';
  const HISTORY_URL = './history.json';
  const TOKEN_KEY = 'lb_admin_token';
  const MAX_HISTORY_ROWS = 20;

  const el = (id) => document.getElementById(id);
  const tokenInput = el('tokenInput');
  const btnSaveToken = el('btnSaveToken');
  const btnClearToken = el('btnClearToken');
  const tokenMsg = el('tokenMsg');
  const jsonPaste = el('jsonPaste');
  const btnUseFetched = el('btnUseFetched');
  const btnUsePasted = el('btnUsePasted');
  const pasteMsg = el('pasteMsg');
  const btnPublish = el('btnPublish');
  const draftMeta = el('draftMeta');
  const draftTableBody = el('draftTableBody');
  const publishMsg = el('publishMsg');
  const revealCard = el('revealCard');
  const revealMeta = el('revealMeta');
  const revealTableBody = el('revealTableBody');
  const historyTableBody = el('historyTableBody');
  const historyMsg = el('historyMsg');

  let draftDataRaw = null;
  let publishedDataRaw = null;
  let draftStandings = null;
  let publishedStandings = null;
  let historyEntries = [];

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
      draftTableBody.innerHTML = '<tr><td colspan="5" class="empty-note">불러온 데이터에 팀 정보가 없습니다.</td></tr>';
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

  function applyDraft(json, sourceLabel) {
    draftDataRaw = json;
    draftStandings = computeStandings(json);

    const diffList = diffStandings(publishedStandings.teams, draftStandings.teams);
    renderDraftTable(draftStandings.maxTotal, diffList);

    const changed = diffList.filter((t) => t.change !== 'same').length;
    draftMeta.textContent = `${json.event?.name || ''} · 팀 ${draftStandings.teams.length}개 · ` +
      `게시본 대비 변동 예상 ${changed}팀 (${sourceLabel})`;
  }

  async function fetchJson(url) {
    const res = await fetch(`${url}?_=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  function renderHistoryTable() {
    if (!historyEntries.length) {
      historyTableBody.innerHTML = '<tr><td colspan="5" class="empty-note">아직 게시 히스토리가 없습니다.</td></tr>';
      return;
    }
    const rows = [...historyEntries]
      .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
      .slice(0, MAX_HISTORY_ROWS);
    historyTableBody.innerHTML = rows.map((entry) => {
      const top3 = [1, 2, 3].map((rank) => {
        const t = (entry.teams || []).find((x) => x.rank === rank);
        return t ? escapeHtml(t.team) : '-';
      });
      const when = new Date(entry.published_at).toLocaleString('ko-KR', { hour12: false });
      return `
        <tr>
          <td>${when}</td>
          <td class="num">${(entry.teams || []).length}</td>
          <td>${top3[0]}</td>
          <td>${top3[1]}</td>
          <td>${top3[2]}</td>
        </tr>
      `;
    }).join('');
  }

  async function loadData() {
    revealCard.hidden = true;
    clearMsg(publishMsg);
    clearMsg(pasteMsg);
    draftMeta.textContent = '불러오는 중...';
    draftTableBody.innerHTML = '<tr><td colspan="5" class="empty-note">불러오는 중...</td></tr>';
    try {
      const [draftJson, publishedJson, historyJson] = await Promise.all([
        fetchJson(DRAFT_URL),
        fetchJson(PUBLISHED_URL).catch(() => ({ criteria: [], teams: [] })),
        fetchJson(HISTORY_URL).catch(() => ({ entries: [] })),
      ]);
      publishedDataRaw = publishedJson;
      publishedStandings = computeStandings(publishedJson);
      historyEntries = historyJson.entries || [];

      jsonPaste.value = JSON.stringify(draftJson, null, 2);
      applyDraft(draftJson, 'results.json 기준');
      renderHistoryTable();
    } catch (err) {
      draftMeta.textContent = `불러오기 실패: ${err.message}`;
      draftTableBody.innerHTML = `<tr><td colspan="5" class="empty-note">불러오기 실패: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  btnUsePasted.addEventListener('click', () => {
    let parsed;
    try {
      parsed = JSON.parse(jsonPaste.value);
    } catch (err) {
      setMsg(pasteMsg, 'err', `JSON 형식 오류: ${err.message}`);
      return;
    }
    if (!Array.isArray(parsed.teams)) {
      setMsg(pasteMsg, 'err', '"teams" 배열이 없습니다. results.json 스키마를 확인하세요.');
      return;
    }
    clearMsg(pasteMsg);
    applyDraft(parsed, '붙여넣은 내용 기준, 아직 results.json과 다를 수 있음');
    setMsg(pasteMsg, 'ok', '붙여넣은 내용으로 미리보기를 갱신했습니다. 게시하면 이 내용이 저장됩니다.');
  });

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

  function base64DecodeUtf8(b64) {
    return decodeURIComponent(escape(atob(b64.replace(/\n/g, ''))));
  }

  // Returns { sha, content } for an existing file, or null if it doesn't
  // exist yet (e.g. history.json before the first publish).
  async function githubGetFile(token, path) {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${encodeURIComponent(BRANCH)}`;
    const res = await fetch(url, { headers: authHeaders(token) });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(await describeError(res));
    return res.json();
  }

  async function githubPutFile(token, path, contentStr, sha, message) {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        content: base64EncodeUtf8(contentStr),
        branch: BRANCH,
        ...(sha ? { sha } : {}),
      }),
    });
    if (!res.ok) throw new Error(await describeError(res));
    return res.json();
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

  async function appendHistory(token) {
    const historyFile = await githubGetFile(token, HISTORY_PATH);
    const historyObj = historyFile ? JSON.parse(base64DecodeUtf8(historyFile.content)) : { entries: [] };
    historyObj.entries.push({
      published_at: new Date().toISOString(),
      event: draftDataRaw.event || null,
      criteria: draftDataRaw.criteria || [],
      teams: draftStandings.teams.map((t) => ({
        team: t.team, agent: t.agent, members: t.members, rank: t.rank, total: t.total, scores: t.scores,
      })),
    });
    await githubPutFile(
      token,
      HISTORY_PATH,
      `${JSON.stringify(historyObj, null, 2)}\n`,
      historyFile ? historyFile.sha : undefined,
      `Append leaderboard history (${new Date().toISOString()})`,
    );
    historyEntries = historyObj.entries;
    renderHistoryTable();
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
    clearMsg(historyMsg);

    try {
      const publishedFile = await githubGetFile(token, PUBLISHED_PATH);
      const prettyContent = `${JSON.stringify(draftDataRaw, null, 2)}\n`;
      const putData = await githubPutFile(
        token,
        PUBLISHED_PATH,
        prettyContent,
        publishedFile ? publishedFile.sha : undefined,
        `Publish leaderboard results (${new Date().toISOString()})`,
      );

      setMsg(publishMsg, 'ok', `게시 완료 (commit ${(putData.commit && putData.commit.sha || '').slice(0, 7)}). 실시간 화면은 15초 이내에 반영됩니다.`);
      renderReveal(publishedStandings, draftStandings);

      publishedDataRaw = draftDataRaw;
      publishedStandings = draftStandings;
      renderDraftTable(draftStandings.maxTotal, diffStandings(publishedStandings.teams, draftStandings.teams));
    } catch (err) {
      setMsg(publishMsg, 'err', `게시 실패: ${err.message}`);
      btnPublish.disabled = false;
      return;
    }

    try {
      await appendHistory(token);
    } catch (err) {
      setMsg(historyMsg, 'err', `게시는 완료됐지만 히스토리 저장에 실패했습니다: ${err.message}`);
    }

    btnPublish.disabled = false;
  }

  btnUseFetched.addEventListener('click', loadData);
  btnPublish.addEventListener('click', publish);

  loadTokenStatus();
  loadData();
})();
