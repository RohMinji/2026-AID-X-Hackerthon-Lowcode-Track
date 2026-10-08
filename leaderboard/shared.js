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

  // Ranks teams by total score, descending; ties broken by earlier
  // submitted_at, then team name. A team's `total` is taken as given when the
  // data carries one (evaluation exports do), otherwise it is the criteria
  // sum. Adds `total`, `pct`, `rank`.
  function computeStandings(json) {
    const criteria = json.criteria || [];
    const maxTotal = criteria.reduce((s, c) => s + (c.max || 0), 0);
    const teams = (json.teams || []).map((t) => {
      const given = Number(t.total);
      const total = t.total !== undefined && Number.isFinite(given)
        ? given
        : criteria.reduce((s, c) => s + (Number(t.scores?.[c.key]) || 0), 0);
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
    const prevByTeam = new Map((prevTeams || []).map((t) => [teamKey(t), t]));
    return currTeams.map((t) => {
      const prev = prevByTeam.get(teamKey(t));
      if (!prev) {
        return { ...t, prevRank: null, prevTotal: null, rankDiff: null, change: 'new' };
      }
      const rankDiff = prev.rank - t.rank; // positive = moved up (lower rank number)
      const change = rankDiff > 0 ? 'up' : rankDiff < 0 ? 'down' : 'same';
      return { ...t, prevRank: prev.rank, prevTotal: prev.total, rankDiff, change };
    });
  }

  // published.json may carry `reveal_at` (when its scores go on screen) and
  // `previous` (the snapshot that was on screen before it, written by the
  // admin page on publish). Until reveal_at passes, every screen keeps
  // showing `previous`, so scores can be published ahead of the reveal.
  // Returns { visible, previous, revealAt, pending }: `visible` is the raw
  // JSON to show right now (null when nothing has been revealed yet), and
  // `previous` is what `visible` should be compared against.
  function resolveSnapshots(json, now = Date.now()) {
    const parsed = json && json.reveal_at ? new Date(json.reveal_at).getTime() : NaN;
    const revealAt = Number.isFinite(parsed) ? parsed : null;
    const pending = revealAt !== null && now < revealAt;
    if (pending) return { visible: json.previous || null, previous: null, revealAt, pending };
    return { visible: json || null, previous: (json && json.previous) || null, revealAt, pending };
  }

  // A team is tracked across rounds by its appid; older data only has names.
  function teamKey(t) {
    return t.appid || t.team;
  }

  // Score items of the evaluation export (result/result.json).
  const EVAL_CRITERIA = [
    { key: 'common', label: '공통', max: 50 },
    { key: 'custom', label: '커스텀', max: 40 },
    { key: 'mission', label: '미션', max: 10 },
  ];

  function isEvalExport(json) {
    return !!(json && json.push_results && typeof json.push_results === 'object');
  }

  // "20261008T09:32" -> ISO string in Korean time, or null.
  function parsePushDate(s) {
    const m = /^(\d{4})(\d{2})(\d{2})T(\d{2}):(\d{2})/.exec(String(s || ''));
    return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+09:00` : null;
  }

  // Converts an evaluation export into the board's own shape
  // ({ event, criteria, teams }). push_results.eval_n is scoring round n and
  // lists every team (a team that skipped round n keeps its round n-1 score),
  // so the standings come from the last eval alone. `team` starts out as the
  // agent name; withRoster() swaps in the real team name and members.
  function fromEvalExport(json, eventName) {
    const evals = Object.keys(json.push_results || {})
      .map((k) => ({ key: k, n: Number((/^eval_(\d+)$/.exec(k) || [])[1]) }))
      .filter((e) => Number.isFinite(e.n))
      .sort((a, b) => a.n - b.n);
    if (!evals.length) throw new Error('push_results에 eval_n 항목이 없습니다.');
    const last = evals[evals.length - 1];
    const entries = json.push_results[last.key] || {};
    const teams = Object.entries(entries).map(([appid, e]) => ({
      appid,
      team: e.agent_name || appid,
      agent: e.agent_name || '',
      agent_type: e.agent_type || '',
      members: [],
      total: Number(e.total) || 0,
      scores: Object.fromEntries(EVAL_CRITERIA.map((c) => [c.key, Number(e[c.key]) || 0])),
    }));
    return {
      event: {
        name: eventName || '2026 AID-X 에이전트 개발 해커톤',
        updated_at: parsePushDate(json.push_date),
        round: last.n,
        push_id: json.push_ID ?? null,
      },
      criteria: EVAL_CRITERIA,
      teams,
    };
  }

  // Overlays team names, members and intro copy from agents.json (keyed by
  // appid) onto a board snapshot, so names can be fixed without re-publishing.
  function withRoster(json, roster) {
    if (!json || !roster) return json;
    return {
      ...json,
      teams: (json.teams || []).map((t) => {
        const r = roster[teamKey(t)];
        if (!r) return t;
        return {
          ...t,
          team: r.team || t.team,
          members: Array.isArray(r.members) && r.members.length ? r.members : t.members,
        };
      }),
    };
  }

  return {
    escapeHtml, fmtDateTime, medalFor, computeStandings, diffStandings, resolveSnapshots,
    teamKey, isEvalExport, fromEvalExport, withRoster, EVAL_CRITERIA,
  };
})();
