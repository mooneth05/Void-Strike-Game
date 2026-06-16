// leaderboard.js — Void Striker Local Leaderboard
const Leaderboard = (() => {
  const KEY = 'voidstriker_leaderboard';
  const MAX = 10;

  function getAll() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || [];
    } catch { return []; }
  }

  function save(entries) {
    localStorage.setItem(KEY, JSON.stringify(entries));
  }

  function submit(name, score, wave) {
    const entries = getAll();
    entries.push({ name: name || 'PILOT', score, wave, date: Date.now() });
    entries.sort((a, b) => b.score - a.score);
    const trimmed = entries.slice(0, MAX);
    save(trimmed);
    return trimmed.findIndex(e => e.score === score && e.wave === wave);
  }

  function isHighScore(score) {
    const entries = getAll();
    if (entries.length < MAX) return true;
    return score > entries[entries.length - 1].score;
  }

  function getRank(score) {
    const entries = getAll();
    return entries.findIndex(e => e.score <= score) + 1 || entries.length + 1;
  }

  function renderHTML(highlightIdx = -1) {
    const entries = getAll();
    if (entries.length === 0) {
      return '<p style="color:#555;font-size:0.75rem;letter-spacing:0.1em">NO RECORDS YET</p>';
    }
    return `
      <table style="width:100%;border-collapse:collapse;font-size:0.72rem;letter-spacing:0.08em">
        <thead>
          <tr style="color:#555;border-bottom:1px solid #1a1a2e">
            <th style="padding:4px 6px;text-align:left">#</th>
            <th style="padding:4px 6px;text-align:left">PILOT</th>
            <th style="padding:4px 6px;text-align:right">SCORE</th>
            <th style="padding:4px 6px;text-align:right">WAVE</th>
          </tr>
        </thead>
        <tbody>
          ${entries.map((e, i) => `
            <tr style="
              color:${i === highlightIdx ? '#00f0ff' : i === 0 ? '#ffd700' : '#888'};
              background:${i === highlightIdx ? '#00f0ff11' : 'transparent'};
              border-bottom:1px solid #0a0a1a
            ">
              <td style="padding:4px 6px">${i + 1}</td>
              <td style="padding:4px 6px">${e.name.substring(0, 8).toUpperCase()}</td>
              <td style="padding:4px 6px;text-align:right">${e.score.toLocaleString()}</td>
              <td style="padding:4px 6px;text-align:right">${e.wave}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function clear() {
    localStorage.removeItem(KEY);
  }

  return { getAll, submit, isHighScore, getRank, renderHTML, clear };
})();
