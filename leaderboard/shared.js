// Shared helpers used by app.js (live board), admin.js, and status.js.
window.Leaderboard = (() => {
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

  function medalFor(rank) {
    return rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';
  }

  // Ranks teams by total score (criteria sum), descending; ties broken by
  // earlier submitted_at, then team name. Adds `total`, `pct`, `rank`.
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

  // Compares a previous standings list against the current one (both from
  // computeStandings) and annotates each current team with how its rank
  // moved: 'up' | 'down' | 'same' | 'new'.
  function diffStandings(prevTeams, currTeams) {
    const prevByTeam = new Map((prevTeams || []).map((t) => [t.team, t]));
    return currTeams.map((t) => {
      const prev = prevByTeam.get(t.team);
      if (!prev) {
        return { ...t, prevRank: null, prevTotal: null, rankDiff: null, change: 'new' };
      }
      const rankDiff = prev.rank - t.rank; // positive = moved up (lower rank number)
      const change = rankDiff > 0 ? 'up' : rankDiff < 0 ? 'down' : 'same';
      return { ...t, prevRank: prev.rank, prevTotal: prev.total, rankDiff, change };
    });
  }

  return { escapeHtml, fmtDateTime, medalFor, computeStandings, diffStandings };
})();
