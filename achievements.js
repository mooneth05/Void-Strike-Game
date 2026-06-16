// achievements.js — Void Striker Achievement System
const Achievements = (() => {
  const KEY = 'voidstriker_achievements';

  const DEFS = [
    { id: 'first_blood',   icon: '🎯', name: 'FIRST BLOOD',    desc: 'Destroy your first enemy',         check: s => s.totalKills >= 1 },
    { id: 'wave5',         icon: '🌊', name: 'DEEP VOID',       desc: 'Reach wave 5',                     check: s => s.wave >= 5 },
    { id: 'wave10',        icon: '🚀', name: 'VOID VETERAN',    desc: 'Reach wave 10',                    check: s => s.wave >= 10 },
    { id: 'score1k',       icon: '⭐', name: 'STAR HUNTER',     desc: 'Score 1,000 points',               check: s => s.score >= 1000 },
    { id: 'score5k',       icon: '💫', name: 'GALAXY LEGEND',   desc: 'Score 5,000 points',               check: s => s.score >= 5000 },
    { id: 'tank_killer',   icon: '💜', name: 'TANK BUSTER',     desc: 'Destroy 5 tank enemies',           check: s => s.tankKills >= 5 },
    { id: 'no_damage_w1',  icon: '🛡️', name: 'UNTOUCHABLE',     desc: 'Complete wave 1 without getting hit', check: s => s.wave >= 2 && s.hitsOnWave1 === 0 },
    { id: 'powerup_first', icon: '⚡', name: 'POWERED UP',      desc: 'Collect your first power-up',     check: s => s.powerupsCollected >= 1 },
    { id: 'powerup5',      icon: '🔋', name: 'ENERGY HOARDER',  desc: 'Collect 5 power-ups',              check: s => s.powerupsCollected >= 5 },
    { id: 'perfectionist', icon: '👑', name: 'PERFECTIONIST',   desc: 'Clear a wave with full 3 lives',   check: s => s.wavesClearedFullHp >= 1 },
    { id: 'speedrun',      icon: '⚡', name: 'LIGHTNING PILOT', desc: 'Clear wave 3 in under 30 seconds', check: s => s.wave3ClearTime !== null && s.wave3ClearTime < 30 },
    { id: 'survivor',      icon: '❤️', name: 'SURVIVOR',        desc: 'Survive a hit and continue',       check: s => s.hitsTotal >= 1 && s.wave >= 2 },
  ];

  let unlocked = new Set();
  let session = resetSession();
  let onUnlock = null;

  function resetSession() {
    return {
      score: 0,
      wave: 1,
      totalKills: 0,
      tankKills: 0,
      hitsTotal: 0,
      hitsOnWave1: 0,
      powerupsCollected: 0,
      wavesClearedFullHp: 0,
      wave3ClearTime: null,
      _wave3Start: null,
      _currentLivesAtWaveStart: 3,
    };
  }

  function load() {
    try {
      const stored = JSON.parse(localStorage.getItem(KEY)) || [];
      unlocked = new Set(stored);
    } catch { unlocked = new Set(); }
  }

  function persist() {
    localStorage.setItem(KEY, JSON.stringify([...unlocked]));
  }

  function setUnlockCallback(fn) { onUnlock = fn; }

  function startGame(lives) {
    session = resetSession();
    session._currentLivesAtWaveStart = lives;
    load();
  }

  function check() {
    DEFS.forEach(def => {
      if (!unlocked.has(def.id) && def.check(session)) {
        unlocked.add(def.id);
        persist();
        if (onUnlock) onUnlock(def);
      }
    });
  }

  // Called by game at key events
  function onKill(type) {
    session.totalKills++;
    if (type === 'tank') session.tankKills++;
    check();
  }

  function onHit(currentLives, currentWave) {
    session.hitsTotal++;
    if (currentWave === 1) session.hitsOnWave1++;
    check();
  }

  function onWaveClear(wave, lives, elapsedSeconds) {
    session.wave = wave + 1;
    if (lives === 3) session.wavesClearedFullHp++;
    if (wave === 3 && session._wave3Start !== null) {
      session.wave3ClearTime = elapsedSeconds - session._wave3Start;
    }
    if (wave === 2) session._wave3Start = elapsedSeconds;
    session._currentLivesAtWaveStart = lives;
    check();
  }

  function onScoreUpdate(score) {
    session.score = score;
    check();
  }

  function onPowerupCollect() {
    session.powerupsCollected++;
    check();
  }

  function getAll() {
    load();
    return DEFS.map(d => ({ ...d, unlocked: unlocked.has(d.id) }));
  }

  function getUnlockedCount() {
    load();
    return unlocked.size;
  }

  function renderHTML() {
    const all = getAll();
    return all.map(a => `
      <div style="
        display:flex;align-items:center;gap:10px;padding:6px 8px;
        background:${a.unlocked ? '#00f0ff08' : '#0a0a0a'};
        border:1px solid ${a.unlocked ? '#00f0ff22' : '#111'};
        border-radius:3px;margin-bottom:4px;opacity:${a.unlocked ? 1 : 0.4}
      ">
        <span style="font-size:1.1rem">${a.unlocked ? a.icon : '🔒'}</span>
        <div>
          <div style="color:${a.unlocked ? '#00f0ff' : '#555'};font-size:0.72rem;letter-spacing:0.1em">${a.name}</div>
          <div style="color:#444;font-size:0.65rem">${a.desc}</div>
        </div>
      </div>
    `).join('');
  }

  return {
    load, startGame, setUnlockCallback,
    onKill, onHit, onWaveClear, onScoreUpdate, onPowerupCollect,
    getAll, getUnlockedCount, renderHTML,
    get session() { return session; }
  };
})();

