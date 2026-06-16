/**
 * shop.js — VOID STRIKER
 * Between-wave upgrade shop. Players spend score points on permanent
 * upgrades that persist for the current run (not across sessions).
 *
 * Usage:
 *   Shop.open(score, wave, onClose);   // show shop UI; onClose(newScore) called on exit
 *   Shop.reset();                      // call at game start to clear run upgrades
 *   Shop.applyToState(state);          // patch game state object with purchased upgrades
 *   Shop.getUpgrades();                // returns current upgrade levels
 */

'use strict';

const Shop = (() => {
  // ── Upgrade catalogue ─────────────────────────────────────────────────────
  // Each upgrade has up to `maxLevel` tiers. Cost scales per tier.
  const CATALOGUE = [
    {
      id       : 'fireRate',
      icon     : '⚡',
      name     : 'FIRE RATE',
      desc     : 'Reduce shot cooldown',
      maxLevel : 4,
      baseCost : 300,
      costMult : 1.6,
      effect   : level => ({ shootCooldownMult: Math.max(0.2, 1 - level * 0.18) }),
      preview  : level => `Cooldown ×${(Math.max(0.2, 1 - level * 0.18)).toFixed(2)}`,
    },
    {
      id       : 'movespeed',
      icon     : '💨',
      name     : 'MOVE SPEED',
      desc     : 'Increase ship velocity',
      maxLevel : 3,
      baseCost : 250,
      costMult : 1.5,
      effect   : level => ({ playerSpeed: 5 + level * 1.2 }),
      preview  : level => `Speed +${(level * 1.2).toFixed(1)}`,
    },
    {
      id       : 'bulletDmg',
      icon     : '🔫',
      name     : 'BULLET POWER',
      desc     : 'Bullets deal extra damage',
      maxLevel : 3,
      baseCost : 400,
      costMult : 1.7,
      effect   : level => ({ bulletDamage: 1 + level }),
      preview  : level => `Damage ×${1 + level}`,
    },
    {
      id       : 'shield',
      icon     : '🛡️',
      name     : 'SHIELD RECHARGE',
      desc     : 'Start next wave with +1 life',
      maxLevel : 2,
      baseCost : 600,
      costMult : 2.0,
      effect   : () => ({}),          // applied separately in applyToState
      preview  : level => `+${level} life at wave start`,
    },
    {
      id       : 'spreadUnlock',
      icon     : '🔱',
      name     : 'SPREAD SHOT',
      desc     : 'Permanently unlock spread shot',
      maxLevel : 1,
      baseCost : 800,
      costMult : 1,
      effect   : level => ({ spreadShot: level > 0 }),
      preview  : () => 'Always active',
    },
    {
      id       : 'scoreBonus',
      icon     : '⭐',
      name     : 'SCORE BOOST',
      desc     : 'Earn bonus score per kill',
      maxLevel : 3,
      baseCost : 200,
      costMult : 1.4,
      effect   : level => ({ scoreBonusPerKill: level * 5 }),
      preview  : level => `+${level * 5} pts / kill`,
    },
  ];

  // ── Run-state ─────────────────────────────────────────────────────────────
  let _levels = {};          // { upgradeId: currentLevel }
  CATALOGUE.forEach(u => { _levels[u.id] = 0; });

  // ── Cost calculation ──────────────────────────────────────────────────────
  function _cost(upg, nextLevel) {
    return Math.round(upg.baseCost * Math.pow(upg.costMult, nextLevel - 1));
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Reset all upgrades for a new run. */
  function reset() {
    CATALOGUE.forEach(u => { _levels[u.id] = 0; });
  }

  /** Returns shallow copy of current upgrade levels. */
  function getUpgrades() { return { ..._levels }; }

  /**
   * Apply purchased upgrades to the live game-state object.
   * Call after each wave clear (and after shield upgrade is considered).
   * @param {object} state  - the shared game state (same shape as in main game)
   */
  function applyToState(state) {
    // Collect all effects
    CATALOGUE.forEach(upg => {
      const lv = _levels[upg.id];
      if (lv > 0) {
        const patch = upg.effect(lv);
        Object.assign(state, patch);
      }
    });
  }

  /**
   * Extra life grant from shield upgrade — call once per wave start.
   * @param {object} state
   */
  function applyWaveStartBonuses(state) {
    const shieldLv = _levels['shield'] || 0;
    if (shieldLv > 0) {
      state.lives = Math.min(3, (state.lives || 0) + shieldLv);
    }
  }

  // ── HTML renderer ─────────────────────────────────────────────────────────
  /**
   * Renders the shop as an HTML string.
   * Buttons call Shop._buy(id) which is exposed globally while the shop is open.
   *
   * @param {number}   score    - current player score (budget)
   * @param {number}   wave     - current wave number (flavour)
   * @param {Function} onClose  - callback(remainingScore) when player exits
   */
  function open(score, wave, onClose) {
    let _score = score;

    // Expose buy handler globally so inline onclick can reach it
    window._shopBuy = function (id) {
      const upg      = CATALOGUE.find(u => u.id === id);
      if (!upg) return;
      const nextLv   = _levels[id] + 1;
      if (nextLv > upg.maxLevel) return;
      const price    = _cost(upg, nextLv);
      if (_score < price) return;
      _score        -= price;
      _levels[id]    = nextLv;
      // Re-render in place
      const el = document.getElementById('shop-overlay');
      if (el) el.innerHTML = _buildHTML(_score, wave, onClose);
    };

    const overlay = document.getElementById('overlay');
    if (!overlay) { onClose(_score); return; }
    overlay.style.display = 'flex';
    overlay.innerHTML     = _buildHTML(_score, wave, onClose);

    // Close button wires
    document.getElementById('shop-close-btn').onclick = () => {
      delete window._shopBuy;
      overlay.innerHTML = '';
      overlay.style.display = 'none';
      onClose(_score);
    };
  }

  function _buildHTML(score, wave, onClose) {
    const cardStyle = `
      display:flex;align-items:center;gap:10px;padding:8px 10px;
      border:1px solid #1a1a2e;border-radius:3px;margin-bottom:6px;
      background:#0a0a18;cursor:pointer;transition:border-color 0.15s;
    `;

    const items = CATALOGUE.map(upg => {
      const lv       = _levels[upg.id];
      const maxed    = lv >= upg.maxLevel;
      const nextLv   = lv + 1;
      const price    = maxed ? 0 : _cost(upg, nextLv);
      const canAfford= !maxed && score >= price;
      const pips     = Array.from({ length: upg.maxLevel }, (_, i) =>
        `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;
         background:${i < lv ? '#00f0ff' : '#1a1a2e'};margin-right:3px"></span>`
      ).join('');

      return `
        <div style="${cardStyle}opacity:${canAfford||maxed?1:0.45}"
             onclick="${maxed?'':`window._shopBuy('${upg.id}')`}">
          <span style="font-size:1.4rem;line-height:1">${upg.icon}</span>
          <div style="flex:1;min-width:0">
            <div style="color:#00f0ff;font-size:0.72rem;letter-spacing:0.1em;
                        display:flex;justify-content:space-between;align-items:center">
              <span>${upg.name}</span>
              <span style="color:${maxed?'#ffdd00':canAfford?'#fff':'#555'};font-size:0.68rem">
                ${maxed ? '✓ MAX' : score >= price ? `${price.toLocaleString()} PTS` : `${price.toLocaleString()} PTS`}
              </span>
            </div>
            <div style="color:#444;font-size:0.63rem;margin:2px 0">${upg.desc}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-top:3px">
              <div>${pips}</div>
              ${lv > 0 ? `<span style="color:#555;font-size:0.6rem">${upg.preview(lv)}</span>` : ''}
            </div>
          </div>
        </div>`;
    }).join('');

    return `
      <div id="shop-overlay" style="width:100%;max-width:340px">
        <div style="text-align:center;margin-bottom:12px">
          <div style="color:#00f0ff;font-size:1.1rem;letter-spacing:0.3em;
                      text-shadow:0 0 16px #00f0ff">UPGRADE SHOP</div>
          <div style="color:#555;font-size:0.68rem;letter-spacing:0.1em;margin-top:2px">
            WAVE ${wave} COMPLETE
          </div>
          <div style="color:#fff;font-size:1rem;margin-top:6px;letter-spacing:0.2em">
            💰 <span id="shop-score">${score.toLocaleString()}</span> PTS
          </div>
        </div>

        <div style="max-height:340px;overflow-y:auto;padding-right:2px">
          ${items}
        </div>

        <button id="shop-close-btn" class="btn" style="width:100%;margin-top:10px">
          CONTINUE →
        </button>
      </div>`;
  }

  return {
    reset,
    open,
    getUpgrades,
    applyToState,
    applyWaveStartBonuses,
  };
})();

if (typeof module !== 'undefined') module.exports = Shop;

