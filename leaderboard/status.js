(() => {
  const { escapeHtml, fmtDateTime, medalFor, computeStandings } = window.Leaderboard;

  const PUBLISHED_URL = './published.json';
  const POLL_MS = 15000;

  const el = (id) => document.getElementById(id);
  const eventNameEl = el('eventName');
  const eventNoteEl = el('eventNote');
  const updatedAtEl = el('updatedAt');
  const tableBodyEl = el('tableBody');

  function renderTable(maxTotal, teams) {
    if (!teams.length) {
      tableBodyEl.innerHTML = '<tr><td colspan="4" class="empty-note">아직 게시된 결과가 없습니다.</td></tr>';
      return;
    }
    tableBodyEl.innerHTML = teams.map((t) => `
      <tr>
        <td class="rank-cell">${t.rank <= 3 ? `<span class="medal">${medalFor(t.rank)}</span>` : ''}${t.rank}</td>
        <td class="team-cell">
          <strong>${escapeHtml(t.team)}</strong>
          <span>${escapeHtml(t.agent || '')}</span>
        </td>
        <td class="members-cell">${escapeHtml((t.members || []).join(', '))}</td>
        <td class="num total-cell">${Math.round(t.total)} / ${maxTotal}</td>
      </tr>
    `).join('');
  }

  async function fetchAndRender() {
    try {
      const res = await fetch(`${PUBLISHED_URL}?_=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const { maxTotal, teams } = computeStandings(json);

      eventNameEl.textContent = json.event?.name || '해커톤 현황';
      eventNoteEl.textContent = json.event?.note || '';
      updatedAtEl.textContent = `마지막 갱신 ${fmtDateTime(json.event?.updated_at)}`;
      renderTable(maxTotal, teams);
    } catch (err) {
      updatedAtEl.textContent = `불러오기 오류: ${err.message}`;
    }
  }

  fetchAndRender();
  setInterval(fetchAndRender, POLL_MS);
})();
