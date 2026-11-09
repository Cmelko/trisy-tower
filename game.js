(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const GW = 240;
  const GH = 360;
  const S = W / GW;

  const overlay = document.getElementById('overlay');
  const gameOverEl = document.getElementById('game-over');
  const mobileControls = document.getElementById('mobile-controls');
  const btnJump = document.getElementById('btn-jump');
  const btnLeft = document.getElementById('btn-left');
  const btnRight = document.getElementById('btn-right');
  const useMobileControls = 'ontouchstart' in window
    || navigator.maxTouchPoints > 0
    || window.matchMedia('(pointer: coarse)').matches
    || window.matchMedia('(max-width: 520px)').matches;
  const startBtn = document.getElementById('start-btn');
  const restartBtn = document.getElementById('restart-btn');

  ctx.imageSmoothingEnabled = true;
  if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = 'high';

  PixelArt.init(GW, GH, W, H);

  function isLeftHeld() {
    return keys.ArrowLeft || keys.KeyA;
  }

  function isRightHeld() {
    return keys.ArrowRight || keys.KeyD;
  }

  function isJumpHeld() {
    return keys.KeyW || keys.ArrowUp || keys.Space;
  }

  const SPEED_SCALE = 0.72;

  // Pevný krok. Všetky herné konštanty sú „na snímok pri 60 Hz“.
  const STEP_MS = 1000 / 60;
  const MAX_FRAME_MS = 100;
  const MAX_STEPS_PER_FRAME = 5;
  // Obtiažnosť prestane rásť, aby vysoké indexy neboli matematicky nehrateľné.
  const TIER_CAP = 16;
  // Zvislá medzera ≤ tento podiel výšky skoku z miesta.
  const GAP_APEX_RATIO = 0.85;

  // --- Hurry up: rýchlosť stúpania podlahy, px za jeden krok pri 60 Hz. ---
  // Tento blok ladí dizajnér. Hra ich inde neprepisuje.
  // Hodiny idú od hurryStartStep (prvé dosiahnutie 5. plošiny), nie od štartu hry.
  // Vzduch sa ráta ako každý iný simulačný krok. Skrytá karta hru zastaví, kroky vtedy nepribúdajú.
  const HURRY_START_PLATFORM = 5;
  const HURRY_BASE_SPEED = 0.25;
  const HURRY_STEP = 0.12;
  const HURRY_INTERVAL_STEPS = 30 * 60;
  const HURRY_MAX_SPEED = 1.5;

  // Vyšší skok z rozbehu. Pri nulovej rýchlosti ostáva presne jumpForce.
  const JUMP_BONUS_MAX = 0.18;
  const JUMP_MAX_APEX = 190;
  // Len zvuk. Zo stredu najkratšej plošiny (28 px) rozbeh často nedá plnú rýchlosť;
  // to je zámer ako v Icy Tower a fyzika skoku sa kvôli tomu nemení.
  const POWER_JUMP_SOUND_RATIO = 0.7;
  // Odraz od steny vo vzduchu rýchlosť mierne zvýši, ale len po tento násobok maxSpeed.
  const WALL_BOUNCE_MUL = 1.04;
  const WALL_BOUNCE_CAP = 1.08;

  // Zotrvačnosť (samostatná úprava, dá sa vrátiť). Zrýchlenie bolo 0,24, trenie všade 0,86.
  const RUN_ACCEL = 0.15;
  const GROUND_FRICTION = 0.90;
  const AIR_FRICTION = 0.97;

  const THEMES = [
    { name: 'Les', sky: ['#1e4d6b', '#5ba3d9', '#b8e6a0'], platformTop: '#5cd65c', coin: '#fde047', particle: '#bbf7d0', deco: 'forest' },
    { name: 'Ľadové hory', sky: ['#0c2340', '#3b82c4', '#dbeafe'], platformTop: '#e0f2fe', coin: '#fef08a', particle: '#bae6fd', deco: 'ice' },
    { name: 'Peklo', sky: ['#1a0505', '#7f1d1d', '#fb923c'], platformTop: '#ef4444', coin: '#fde68a', particle: '#fdba74', deco: 'hell' },
    { name: 'Vesmír', sky: ['#020014', '#1e1b4b', '#6d28d9'], platformTop: '#a78bfa', coin: '#f472b6', particle: '#e879f9', deco: 'space' },
    { name: 'Púšť', sky: ['#78350f', '#d97706', '#fde68a'], platformTop: '#fbbf24', coin: '#fef3c7', particle: '#fcd34d', deco: 'desert' },
    { name: 'Oceán', sky: ['#0c4a6e', '#0284c7', '#7dd3fc'], platformTop: '#38bdf8', coin: '#fde047', particle: '#bae6fd', deco: 'ocean' },
    { name: 'Jaskyňa', sky: ['#1c1917', '#44403c', '#57534e'], platformTop: '#a8a29e', coin: '#fde68a', particle: '#d6d3d1', deco: 'cave' },
    { name: 'Oblaky', sky: ['#38bdf8', '#bae6fd', '#ffffff'], platformTop: '#ffffff', coin: '#fde047', particle: '#e0f2fe', deco: 'clouds' },
    { name: 'Bažina', sky: ['#14532d', '#166534', '#4ade80'], platformTop: '#22c55e', coin: '#fef08a', particle: '#86efac', deco: 'swamp' },
    { name: 'Nočné mesto', sky: ['#0f172a', '#1e293b', '#6366f1'], platformTop: '#818cf8', coin: '#fde047', particle: '#c4b5fd', deco: 'city' },
    { name: 'Cukríkovo', sky: ['#fce7f3', '#f9a8d4', '#fbcfe8'], platformTop: '#f472b6', coin: '#fef08a', particle: '#fda4af', deco: 'candy' },
    { name: 'Dúhová veža', sky: ['#6366f1', '#a855f7', '#f472b6'], platformTop: '#e879f9', coin: '#fde047', particle: '#f0abfc', deco: 'rainbow' },
    { name: 'Kryštály', sky: ['#134e4a', '#0d9488', '#99f6e4'], platformTop: '#5eead4', coin: '#fef08a', particle: '#99f6e4', deco: 'crystal' },
    { name: 'Zlatý vrch', sky: ['#713f12', '#ca8a04', '#fde047'], platformTop: '#facc15', coin: '#fffbeb', particle: '#fde68a', deco: 'gold' },
  ];

  const PLATFORMS_PER_THEME = 50;
  const WALL_W = 10;
  const PLATFORM_H = 10;
  const PLATFORM_VIS_H = 12;
  const PLAYER_W = 22;
  const PLAYER_H = 28;
  const SPRITE_DISPLAY_H = 42;

  const POP_SKINS = {
    default: {
      idle: 'assets/1..png',
      jump: 'assets/2.png',
      run: ['assets/3.png', 'assets/4.png'],
    },
    ice: {
      idle: 'assets/1.lad.png',
      jump: 'assets/2.lad.png',
      run: ['assets/3.lad.png', 'assets/4.lad.png'],
    },
    lava: {
      idle: 'assets/1.lava.png',
      jump: 'assets/2.lava.png',
      run: ['assets/3.lava.png', 'assets/4.lava.png'],
    },
    space: {
      idle: 'assets/1.space.png',
      jump: 'assets/2.space.png',
      run: ['assets/3.space.png', 'assets/4.space.png'],
    },
  };

  const POP = {
    sprites: {},
    activeSkin: 'default',
  };
  const COYOTE_FRAMES = 10;
  const JUMP_BUFFER = 8;
  // Kombo padne, ak hráč po pristátí neskočí do ~3 s na zemi. Vo vzduchu časovač stojí.
  const COMBO_TIMEOUT = 180;
  // Minca je pevná zbieracia odmena, bez násobenia kombom.
  const COIN_SCORE = 50;
  // Stred hráča smie byť toľko px mimo plošiny, koľko ešte prekrýva telo (nie viac).
  const LAND_EDGE = Math.min(7, PLAYER_W / 2 - 4);

  let spritesReady = false;
  let gameOverDead = false;
  let jumpPressedTimer = 0;
  let lastTime = 0;
  let accum = 0;
  let preloadedThemeKey = '';

  let state = {};
  let keys = {};
  let jumpPressed = false;
  let running = false;
  let pausedByHide = false;
  let loopScheduled = false;
  let particles = [];
  let themeTransition = 0;
  let animFrame = 0;
  let lastRunStats = { score: 0, height: 0, combo: 0, floor: 0 };

  const playerNameInput = document.getElementById('player-name');
  const saveScoreBtn = document.getElementById('save-score-btn');
  const saveStatusEl = document.getElementById('save-status');
  const menuLeaderboardEl = document.getElementById('menu-leaderboard');
  const gameLeaderboardEl = document.getElementById('game-leaderboard');
  const menuPersonalBestEl = document.getElementById('menu-personal-best');
  const gamePersonalBestEl = document.getElementById('game-personal-best');

  function getPlayerName() {
    return (playerNameInput?.value || localStorage.getItem('trisy-player-name') || '').trim();
  }

  function updatePersonalBestDisplay() {
    if (!window.TrisyProgress) return;
    const device = TrisyProgress.getDeviceBest();
    const name = getPlayerName();
    const named = name ? TrisyProgress.getProgress(name) : null;
    const bestScore = Math.max(device.bestScore, named?.bestScore || 0);
    const bestPlatform = Math.max(device.bestPlatform || 0, named?.bestPlatform || 0);
    const bestCombo = Math.max(device.bestCombo || 0, named?.bestCombo || 0);
    const text = (bestScore > 0 || bestPlatform > 0 || bestCombo > 0)
      ? [
        `Maximum na tomto PC: ${bestScore.toLocaleString('sk-SK')} bodov${name && named?.bestScore ? ` (${name})` : ''}`,
        `Najvyššie poschodie: ${bestPlatform}`,
        `Najdlhšie kombo: ×${bestCombo}`,
      ].join('\n')
      : '';
    if (menuPersonalBestEl) menuPersonalBestEl.textContent = text;
    if (gamePersonalBestEl) gamePersonalBestEl.textContent = text;
  }

  function persistLastRun() {
    if (lastRunStats.score <= 0) return getPlayerName();
    if (window.TrisyProgress) TrisyProgress.saveDeviceBest(lastRunStats);
    updatePersonalBestDisplay();
    return getPlayerName();
  }

  function buildSaveEntry(name) {
    const prog = window.TrisyProgress ? TrisyProgress.getProgress(name) : null;
    return {
      name,
      score: Math.max(lastRunStats.score, prog?.bestScore || 0),
      height: Math.max(lastRunStats.height, prog?.bestHeight || 0),
      combo: Math.max(lastRunStats.combo, prog?.bestCombo || 0),
      floor: Math.max(lastRunStats.floor, prog?.bestFloor || 0),
    };
  }

  function pendingHistoryNames(excludeName = '') {
    if (!window.TrisyProgress || !window.TrisyLeaderboard) return [];
    return TrisyProgress.getAllProfiles()
      .filter((p) => p.name.toLowerCase() !== excludeName.trim().toLowerCase())
      .filter((p) => TrisyProgress.needsRemoteSync(p))
      .map((p) => p.name);
  }

  function sx(v) { return v * S; }
  function sy(v) { return v * S; }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function getPopSkinForTheme(themeIndex) {
    if (themeIndex === 1) return 'ice';
    if (themeIndex === 2) return 'lava';
    if (themeIndex === 3) return 'space';
    return 'default';
  }

  function applyPopSkin(themeIndex) {
    POP.activeSkin = getPopSkinForTheme(themeIndex);
  }

  function getTheme(platformIndex) {
    const idx = Math.max(0, platformIndex);
    return THEMES[Math.floor(idx / PLATFORMS_PER_THEME) % THEMES.length];
  }

  function getThemeForView() {
    return getTheme(state.highestPlatformIndex);
  }

  function getDifficulty(index) {
    const tier = Math.min(TIER_CAP, Math.floor(index / 25));
    const t = Math.min(tier / 12, 1);
    return {
      gravity: (0.26 + tier * 0.008) * SPEED_SCALE,
      jumpForce: (-9.8 - tier * 0.05) * SPEED_SCALE,
      platMinW: Math.max(30, 62 - tier * 3.0),
      platMaxW: Math.max(38, 100 - tier * 3.6),
      gapMin: 52 + tier * 1.2,
      gapMax: 72 + tier * 1.6,
      maxReach: Math.max(92, 188 - tier * 6),
      maxSpeed: (3.4 + tier * 0.08) * SPEED_SCALE,
      accel: (RUN_ACCEL + t * 0.022) * SPEED_SCALE,
    };
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function lerp(a, b, t) {
    return Math.round(a + (b - a) * t);
  }

  function lerpColor(a, b, t) {
    const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
    const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
    return `#${[0, 1, 2].map(i => lerp(pa[i], pb[i], t).toString(16).padStart(2, '0')).join('')}`;
  }

  function getBlendedTheme() {
    const cur = THEMES[state.themeIndex];
    const prev = THEMES[state.prevThemeIndex];
    const t = 1 - themeTransition;
    if (t <= 0 || state.prevThemeIndex === state.themeIndex) return cur;
    return {
      ...cur,
      sky: cur.sky.map((c, i) => lerpColor(prev.sky[i] || prev.sky[0], c, t)),
      platformTop: lerpColor(prev.platformTop, cur.platformTop, t),
    };
  }

  function isBgPixel(r, g, b, a) {
    if (a < 10) return true;
    return r > 248 && g > 248 && b > 248;
  }

  function removeCellBackground(data, imgW, x0, y0, cw, ch) {
    const visited = new Uint8Array(cw * ch);
    const queue = [];
    const vi = (lx, ly) => ly * cw + lx;
    const pi = (lx, ly) => ((y0 + ly) * imgW + (x0 + lx)) * 4;

    for (let x = 0; x < cw; x++) {
      for (const y of [0, ch - 1]) {
        const i = pi(x, y);
        if (isBgPixel(data[i], data[i + 1], data[i + 2], data[i + 3])) queue.push(x, y);
      }
    }
    for (let y = 0; y < ch; y++) {
      for (const x of [0, cw - 1]) {
        const i = pi(x, y);
        if (isBgPixel(data[i], data[i + 1], data[i + 2], data[i + 3])) queue.push(x, y);
      }
    }

    while (queue.length) {
      const x = queue.pop();
      const y = queue.pop();
      if (x < 0 || x >= cw || y < 0 || y >= ch) continue;
      const v = vi(x, y);
      if (visited[v]) continue;
      const i = pi(x, y);
      if (!isBgPixel(data[i], data[i + 1], data[i + 2], data[i + 3])) continue;
      visited[v] = 1;
      data[i + 3] = 0;
      queue.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
    }
  }

  function trimImageBounds(data, imgW, imgH) {
    let minX = imgW;
    let minY = imgH;
    let maxX = 0;
    let maxY = 0;
    for (let y = 0; y < imgH; y++) {
      for (let x = 0; x < imgW; x++) {
        const a = data[(y * imgW + x) * 4 + 3];
        if (a > 20) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }
    if (maxX < minX) return { sx: 0, sy: 0, sw: imgW, sh: imgH };
    const pad = 2;
    return {
      sx: Math.max(0, minX - pad),
      sy: Math.max(0, minY - pad),
      sw: Math.min(imgW, maxX - minX + 1 + pad * 2),
      sh: Math.min(imgH, maxY - minY + 1 + pad * 2),
    };
  }

  function processPopImage(img) {
    const off = document.createElement('canvas');
    off.width = img.width;
    off.height = img.height;
    const octx = off.getContext('2d');
    octx.drawImage(img, 0, 0);
    const imageData = octx.getImageData(0, 0, off.width, off.height);
    removeCellBackground(imageData.data, off.width, 0, 0, off.width, off.height);
    octx.putImageData(imageData, 0, 0);
    const bounds = trimImageBounds(imageData.data, off.width, off.height);
    const processed = new Image();
    return new Promise(resolve => {
      processed.onload = () => resolve({ img: processed, ...bounds });
      processed.src = off.toDataURL('image/png');
    });
  }

  function loadPopSprite(skinId, key, src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => processPopImage(img).then(spr => {
        if (!POP.sprites[skinId]) POP.sprites[skinId] = {};
        POP.sprites[skinId][key] = spr;
        resolve();
      });
      img.onerror = () => reject(new Error(`Chýba ${src}`));
      img.src = src;
    });
  }

  function loadPopSkinSet(skinId, files) {
    return Promise.all([
      loadPopSprite(skinId, 'idle', files.idle),
      loadPopSprite(skinId, 'jump', files.jump),
      loadPopSprite(skinId, 'run0', files.run[0]),
      loadPopSprite(skinId, 'run1', files.run[1]),
    ]);
  }

  function loadSprites() {
    return Promise.all(
      Object.entries(POP_SKINS).map(([skinId, files]) => loadPopSkinSet(skinId, files)),
    ).then(() => {
      spritesReady = true;
      applyPopSkin(state.themeIndex ?? 0);
      if (state.player) draw();
    });
  }

  function getPlayerAnimFrame() {
    const p = state.player;
    if (gameOverDead) return 'idle';

    if (!p.onGround) return 'jump';

    if (Math.abs(p.vx) > 0.4) {
      return Math.floor(animFrame / 10) % 2 === 0 ? 'run0' : 'run1';
    }
    return 'idle';
  }

  function drawPopFrame(key, gx, gy, facing) {
    const skin = POP.sprites[POP.activeSkin] || POP.sprites.default;
    const spr = skin?.[key];
    if (!spritesReady || !spr) return;
    const pxc = PixelArt.getCtx();
    const S = PixelArt.sc(1);
    const dh = SPRITE_DISPLAY_H * S;
    const scale = dh / spr.sh;
    const dw = spr.sw * scale;
    const dh2 = spr.sh * scale;
    const dx = PixelArt.sc(gx) - dw / 2;
    const dy = PixelArt.sc(gy + PLAYER_H) - dh2;

    pxc.imageSmoothingEnabled = true;
    if (pxc.imageSmoothingQuality) pxc.imageSmoothingQuality = 'high';
    if (facing < 0) {
      pxc.save();
      pxc.translate(dx + dw, dy);
      pxc.scale(-1, 1);
      pxc.drawImage(spr.img, spr.sx, spr.sy, spr.sw, spr.sh, 0, 0, dw, dh2);
      pxc.restore();
    } else {
      pxc.drawImage(spr.img, spr.sx, spr.sy, spr.sw, spr.sh, dx, dy, dw, dh2);
    }
  }
  function drawPlayer() {
    const p = state.player;
    const gy = p.y - state.cameraY;
    drawPopFrame(getPlayerAnimFrame(), p.x, gy, p.facing);
  }

  function drawCoins() {
    const theme = getTheme(state.highestPlatformIndex);
    for (const coin of state.coins) {
      if (coin.collected) continue;
      const py = coin.y - state.cameraY;
      if (py < -15 || py > GH + 15) continue;
      PixelArt.drawCoin(coin.x + 5, py + 5, theme.coin, Math.sin(coin.bob + animFrame * 0.08) * 2);
    }
  }

  function drawParticles() {
    for (const pt of particles) {
      PixelArt.drawParticle(pt.x, pt.y - state.cameraY, pt.color, pt.life, 18);
    }
  }

  function draw() {
    PixelArt.begin();
    const viewTheme = getThemeForView();
    const theme = getBlendedTheme();
    const prevTheme = THEMES[state.prevThemeIndex];
    const blendT = themeTransition > 0 && state.prevThemeIndex !== state.themeIndex
      ? 1 - themeTransition
      : 0;
    PixelArt.drawBackground(viewTheme, prevTheme, blendT);
    PixelArt.drawWalls(viewTheme, WALL_W);
    for (const plat of state.platforms) {
      PixelArt.drawPlatform(plat, getTheme(plat.index), state.cameraY);
    }
    drawCoins();
    drawPlayer();
    drawParticles();
    PixelArt.drawVignette();
    PixelArt.drawHUD(state, theme, PLATFORMS_PER_THEME);
    PixelArt.blit(ctx);
  }

  /* ── Herná logika ── */
  function resetGame() {
    gameOverDead = false;
    state = {
      player: {
        x: GW / 2, y: GH - 60, vx: 0, vy: 0, facing: 1,
        onGround: false, coyote: 0, jumpBuffer: 0, landedPlatform: -1, landTimer: 0,
        jumpedThisAir: false,
      },
      platforms: [], coins: [], cameraY: 0, score: 0, combo: 0, maxCombo: 0,
      comboPending: 0, comboTimer: 0, currentPlatformIndex: 0,
      highestPlatformIndex: 0, lastPlatformIndex: -1, themeIndex: 0, prevThemeIndex: 0,
      deadTimer: 0, simSteps: 0, hurryStartStep: null, hurrySpeed: 0, hurryTimer: 0, lastHurryAt: -9999,
    };
    particles = [];
    themeTransition = 0;
    applyPopSkin(0);
    jumpPressed = false;
    jumpPressedTimer = 0;
    addPlatform(GW / 2 - 30, GH - 40, 60, 0);
    let lastPlat = state.platforms[0];
    for (let i = 1; i < 10; i++) lastPlat = addReachablePlatform(lastPlat, i);
    const p = state.player;
    p.y = state.platforms[0].y - PLAYER_H;
    p.onGround = true;
    p.landedPlatform = 0;
  }

  function addPlatform(x, y, width, index) {
    state.platforms.push({ x, y, width, height: PLATFORM_H, index });
    if (Math.random() < 0.32 && index > 2) {
      state.coins.push({ x: x + width / 2 - 5, y: y - 16, collected: false, bob: Math.random() * 6.28 });
    }
  }

  function ensureHurryStart(s) {
    if (!s) return;
    if (s.hurryStartStep == null && (s.highestPlatformIndex || 0) >= HURRY_START_PLATFORM) {
      s.hurryStartStep = s.simSteps || 0;
    }
  }

  function hurrySpeed(simSteps, highestPlatform, hurryStartStep) {
    if ((highestPlatform || 0) < HURRY_START_PLATFORM) return 0;
    const start = Number(hurryStartStep);
    if (!Number.isFinite(start)) return 0;
    const elapsed = Math.max(0, Number(simSteps) - start);
    const level = Math.floor(elapsed / HURRY_INTERVAL_STEPS);
    return Math.min(HURRY_MAX_SPEED, HURRY_BASE_SPEED + HURRY_STEP * level);
  }

  function applyHurryClock(s) {
    ensureHurryStart(s);
    const speed = hurrySpeed(s.simSteps, s.highestPlatformIndex, s.hurryStartStep);
    s.hurrySpeed = speed;
    return { speed, hurryStartStep: s.hurryStartStep };
  }

  function isPowerJumpSound(vx, maxSpeed) {
    if (!(maxSpeed > 0)) return false;
    return Math.abs(vx) / maxSpeed >= POWER_JUMP_SOUND_RATIO;
  }

  function jumpVelocity(diff, vx) {
    const r = diff.maxSpeed > 0 ? Math.min(Math.abs(vx) / diff.maxSpeed, 1) : 0;
    const v = Math.abs(diff.jumpForce) * (1 + JUMP_BONUS_MAX * r * r);
    const vCap = Math.max(Math.abs(diff.jumpForce), Math.sqrt(2 * diff.gravity * JUMP_MAX_APEX));
    return -Math.min(v, vCap);
  }

  // Výška skoku z miesta v px, rovnaké poradie ako updatePlayer (najprv gravitácia, potom posun).
  function standingApex(diff) {
    let vy = jumpVelocity(diff, 0);
    let y = 0;
    let peak = 0;
    for (let i = 0; i < 900; i++) {
      vy += diff.gravity;
      y += vy;
      if (y < peak) peak = y;
      if (vy >= 0) break;
    }
    return -peak;
  }

  function addReachablePlatform(prevPlat, index) {
    const diff = getDifficulty(index);
    const gapCap = standingApex(diff) * GAP_APEX_RATIO;
    const gMin = Math.min(diff.gapMin, gapCap);
    const gMax = Math.min(diff.gapMax, gapCap);
    const gap = gMax <= gMin ? gMin : rand(gMin, gMax);
    const nextY = prevPlat.y - gap;

    const roll = Math.random();
    let pw;
    if (roll < 0.35) {
      pw = rand(diff.platMinW * 0.62, diff.platMinW);
    } else if (roll < 0.48) {
      pw = rand(diff.platMaxW * 0.85, diff.platMaxW);
    } else {
      pw = rand(diff.platMinW, diff.platMaxW);
    }
    pw = Math.max(28, Math.min(pw, GW - WALL_W * 2 - 8));

    const prevCenter = prevPlat.x + prevPlat.width / 2;
    const reach = diff.maxReach * rand(0.7, 1.0);
    const minX = Math.max(WALL_W + 2, prevCenter - reach - pw / 2);
    const maxX = Math.min(GW - WALL_W - pw - 2, prevCenter + reach - pw / 2);
    const x = minX >= maxX ? minX : rand(minX, maxX);
    addPlatform(x, nextY, pw, index);
    return state.platforms[state.platforms.length - 1];
  }

  function generatePlatforms() {
    const topVisible = state.cameraY - 80;
    while (state.platforms[state.platforms.length - 1].y > topVisible) {
      const h = state.platforms[state.platforms.length - 1];
      addReachablePlatform(h, h.index + 1);
    }
    const removeBelow = state.cameraY + GH + 120;
    state.platforms = state.platforms.filter(p => p.y < removeBelow);
    state.coins = state.coins.filter(c => c.y < removeBelow);
  }

  function updateTheme() {
    const newIndex = Math.floor(state.highestPlatformIndex / PLATFORMS_PER_THEME) % THEMES.length;
    if (newIndex !== state.themeIndex) {
      state.prevThemeIndex = state.themeIndex;
      state.themeIndex = newIndex;
      themeTransition = 1;
      applyPopSkin(newIndex);
      GameSfx.themeChange();
      GameSfx.setTheme(newIndex);
    }
  }

  function updateFootsteps(p, diff) {
    const dt = 1 / 60;
    if (p.onGround && Math.abs(p.vx) > 0.5 && p.landTimer === 0) {
      const denom = Math.max(0.01, diff.maxSpeed - 0.5);
      const speed01 = Math.min(1, Math.max(0, (Math.abs(p.vx) - 0.5) / denom));
      const interval = 0.28 + (0.09 - 0.28) * speed01;
      p.stepCooldown = (p.stepCooldown || 0) - dt;
      if (p.stepCooldown <= 0) {
        GameSfx.step(p.stepVariant | 0);
        p.stepVariant = 1 - (p.stepVariant | 0);
        p.stepCooldown = interval;
      }
    } else {
      p.stepCooldown = 0;
    }
  }

  function tryJump() {
    const p = state.player;
    const diff = getDifficulty(state.highestPlatformIndex);
    const wantJump = isJumpHeld() || p.jumpBuffer > 0 || jumpPressedTimer > 0;

    if (wantJump && (p.onGround || p.coyote > 0) && !p.jumpedThisAir) {
      p.vy = jumpVelocity(diff, p.vx);
      p.onGround = false;
      p.coyote = 0;
      p.jumpBuffer = 0;
      p.jumpedThisAir = true;
      jumpPressed = false;
      jumpPressedTimer = 0;
      if (isPowerJumpSound(p.vx, diff.maxSpeed)) GameSfx.powerJump();
      else GameSfx.jump(Math.abs(p.vy));
      for (let i = 0; i < 5; i++) {
        particles.push({ x: p.x + rand(-4, 4), y: p.y + PLAYER_H, vx: rand(-1, 1), vy: rand(0.5, 2), life: 14, color: '#fff', size: 2 });
      }
    }
  }

  // Ukončí kombo a pripíše bonus: súčet druhých mocnín preskočených poschodí.
  function breakCombo(s) {
    const bonus = s.comboPending || 0;
    if (bonus) s.score += bonus;
    s.comboPending = 0;
    s.combo = 0;
    s.comboTimer = 0;
    return bonus;
  }

  // Pristátie zo vzduchu. Kombo drží len skok o ≥2 plošiny; +1, rovnaká alebo nižšia ho končí.
  function applyAirLanding(s, platIndex) {
    const floors = platIndex - s.currentPlatformIndex;
    let kind = 'step';
    if (floors >= 2) {
      s.combo += 1;
      s.comboPending += floors * floors;
      s.maxCombo = Math.max(s.maxCombo, s.combo);
      s.comboTimer = COMBO_TIMEOUT;
      kind = 'combo';
    } else {
      breakCombo(s);
      kind = floors === 1 ? 'step' : 'drop';
    }
    if (platIndex > s.highestPlatformIndex) {
      s.score += (platIndex - s.highestPlatformIndex) * 10;
      s.highestPlatformIndex = platIndex;
    }
    s.currentPlatformIndex = platIndex;
    s.lastPlatformIndex = Math.max(s.lastPlatformIndex, platIndex);
    return kind;
  }

  // Časovač beží len na zemi. Vo vzduchu sa comboTimer nemení.
  function tickCombo(s, onGround) {
    if (!s || s.combo <= 0 || !onGround) return false;
    if (s.comboTimer > 0) s.comboTimer--;
    if (s.comboTimer <= 0) {
      breakCombo(s);
      return true;
    }
    return false;
  }

  function landOnPlatform(plat, wasOnGround) {
    const p = state.player;
    const wasAir = !wasOnGround;
    p.y = plat.y - PLAYER_H;
    p.vy = 0;
    p.onGround = true;
    p.coyote = COYOTE_FRAMES;
    p.jumpedThisAir = false;
    if (!wasAir) {
      p.landedPlatform = plat.index;
      return;
    }
    p.landTimer = 12;
    const prevHigh = state.highestPlatformIndex;
    const kind = applyAirLanding(state, plat.index);
    if (kind === 'combo') GameSfx.combo(state.combo);
    else GameSfx.land();
    if (plat.index > prevHigh) {
      updateTheme();
      const theme = getTheme(plat.index);
      for (let i = 0; i < 5; i++) {
        particles.push({ x: p.x + rand(-5, 5), y: p.y + PLAYER_H, vx: rand(-1.5, 1.5), vy: rand(-2, -0.5), life: 16, color: theme.particle, size: 2.5 });
      }
    }
    p.landedPlatform = plat.index;
  }

  function playerOverlapsPlatform(px, plat) {
    return px > plat.x - LAND_EDGE && px < plat.x + plat.width + LAND_EDGE;
  }

  function tryLandOnPlatform(wasOnGround) {
    const p = state.player;
    if (p.vy <= 0) return false;
    const prevFeet = p.y + PLAYER_H - p.vy;
    const feet = p.y + PLAYER_H;
    for (const plat of state.platforms) {
      if (playerOverlapsPlatform(p.x, plat) &&
          feet >= plat.y - 1 && prevFeet <= plat.y + 4) {
        landOnPlatform(plat, wasOnGround);
        return true;
      }
    }
    return false;
  }

  function handleWalls() {
    const p = state.player;
    const diff = getDifficulty(state.highestPlatformIndex);
    const halfW = PLAYER_W / 2;
    const leftBound = WALL_W + halfW;
    const rightBound = GW - WALL_W - halfW;

    const bounce = (dir) => {
      const incoming = Math.abs(p.vx);
      if (p.onGround) {
        p.vx = dir * incoming;
        return;
      }
      const cap = diff.maxSpeed * WALL_BOUNCE_CAP;
      p.vx = dir * Math.min(cap, incoming * WALL_BOUNCE_MUL);
      p.wallCap = WALL_BOUNCE_CAP;
      if (incoming > 0.4 && (p.wallSfxCd || 0) <= 0) {
        GameSfx.wallBounce();
        p.wallSfxCd = 5;
      }
    };

    if (p.x < leftBound) {
      p.x = leftBound;
      if (p.vx < 0) bounce(1);
    } else if (p.x > rightBound) {
      p.x = rightBound;
      if (p.vx > 0) bounce(-1);
    }
  }

  function updatePlayer() {
    const p = state.player;
    const diff = getDifficulty(state.highestPlatformIndex);

    if (gameOverDead) {
      p.vy += diff.gravity;
      p.y += p.vy * 0.5;
      if (state.deadTimer > 0) state.deadTimer--;
      if (state.deadTimer <= 0) endGame();
      return;
    }

    const left = isLeftHeld();
    const right = isRightHeld();

    if (left && right) {
      p.vx *= 0.84;
    } else {
      if (left) {
        p.vx -= diff.accel;
        p.facing = -1;
      }
      if (right) {
        p.vx += diff.accel;
        p.facing = 1;
      }
    }
    if (!left && !right) {
      p.vx *= p.onGround ? GROUND_FRICTION : AIR_FRICTION;
    }

    const speedCap = diff.maxSpeed * (p.wallCap || 1);
    p.vx = Math.max(-speedCap, Math.min(speedCap, p.vx));
    if (p.wallCap && p.wallCap > 1) p.wallCap = Math.max(1, p.wallCap - 0.02);
    if (p.wallSfxCd > 0) p.wallSfxCd--;
    updateFootsteps(p, diff);
    tryJump();
    p.vy += diff.gravity;
    p.x += p.vx;
    p.y += p.vy;
    handleWalls();
    const wasOnGround = p.onGround;
    p.onGround = false;
    if (!tryLandOnPlatform(wasOnGround)) {
      if (wasOnGround) p.coyote = COYOTE_FRAMES;
      if (p.coyote > 0) p.coyote--;
    }
    syncJumpBuffer(p, isJumpHeld());
    if (p.landTimer > 0) p.landTimer--;
    tickCombo(state, p.onGround && !p.jumpedThisAir);
    for (const coin of state.coins) {
      if (coin.collected) continue;
      const dx = p.x - (coin.x + 5);
      const dy = p.y + PLAYER_H / 2 - (coin.y + 5);
      if (dx * dx + dy * dy < 14 * 14) {
        coin.collected = true;
        state.score += COIN_SCORE;
        GameSfx.coin();
        for (let i = 0; i < 7; i++) {
          particles.push({ x: coin.x + 5, y: coin.y + 5, vx: rand(-2, 2), vy: rand(-2, 2), life: 20, color: getTheme(state.highestPlatformIndex).coin, size: 2 });
        }
      }
    }
    const spd = applyHurryClock(state).speed;
    if (spd > state.hurrySpeed + 1e-6) {
      state.hurryTimer = 120;
      if (state.simSteps - state.lastHurryAt >= 150) {
        state.lastHurryAt = state.simSteps;
        const low = (p.y - state.cameraY) > GH * 0.72;
        GameSfx.hurry(spd >= HURRY_MAX_SPEED - 1e-6 || low);
      }
    }
    state.hurrySpeed = spd;
    if (state.hurryTimer > 0) state.hurryTimer--;
    if (spd > 0) state.cameraY -= spd;
    const targetCam = p.y - GH * 0.42;
    if (targetCam < state.cameraY) state.cameraY = targetCam;
    if (p.y - state.cameraY > GH + 30) {
      if (!gameOverDead) {
        gameOverDead = true;
        state.deadTimer = 50;
        breakCombo(state);
      }
    }
  }

  function updateParticles() {
    particles = particles.filter(pt => { pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.08; pt.life--; return pt.life > 0; });
    if (themeTransition > 0) themeTransition -= 0.025;
    animFrame++;
  }

  function preloadThemes() {
    if (!state || !state.platforms) return;
    const base = state.highestPlatformIndex || 0;
    const a = getTheme(base).deco;
    const b = getTheme(base + PLATFORMS_PER_THEME).deco;
    const c = getTheme(base + PLATFORMS_PER_THEME * 2).deco;
    const key = `${a}|${b}|${c}`;
    if (key === preloadedThemeKey || !PixelArt.ensureThemes) return;
    preloadedThemeKey = key;
    PixelArt.ensureThemes(a, b, c);
  }

  function update() {
    state.simSteps = (state.simSteps || 0) + 1;
    updatePlayer();
    generatePlatforms();
    updateParticles();
    preloadThemes();
  }

  function consumeSteps(acc, dtMs, stepFn) {
    if (dtMs < 0) dtMs = 0;
    if (dtMs > MAX_FRAME_MS) dtMs = MAX_FRAME_MS;
    acc += dtMs;
    let n = 0;
    // 1e-4 ms, aby 144 Hz nezostalo navždy tesne pod celým krokom.
    while (acc + 1e-4 >= STEP_MS && n < MAX_STEPS_PER_FRAME) {
      stepFn();
      acc -= STEP_MS;
      n++;
    }
    if (n >= MAX_STEPS_PER_FRAME) acc = 0;
    return acc;
  }

  function loop(now) {
    loopScheduled = false;
    if (!running) return;
    if (typeof now !== 'number') {
      loopScheduled = true;
      requestAnimationFrame(loop);
      return;
    }
    if (!lastTime) lastTime = now;
    const dt = now - lastTime;
    lastTime = now;
    accum = consumeSteps(accum, dt, update);
    draw();
    loopScheduled = true;
    requestAnimationFrame(loop);
  }

  function setMobileControls(visible) {
    if (!mobileControls || !useMobileControls) return;
    mobileControls.classList.toggle('visible', visible);
    mobileControls.classList.toggle('hidden', !visible);
    mobileControls.setAttribute('aria-hidden', visible ? 'false' : 'true');
    if (!visible) clearTouchKeys();
  }

  function startGame() {
    pausedByHide = false;
    if (gameOverEl && !gameOverEl.classList.contains('hidden') && lastRunStats.score > 0) {
      persistLastRun();
    }
    GameSfx.init();
    GameSfx.startMusic(0);
    overlay.classList.add('hidden');
    gameOverEl.classList.add('hidden');
    setMobileControls(true);
    canvas.focus();
    resetGame();
    lastTime = 0;
    accum = 0;
    running = true;
    if (!loopScheduled) loop();
  }

  function refreshLeaderboards() {
    if (!window.TrisyLeaderboard) return;
    TrisyLeaderboard.loadScores().then((scores) => {
      TrisyLeaderboard.render(menuLeaderboardEl, scores);
      TrisyLeaderboard.render(gameLeaderboardEl, scores);
    }).catch(() => {});
  }

  function endGame() {
    if (state) breakCombo(state);
    running = false;
    setMobileControls(false);
    GameSfx.gameOver();
    GameSfx.stopMusic();
    const theme = THEMES[state.themeIndex];
    const heightM = Math.max(0, Math.floor((GH - 40 - state.player.y) / 5));
    lastRunStats = {
      score: state.score,
      height: heightM,
      combo: state.maxCombo,
      floor: state.themeIndex,
      platform: state.highestPlatformIndex,
    };
    document.getElementById('final-score').textContent = `Skóre: ${state.score}`;
    document.getElementById('final-height').textContent = `Najvyššie poschodie: ${state.highestPlatformIndex} | Výška: ${heightM} m`;
    document.getElementById('final-theme').textContent = `Najdlhšie kombo: ×${state.maxCombo} | Prostredie: ${theme.name}`;
    if (playerNameInput) {
      playerNameInput.value = playerNameInput.value.trim() || localStorage.getItem('trisy-player-name') || '';
    }
    persistLastRun();
    updatePersonalBestDisplay();
    if (saveStatusEl) {
      const pending = pendingHistoryNames(getPlayerName());
      let msg = TrisyLeaderboard?.hasRemoteSave()
        ? 'Zadaj meno a klikni Uložiť do rebríčka.'
        : 'Globálne ukladanie ešte nie je nastavené (pozri SETUP-LEADERBOARD.md).';
      if (pending.length) {
        msg += ` V histórii čaká aj: ${pending.join(', ')}.`;
      }
      saveStatusEl.textContent = msg;
    }
    refreshLeaderboards();
    gameOverEl.classList.remove('hidden');
  }

  function isJumpCode(code) {
    return code === 'ArrowUp' || code === 'KeyW' || code === 'Space';
  }

  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', startGame);

  if (saveScoreBtn) {
    saveScoreBtn.addEventListener('click', async () => {
      if (!window.TrisyLeaderboard) return;
      const name = (playerNameInput?.value || '').trim();
      if (!name) {
        if (saveStatusEl) saveStatusEl.textContent = 'Najprv zadaj meno.';
        return;
      }
      persistLastRun();
      if (window.TrisyProgress) TrisyProgress.saveRun(name, lastRunStats);
      const before = window.TrisyProgress ? TrisyProgress.getProgress(name) : null;
      const entry = buildSaveEntry(name);
      const othersToSync = window.TrisyProgress
        ? TrisyProgress.getAllProfiles().filter(
          (p) => p.name.toLowerCase() !== name.toLowerCase()
            && TrisyProgress.needsRemoteSync(p),
        )
        : [];
      saveScoreBtn.disabled = true;
      if (saveStatusEl) saveStatusEl.textContent = 'Odosielam skóre...';
      localStorage.setItem('trisy-player-name', name);
      try {
        let scores = await TrisyLeaderboard.saveScore(entry);
        if (window.TrisyProgress) TrisyProgress.markRemoteSynced(name, entry);
        scores = await TrisyLeaderboard.syncLocalHistory(name);
        TrisyLeaderboard.render(menuLeaderboardEl, scores);
        TrisyLeaderboard.render(gameLeaderboardEl, scores);
        TrisyLeaderboard._onRemoteRefresh = (fresh) => {
          TrisyLeaderboard.render(menuLeaderboardEl, fresh);
          TrisyLeaderboard.render(gameLeaderboardEl, fresh);
          if (saveStatusEl) saveStatusEl.textContent = 'Uložené! Rebríček sa aktualizoval.';
        };
        let msg = 'Uložené! Rebríček sa doplní o pár sekúnd.';
        if (othersToSync.length) {
          msg += ` Doplnené aj skóre: ${othersToSync.map((p) => p.name).join(', ')}.`;
        }
        if (window.TrisyProgress) {
          const after = TrisyProgress.getProgress(name);
          const unlocks = TrisyProgress.newUnlocks(before || after, after);
          if (unlocks.length) {
            const labels = unlocks.map((id) => TrisyProgress.SKIN_RULES.find((r) => r.id === id)?.label || id);
            msg += ` Odomknuté: ${labels.join(', ')}.`;
          }
        }
        if (saveStatusEl) saveStatusEl.textContent = msg;
      } catch (err) {
        if (saveStatusEl) {
          saveStatusEl.textContent = err.message === 'no-save-backend'
            ? 'Chýba TRISY_SAVE_URL alebo LEADERBOARD_TOKEN — pozri SETUP-LEADERBOARD.md'
            : err.name === 'AbortError'
              ? 'Časový limit — skontroluj internet a skús znova.'
              : 'Nepodarilo sa uložiť — skús znova o chvíľu.';
        }
      }
      saveScoreBtn.disabled = false;
    });
  }

  refreshLeaderboards();
  updatePersonalBestDisplay();

  window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (isJumpCode(e.code)) {
      noteJumpPress();
      e.preventDefault();
    }
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });

  function clearTouchKeys() {
    keys.ArrowLeft = false;
    keys.KeyA = false;
    keys.ArrowRight = false;
    keys.KeyD = false;
    keys.ArrowUp = false;
    keys.KeyW = false;
    keys.Space = false;
  }

  function releaseInputs() {
    Object.keys(keys).forEach((k) => { keys[k] = false; });
    jumpPressed = false;
    jumpPressedTimer = 0;
    if (state.player) state.player.jumpBuffer = 0;
    clearTouchKeys();
    [btnJump, btnLeft, btnRight].forEach((btn) => btn?.classList.remove('pressed'));
  }

  function pauseForHide() {
    releaseInputs();
    if (!running) return;
    pausedByHide = true;
    running = false;
    lastTime = 0;
    accum = 0;
  }

  function resumeFromHide() {
    if (!pausedByHide) return;
    if (overlay && !overlay.classList.contains('hidden')) return;
    if (gameOverEl && !gameOverEl.classList.contains('hidden')) return;
    pausedByHide = false;
    lastTime = 0;
    accum = 0;
    running = true;
    if (!loopScheduled) loop();
  }

  window.addEventListener('blur', () => {
    releaseInputs();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseForHide();
    else resumeFromHide();
  });
  window.addEventListener('pagehide', () => pauseForHide());
  window.addEventListener('pageshow', () => {
    if (!document.hidden) resumeFromHide();
  });

  function syncJumpBuffer(p, held) {
    if (!p) return;
    if (held) p.jumpBuffer = JUMP_BUFFER;
    if (jumpPressedTimer > 0) {
      p.jumpBuffer = Math.max(p.jumpBuffer, jumpPressedTimer);
      jumpPressedTimer--;
    }
    jumpPressed = jumpPressedTimer > 0;
    if (p.jumpBuffer > 0 && !held) p.jumpBuffer--;
  }

  function noteJumpPress() {
    jumpPressed = true;
    jumpPressedTimer = JUMP_BUFFER;
    if (state.player) state.player.jumpBuffer = Math.max(state.player.jumpBuffer, JUMP_BUFFER);
  }

  function bindHoldButton(btn, onPress, onRelease) {
    if (!btn) return;
    let activeId = null;
    const press = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      activeId = e.pointerId;
      try { btn.setPointerCapture(e.pointerId); } catch (err) { /* syntetická udalosť alebo už uvoľnený pointer */ }
      btn.classList.add('pressed');
      onPress();
    };
    const release = (e) => {
      if (activeId === null) return;
      if (e.pointerId !== undefined && e.pointerId !== activeId) return;
      e.preventDefault();
      activeId = null;
      btn.classList.remove('pressed');
      onRelease();
    };
    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('lostpointercapture', release);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  bindHoldButton(btnLeft, () => {
    keys.ArrowLeft = true;
    keys.KeyA = true;
  }, () => {
    keys.ArrowLeft = false;
    keys.KeyA = false;
  });

  bindHoldButton(btnRight, () => {
    keys.ArrowRight = true;
    keys.KeyD = true;
  }, () => {
    keys.ArrowRight = false;
    keys.KeyD = false;
  });

  bindHoldButton(btnJump, () => {
    keys.ArrowUp = true;
    keys.KeyW = true;
    noteJumpPress();
  }, () => {
    keys.ArrowUp = false;
    keys.KeyW = false;
  });

  function measureGeneratedGaps(count) {
    const saved = state;
    state = { platforms: [], coins: [] };
    addPlatform(GW / 2 - 30, 10000, 60, 0);
    let prev = state.platforms[0];
    let bad = 0;
    let worstRatio = 0;
    let worstIndex = 0;
    for (let i = 1; i <= count; i++) {
      const next = addReachablePlatform(prev, i);
      const gap = prev.y - next.y;
      const apex = standingApex(getDifficulty(i));
      const limit = apex * GAP_APEX_RATIO;
      if (!(gap <= limit + 1e-6)) bad++;
      const ratio = apex > 0 ? gap / apex : 1;
      if (ratio > worstRatio) {
        worstRatio = ratio;
        worstIndex = i;
      }
      prev = next;
    }
    state = saved;
    return { bad, checked: count, worstRatio, worstIndex };
  }

  function runScenario(actions) {
    const s = {
      combo: 0,
      comboPending: 0,
      comboTimer: 0,
      maxCombo: 0,
      score: 0,
      highestPlatformIndex: 0,
      currentPlatformIndex: 0,
      lastPlatformIndex: 0,
    };
    for (const action of actions) {
      if (action.land != null) applyAirLanding(s, action.land);
      if (action.ticks) {
        for (let i = 0; i < action.ticks; i++) tickCombo(s, true);
      }
      if (action.air) {
        for (let i = 0; i < action.air; i++) tickCombo(s, false);
      }
      if (action.fall) breakCombo(s);
      if (action.coin) s.score += COIN_SCORE;
    }
    return {
      score: s.score,
      combo: s.combo,
      pending: s.comboPending,
      timer: s.comboTimer,
      maxCombo: s.maxCombo,
      highest: s.highestPlatformIndex,
    };
  }

  function sampleJump(hz, seconds, vx) {
    const diff = getDifficulty(0);
    let y = 0;
    let vy = jumpVelocity(diff, vx);
    let acc = 0;
    const frame = 1000 / hz;
    const frames = Math.round(seconds * hz);
    let steps = 0;
    const yAtStep = [];
    for (let i = 0; i < frames; i++) {
      acc = consumeSteps(acc, frame, () => {
        vy += diff.gravity;
        y += vy;
        steps++;
        yAtStep[steps] = y;
      });
    }
    return { steps, y, yAtStep };
  }

  window.TrisyTest = {
    STEP_MS,
    MAX_FRAME_MS,
    MAX_STEPS_PER_FRAME,
    TIER_CAP,
    GAP_APEX_RATIO,
    LAND_EDGE,
    JUMP_BUFFER,
    COMBO_TIMEOUT,
    COIN_SCORE,
    HURRY_START_PLATFORM,
    HURRY_BASE_SPEED,
    HURRY_STEP,
    HURRY_INTERVAL_STEPS,
    HURRY_MAX_SPEED,
    JUMP_BONUS_MAX,
    JUMP_MAX_APEX,
    POWER_JUMP_SOUND_RATIO,
    isPowerJumpSound,
    RUN_ACCEL,
    GROUND_FRICTION,
    AIR_FRICTION,
    WALL_BOUNCE_MUL,
    WALL_BOUNCE_CAP,
    consumeSteps,
    getDifficulty,
    standingApex,
    jumpVelocity,
    hurrySpeed,
    applyHurryClock,
    measureGeneratedGaps,
    runScenario,
    sampleJump,
    playerOverlapsPlatform,
    noteJumpPress,
    syncJumpBuffer,
    readInput() {
      return {
        left: !!(keys.ArrowLeft || keys.KeyA),
        right: !!(keys.ArrowRight || keys.KeyD),
        jump: !!(keys.ArrowUp || keys.KeyW || keys.Space),
        space: !!keys.Space,
        jumpPressed,
        jumpPressedTimer,
        jumpBuffer: state.player ? state.player.jumpBuffer : 0,
      };
    },
    readClock() {
      return {
        running,
        pausedByHide,
        lastTime,
        accum,
        hurryStartStep: state.hurryStartStep,
        simSteps: state.simSteps,
        hurrySpeed: state.hurrySpeed,
        highest: state.highestPlatformIndex,
      };
    },
    pumpJumpBuffer(frames, held) {
      const p = state.player || { jumpBuffer: 0 };
      for (let i = 0; i < frames; i++) syncJumpBuffer(p, held);
      return {
        jumpPressed,
        jumpPressedTimer,
        jumpBuffer: p.jumpBuffer,
      };
    },
  };

  loadSprites().then(() => PixelArt.loadBackgrounds()).then(() => {
    resetGame();
    draw();
  }).catch(err => {
    console.error(err);
    resetGame();
    draw();
  });
})();
