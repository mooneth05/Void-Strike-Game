/**
 * boss.js — VOID STRIKER
 * Boss enemy system. Bosses spawn every 5 waves and have multiple health
 * phases, unique attack patterns, and a dramatic intro sequence.
 *
 * Usage:
 *   Boss.spawn(wave, canvasW, canvasH);   // create a boss for this wave tier
 *   Boss.update(state, enemyBullets, dt); // call each frame
 *   Boss.draw(ctx);                       // call in draw loop
 *   Boss.isAlive();                       // false once defeated
 *   Boss.isDead();                        // true once death animation ends
 *   Boss.getScore();                      // score reward on death
 *   Boss.reset();                         // clear any active boss
 */

'use strict';

const Boss = (() => {
  // ── Constants ─────────────────────────────────────────────────────────────
  const PHASE_COLORS = [
    { fill: '#aa44ff', glow: '#aa44ff66', accent: '#dd88ff' }, // phase 1 – purple
    { fill: '#ff4466', glow: '#ff446666', accent: '#ff8888' }, // phase 2 – red
    { fill: '#ff8800', glow: '#ff880066', accent: '#ffcc44' }, // phase 3 – orange (enrage)
  ];

  // ── State ─────────────────────────────────────────────────────────────────
  let _boss   = null;   // the active boss object, null if none
  let _W = 480, _H = 560;

  // ── Internal helpers ──────────────────────────────────────────────────────
  function _tier(wave) {
    // tier 1 = wave 5, tier 2 = wave 10, …
    return Math.floor(wave / 5);
  }

  function _maxHp(tier) {
    return 20 + tier * 15;   // 35, 50, 65, …
  }

  function _phaseIdx(boss) {
    const pct = boss.hp / boss.maxHp;
    if (pct > 0.66) return 0;
    if (pct > 0.33) return 1;
    return 2;
  }

  // ── Attack factory ────────────────────────────────────────────────────────
  function _buildAttacks(tier) {
    // Returns an array of attack descriptors; higher tiers unlock more.
    const attacks = [
      {
        id      : 'spread',
        cooldown: 90,
        timer   : 30,
        fire(boss, bullets) {
          const count = 5 + tier * 2;
          for (let i = 0; i < count; i++) {
            const angle = (Math.PI / (count - 1)) * i;
            bullets.push({
              x   : boss.x,
              y   : boss.y + boss.h / 2,
              vx  : Math.cos(angle) * 2.5,
              vy  : Math.abs(Math.sin(angle)) * 2.5 + 0.5,
              r   : 5,
              color: PHASE_COLORS[_phaseIdx(boss)].accent,
              isBoss: true,
            });
          }
        },
      },
      {
        id      : 'laser',
        cooldown: 150,
        timer   : 0,
        chargeMax: 40,
        charge  : 0,
        firing  : false,
        fireTimer: 0,
        fireMax : 30,
        fire(boss, bullets) {
          // handled in update as a beam — push a marker bullet
          bullets.push({
            x: boss.x, y: boss.y + boss.h / 2,
            vx: 0, vy: 4.5,
            r: 8, color: '#ffdd00',
            isBoss: true, isLaser: true,
          });
        },
      },
    ];

    if (tier >= 2) {
      attacks.push({
        id      : 'burst',
        cooldown: 60,
        timer   : 0,
        fire(boss, bullets) {
          // 3-way aimed at player (state.playerX/Y stored on boss)
          const dx = boss._px - boss.x;
          const dy = boss._py - (boss.y + boss.h / 2);
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const offsets = [-0.15, 0, 0.15];
          offsets.forEach(off => {
            const angle = Math.atan2(dy, dx) + off;
            bullets.push({
              x: boss.x, y: boss.y + boss.h / 2,
              vx: Math.cos(angle) * 3.5,
              vy: Math.sin(angle) * 3.5,
              r: 4, color: '#ff4466',
              isBoss: true,
            });
          });
        },
      });
    }

    return attacks;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  function reset() { _boss = null; }

  /**
   * Spawn a new boss.
   * @param {number} wave      - current game wave (must be multiple of 5)
   * @param {number} canvasW
   * @param {number} canvasH
   */
  function spawn(wave, canvasW, canvasH) {
    _W = canvasW; _H = canvasH;
    const tier  = _tier(wave);
    const maxHp = _maxHp(tier);
    const w = 80 + tier * 8;
    const h = 60 + tier * 6;

    _boss = {
      x        : canvasW / 2,          // centre x
      y        : -h,                    // starts above canvas (intro slide-in)
      targetY  : 90,
      w, h,
      hp       : maxHp,
      maxHp,
      tier,
      wave,
      alive    : true,
      dead     : false,
      intro    : true,                  // slides in from top
      pulse    : 0,
      wobble   : 0,                     // horizontal drift
      wobbleDir: 1,
      wobbleSpeed: 0.8 + tier * 0.2,
      attacks  : _buildAttacks(tier),
      deathTimer: 0,
      deathParticles: [],
      hitFlash : 0,
      _px      : canvasW / 2,          // last known player X
      _py      : canvasH - 70,         // last known player Y
    };
  }

  function isAlive() { return _boss !== null && _boss.alive; }
  function isDead()  { return _boss !== null && _boss.dead;  }
  function getScore(){ return _boss ? 500 + _boss.tier * 300 : 0; }

  /**
   * Update boss logic. Call every frame.
   * @param {object}   state        - shared game state (playerX, playerY, …)
   * @param {object[]} enemyBullets - array to push new projectiles into
   * @param {number}   dt           - delta time multiplier (usually 1)
   */
  function update(state, enemyBullets, dt = 1) {
    if (!_boss || _boss.dead) return;

    const b = _boss;
    b.pulse   += 0.06 * dt;
    b._px      = state.playerX;
    b._py      = state.playerY;

    // ── Intro slide-in ────────────────────────────────────────────────────
    if (b.intro) {
      b.y += 2.5 * dt;
      if (b.y >= b.targetY) { b.y = b.targetY; b.intro = false; }
      return;
    }

    // ── Death sequence ────────────────────────────────────────────────────
    if (!b.alive) {
      b.deathTimer += dt;
      // spawn explosion particles
      if (b.deathTimer % 8 < dt * 2) _deathBurst(b);
      if (b.deathTimer > 90) b.dead = true;
      return;
    }

    // ── Movement ──────────────────────────────────────────────────────────
    b.wobble += b.wobbleSpeed * b.wobbleDir * dt;
    if (Math.abs(b.wobble) > (_W / 2 - b.w / 2 - 20)) b.wobbleDir *= -1;
    b.x = _W / 2 + b.wobble;

    if (b.hitFlash > 0) b.hitFlash -= dt;

    // ── Attacks ───────────────────────────────────────────────────────────
    const phase    = _phaseIdx(b);
    const speedMult = 1 + phase * 0.3;   // enrage: attacks fire faster

    b.attacks.forEach(atk => {
      atk.timer -= dt * speedMult;
      if (atk.timer <= 0) {
        atk.fire(b, enemyBullets);
        atk.timer = atk.cooldown;
      }
    });
  }

  /**
   * Register a hit on the boss. Returns true if boss was killed.
   * @param {number} damage
   */
  function hit(damage = 1) {
    if (!_boss || !_boss.alive) return false;
    _boss.hp     -= damage;
    _boss.hitFlash = 8;
    if (_boss.hp <= 0) {
      _boss.hp    = 0;
      _boss.alive = false;
      return true;
    }
    return false;
  }

  /**
   * Test if a bullet (x,y,r) intersects the boss hitbox.
   * @returns {boolean}
   */
  function checkBulletHit(bx, by, br = 4) {
    if (!_boss || !_boss.alive || _boss.intro) return false;
    const b = _boss;
    return bx > b.x - b.w / 2 - br &&
           bx < b.x + b.w / 2 + br &&
           by > b.y             - br &&
           by < b.y + b.h       + br;
  }

  /**
   * Test if the player (px,py) collides with the boss body.
   */
  function checkPlayerCollision(px, py) {
    if (!_boss || !_boss.alive || _boss.intro) return false;
    const b = _boss;
    return Math.abs(px - b.x) < b.w / 2 + 10 &&
           Math.abs(py - (b.y + b.h / 2)) < b.h / 2 + 14;
  }

  // ── Draw ──────────────────────────────────────────────────────────────────
  function draw(ctx) {
    if (!_boss) return;
    const b = _boss;
    if (!b.alive) { _drawDeathParticles(ctx, b); return; }

    const phase = _phaseIdx(b);
    const col   = PHASE_COLORS[phase];

    ctx.save();

    // Glow halo
    const grd = ctx.createRadialGradient(b.x, b.y + b.h / 2, 0, b.x, b.y + b.h / 2, b.w);
    grd.addColorStop(0, col.glow);
    grd.addColorStop(1, 'transparent');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(b.x, b.y + b.h / 2, b.w, 0, Math.PI * 2);
    ctx.fill();

    // Hit flash
    if (b.hitFlash > 0) {
      ctx.globalAlpha = Math.min(1, b.hitFlash / 4);
      ctx.fillStyle   = '#ffffff';
      ctx.fillRect(b.x - b.w / 2, b.y, b.w, b.h);
      ctx.globalAlpha = 1;
    }

    // Boss hull — hexagonal silhouette
    _drawHull(ctx, b, col);

    // Cannons
    _drawCannons(ctx, b, col);

    // HP bar
    _drawHPBar(ctx, b, phase);

    // Wave / tier label
    ctx.font              = '9px "Courier New"';
    ctx.fillStyle         = col.accent;
    ctx.textAlign         = 'center';
    ctx.textBaseline      = 'bottom';
    const tierLabel = b.tier <= 1 ? 'VOID GUARDIAN' :
                      b.tier <= 2 ? 'VOID OVERLORD'  : 'VOID TITAN';
    ctx.fillText(`◆ ${tierLabel} ◆`, b.x, b.y - 6);

    ctx.restore();
  }

  function _drawHull(ctx, b, col) {
    const { x, y, w, h, pulse } = b;
    const hw = w / 2, hh = h / 2;
    const cx = x, cy = y + hh;

    // Outer hex
    ctx.strokeStyle = col.fill;
    ctx.lineWidth   = 2;
    ctx.fillStyle   = `${col.fill}22`;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a  = (Math.PI / 3) * i - Math.PI / 6;
      const px = cx + Math.cos(a) * hw;
      const py = cy + Math.sin(a) * hh * 0.8;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Inner core, pulsing
    ctx.fillStyle = col.fill + Math.floor(60 + Math.sin(pulse) * 40).toString(16);
    ctx.beginPath();
    ctx.arc(cx, cy, 14 + Math.sin(pulse) * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col.accent;
    ctx.lineWidth   = 1;
    ctx.stroke();

    // Spin ring
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(pulse * 0.6);
    ctx.strokeStyle = col.accent + '88';
    ctx.lineWidth   = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function _drawCannons(ctx, b, col) {
    const cx = b.x, cy = b.y + b.h / 2;
    const positions = [[-b.w * 0.35, b.h * 0.2], [b.w * 0.35, b.h * 0.2], [0, b.h * 0.38]];
    positions.forEach(([ox, oy]) => {
      ctx.fillStyle   = col.fill;
      ctx.strokeStyle = col.accent;
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.ellipse(cx + ox, cy + oy, 5, 8, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    });
  }

  function _drawHPBar(ctx, b, phase) {
    const barW = b.w + 20, barH = 6;
    const bx   = b.x - barW / 2, by = b.y - 18;
    const pct  = b.hp / b.maxHp;
    const barColor = phase === 0 ? '#aa44ff' : phase === 1 ? '#ff4466' : '#ff8800';

    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(bx, by, barW, barH);
    ctx.fillStyle = barColor;
    ctx.fillRect(bx, by, barW * pct, barH);
    ctx.strokeStyle = barColor + '66';
    ctx.lineWidth   = 1;
    ctx.strokeRect(bx, by, barW, barH);

    ctx.font          = '8px "Courier New"';
    ctx.fillStyle     = '#888';
    ctx.textAlign     = 'center';
    ctx.textBaseline  = 'middle';
    ctx.fillText(`${b.hp} / ${b.maxHp}`, b.x, by + barH / 2);
  }

  // ── Death particles ───────────────────────────────────────────────────────
  function _deathBurst(b) {
    const colors = ['#ff4466', '#ffdd00', '#ff8800', '#aa44ff', '#ffffff'];
    for (let i = 0; i < 8; i++) {
      const a  = Math.random() * Math.PI * 2;
      const sp = Math.random() * 4 + 1;
      b.deathParticles.push({
        x    : b.x + (Math.random() - 0.5) * b.w,
        y    : b.y + Math.random() * b.h,
        vx   : Math.cos(a) * sp,
        vy   : Math.sin(a) * sp,
        r    : Math.random() * 5 + 2,
        life : 1,
        decay: Math.random() * 0.025 + 0.01,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  function _drawDeathParticles(ctx, b) {
    b.deathParticles = b.deathParticles.filter(p => {
      p.x    += p.vx; p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) return false;
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return true;
    });
  }

  return {
    spawn,
    reset,
    update,
    draw,
    hit,
    checkBulletHit,
    checkPlayerCollision,
    isAlive,
    isDead,
    getScore,
    get currentPhase() { return _boss ? _phaseIdx(_boss) : -1; },
    get hp()    { return _boss ? _boss.hp    : 0; },
    get maxHp() { return _boss ? _boss.maxHp : 0; },
  };
})();

if (typeof module !== 'undefined') module.exports = Boss;

