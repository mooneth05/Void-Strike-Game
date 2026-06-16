// powerups.js — Void Striker Power-Up System
const Powerups = (() => {

  const TYPES = {
    shield: {
      icon: '🛡️', color: '#00f0ff', glowColor: '#00f0ff66',
      label: 'SHIELD', desc: '+1 LIFE',
      duration: 0,
      apply(state) {
        if (state.lives < 3) {
          state.lives = Math.min(3, state.lives + 1);
          if (state.updateHearts) state.updateHearts();
        }
      }
    },
    rapidfire: {
      icon: '⚡', color: '#ffdd00', glowColor: '#ffdd0066',
      label: 'RAPID FIRE', desc: '5 SEC',
      duration: 300, // frames
      apply(state) { state.shootCooldownMult = 0.3; },
      expire(state) { state.shootCooldownMult = 1; }
    },
    spread: {
      icon: '🔱', color: '#ff44ff', glowColor: '#ff44ff66',
      label: 'SPREAD SHOT', desc: '5 SEC',
      duration: 300,
      apply(state) { state.spreadShot = true; },
      expire(state) { state.spreadShot = false; }
    },
    nuke: {
      icon: '💥', color: '#ff6600', glowColor: '#ff660066',
      label: 'NUKE', desc: 'CLEAR SCREEN',
      duration: 0,
      apply(state) {
        if (state.nukeEnemies) state.nukeEnemies();
      }
    },
    slow: {
      icon: '❄️', color: '#88ddff', glowColor: '#88ddff44',
      label: 'TIME SLOW', desc: '4 SEC',
      duration: 240,
      apply(state) { state.enemySpeedMult = 0.3; },
      expire(state) { state.enemySpeedMult = 1; }
    },
  };

  const TYPE_KEYS = Object.keys(TYPES);
  let items = [];
  let activeEffects = []; // {type, timer, duration}
  let spawnTimer = 0;
  let SPAWN_INTERVAL = 400; // frames between spawns
  let onCollect = null;

  function reset() {
    items = [];
    activeEffects = [];
    spawnTimer = 0;
  }

  function setCollectCallback(fn) { onCollect = fn; }

  function setSpawnInterval(frames) { SPAWN_INTERVAL = frames; }

  function spawn(canvasW) {
    const type = TYPE_KEYS[Math.floor(Math.random() * TYPE_KEYS.length)];
    const def = TYPES[type];
    items.push({
      x: 30 + Math.random() * (canvasW - 60),
      y: -20,
      vy: 1.5,
      type,
      def,
      pulse: 0,
      size: 18,
      life: 1,
    });
  }

  function update(canvasW, canvasH, state) {
    spawnTimer++;
    if (spawnTimer >= SPAWN_INTERVAL) {
      spawn(canvasW);
      spawnTimer = 0;
      // Slightly decrease interval as waves progress (min 200)
      SPAWN_INTERVAL = Math.max(200, SPAWN_INTERVAL - 5);
    }

    // Move items
    items = items.filter(p => {
      p.y += p.vy;
      p.pulse += 0.08;
      return p.y < canvasH + 30;
    });

    // Collision with player
    items = items.filter(p => {
      const dx = Math.abs(p.x - state.playerX);
      const dy = Math.abs(p.y - state.playerY);
      if (dx < 24 && dy < 24) {
        // Collect!
        p.def.apply(state);
        if (p.def.duration > 0) {
          // Remove existing effect of same type
          activeEffects = activeEffects.filter(e => e.type !== p.type);
          activeEffects.push({ type: p.type, def: p.def, timer: p.def.duration });
        }
        if (onCollect) onCollect(p.type, p.def);
        return false;
      }
      return true;
    });

    // Tick active effects
    activeEffects = activeEffects.filter(e => {
      e.timer--;
      if (e.timer <= 0) {
        if (e.def.expire) e.def.expire(state);
        return false;
      }
      return true;
    });
  }

  function draw(ctx) {
    items.forEach(p => {
      const { x, y, def, pulse, size } = p;

      // Outer glow
      const grd = ctx.createRadialGradient(x, y, 0, x, y, size + 8);
      grd.addColorStop(0, def.glowColor);
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(x, y, size + 8, 0, Math.PI * 2);
      ctx.fill();

      // Body
      ctx.save();
      ctx.globalAlpha = 0.85 + Math.sin(pulse) * 0.15;
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.stroke();

      // Icon
      ctx.font = `${size - 2}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.def.icon, x, y);

      // Label
      ctx.font = '8px "Courier New"';
      ctx.fillStyle = def.color;
      ctx.globalAlpha = 0.7;
      ctx.fillText(def.label, x, y + size + 10);

      ctx.restore();
    });
  }

  function drawHUD(ctx, canvasW) {
    if (activeEffects.length === 0) return;
    let ox = 8;
    activeEffects.forEach(e => {
      const pct = e.timer / e.def.duration;
      const barW = 56;
      const barH = 5;

      ctx.save();
      ctx.globalAlpha = 0.9;

      // Background pill
      ctx.fillStyle = '#0a0a1a';
      ctx.strokeStyle = e.def.color + '88';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(ox, 8, barW, 18, 3);
      ctx.fill();
      ctx.stroke();

      // Progress bar
      ctx.fillStyle = e.def.color + '66';
      ctx.beginPath();
      ctx.roundRect(ox + 2, 8 + 11, (barW - 4) * pct, barH, 2);
      ctx.fill();

      // Label
      ctx.font = '7px "Courier New"';
      ctx.fillStyle = e.def.color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(e.def.label, ox + 4, 9);

      ctx.restore();
      ox += barW + 6;
    });
  }

  function getActiveTypes() {
    return activeEffects.map(e => e.type);
  }

  return {
    TYPES, reset, update, draw, drawHUD,
    setCollectCallback, setSpawnInterval, getActiveTypes,
    get items() { return items; }
  };
})();

