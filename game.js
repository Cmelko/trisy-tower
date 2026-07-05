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
  const JUMP_BUFFER = 18;

  let spritesReady = false;
  let gameOverDead = false;

  let state = {};
  let keys = {};
  let jumpPressed = false;
  let running = false;
  let particles = [];
  let themeTransition = 0;
  let animFrame = 0;
  let lastRunStats = { score: 0, height: 0, combo: 0, floor: 0 };

  const playerNameInput = document.getElementById('player-name');
  const saveScoreBtn = document.getElementById('save-score-btn');
  const saveStatusEl = document.getElementById('save-status');
  const menuLeaderboardEl = document.getElementById('menu-leaderboard');
  const gameLeaderboardEl = document.getElementById('game-leaderboard');

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
    const tier = Math.floor(index / 25);
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
      accel: (0.24 + t * 0.022) * SPEED_SCALE,
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
      highestPlatformIndex: 0, lastPlatformIndex: -1, themeIndex: 0, prevThemeIndex: 0,
      deadTimer: 0,
    };
    particles = [];
    themeTransition = 0;
    applyPopSkin(0);
    jumpPressed = false;
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

  function addReachablePlatform(prevPlat, index) {
    const diff = getDifficulty(index);
    const gap = rand(diff.gapMin, diff.gapMax);
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

  function tryJump() {
    const p = state.player;
    const diff = getDifficulty(state.highestPlatformIndex);
    const wantJump = isJumpHeld() || p.jumpBuffer > 0 || jumpPressed;

    if (wantJump && (p.onGround || p.coyote > 0) && !p.jumpedThisAir) {
      const boost = Math.min(Math.abs(p.vx) * 0.2, 1.8);
      p.vy = diff.jumpForce - boost;
      p.onGround = false;
      p.coyote = 0;
      p.jumpBuffer = 0;
      p.jumpedThisAir = true;
      jumpPressed = false;
      GameSfx.jump(Math.abs(p.vy));
      for (let i = 0; i < 5; i++) {
        particles.push({ x: p.x + rand(-4, 4), y: p.y + PLAYER_H, vx: rand(-1, 1), vy: rand(0.5, 2), life: 14, color: '#fff', size: 2 });
      }
    }
  }

  function landOnPlatform(plat, wasOnGround) {
    const p = state.player;
    const wasAir = !wasOnGround;
    p.y = plat.y - PLAYER_H;
    p.vy = 0;
    if (wasAir) {
      p.landTimer = 12;
      if (plat.index <= state.lastPlatformIndex) {
        GameSfx.land();
      }
    }
    p.onGround = true;
    p.coyote = COYOTE_FRAMES;
    p.jumpedThisAir = false;
    if (plat.index > state.lastPlatformIndex) {
      state.lastPlatformIndex = plat.index;
      state.highestPlatformIndex = Math.max(state.highestPlatformIndex, plat.index);
      state.combo++;
      state.maxCombo = Math.max(state.maxCombo, state.combo);
      state.score += 10 + Math.min(state.combo, 25) * 3;
      updateTheme();
      GameSfx.platform(state.combo);
      const theme = getTheme(plat.index);
      for (let i = 0; i < 5; i++) {
        particles.push({ x: p.x + rand(-5, 5), y: p.y + PLAYER_H, vx: rand(-1.5, 1.5), vy: rand(-2, -0.5), life: 16, color: theme.particle, size: 2.5 });
      }
    }
    p.landedPlatform = plat.index;
  }

  function tryLandOnPlatform(wasOnGround) {
    const p = state.player;
    if (p.vy <= 0) return false;
    const prevFeet = p.y + PLAYER_H - p.vy;
    const feet = p.y + PLAYER_H;
    for (const plat of state.platforms) {
      if (p.x > plat.x + 2 && p.x < plat.x + plat.width - 2 &&
          feet >= plat.y - 1 && prevFeet <= plat.y + 4) {
        landOnPlatform(plat, wasOnGround);
        return true;
      }
    }
    return false;
  }

  function handleWalls() {
    const p = state.player;
    const halfW = PLAYER_W / 2;
    const leftBound = WALL_W + halfW;
    const rightBound = GW - WALL_W - halfW;

    if (p.x < leftBound) {
      p.x = leftBound;
      if (p.vx < 0) p.vx = -p.vx;
    } else if (p.x > rightBound) {
      p.x = rightBound;
      if (p.vx > 0) p.vx = -p.vx;
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
      p.vx *= 0.86;
    }

    p.vx = Math.max(-diff.maxSpeed, Math.min(diff.maxSpeed, p.vx));
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
    if (isJumpHeld() || jumpPressed) p.jumpBuffer = JUMP_BUFFER;
    if (p.jumpBuffer > 0) p.jumpBuffer--;
    if (p.landTimer > 0) p.landTimer--;
    for (const coin of state.coins) {
      if (coin.collected) continue;
      const dx = p.x - (coin.x + 5);
      const dy = p.y + PLAYER_H / 2 - (coin.y + 5);
      if (dx * dx + dy * dy < 14 * 14) {
        coin.collected = true;
        state.score += 50 + state.combo * 5;
        GameSfx.coin();
        for (let i = 0; i < 7; i++) {
          particles.push({ x: coin.x + 5, y: coin.y + 5, vx: rand(-2, 2), vy: rand(-2, 2), life: 20, color: getTheme(state.highestPlatformIndex).coin, size: 2 });
        }
      }
    }
    const targetCam = p.y - GH * 0.42;
    if (targetCam < state.cameraY) {
      state.score += Math.floor((state.cameraY - targetCam) * 0.08);
      state.cameraY = targetCam;
    }
    if (p.y - state.cameraY > GH + 30) {
      if (!gameOverDead) {
        gameOverDead = true;
        state.deadTimer = 50;
      }
    }
  }

  function updateParticles() {
    particles = particles.filter(pt => { pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.08; pt.life--; return pt.life > 0; });
    if (themeTransition > 0) themeTransition -= 0.025;
    animFrame++;
  }

  function update() { updatePlayer(); generatePlatforms(); updateParticles(); }

  function loop() {
    if (!running) return;
    update();
    draw();
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
    GameSfx.init();
    GameSfx.startMusic(0);
    overlay.classList.add('hidden');
    gameOverEl.classList.add('hidden');
    setMobileControls(true);
    canvas.focus();
    resetGame();
    running = true;
    loop();
  }

  function refreshLeaderboards() {
    if (!window.TrisyLeaderboard) return;
    TrisyLeaderboard.loadScores().then((scores) => {
      TrisyLeaderboard.render(menuLeaderboardEl, scores);
      TrisyLeaderboard.render(gameLeaderboardEl, scores);
    });
  }

  function endGame() {
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
    };
    document.getElementById('final-score').textContent = `Skóre: ${state.score} (combo ×${state.maxCombo})`;
    document.getElementById('final-height').textContent = `Výška: ${heightM} m | Platforiem: ${state.highestPlatformIndex} | Poschodie: ${theme.name}`;
    document.getElementById('final-theme').textContent = `Najvyššie prostredie: ${theme.name}`;
    if (playerNameInput) {
      playerNameInput.value = playerNameInput.value.trim() || localStorage.getItem('trisy-player-name') || '';
    }
    if (saveStatusEl) {
      saveStatusEl.textContent = TrisyLeaderboard?.hasRemoteSave()
        ? 'Zadaj meno a ulož — skóre ostane v scores.txt na GitHube.'
        : 'Globálne ukladanie ešte nie je nastavené (pozri SETUP-LEADERBOARD.md).';
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
      const name = playerNameInput?.value || 'Hráč';
      const before = window.TrisyProgress ? TrisyProgress.getProgress(name) : null;
      saveScoreBtn.disabled = true;
      if (saveStatusEl) saveStatusEl.textContent = 'Odosielam skóre...';
      localStorage.setItem('trisy-player-name', name.trim());
      try {
        const scores = await TrisyLeaderboard.saveScore({
          name,
          score: lastRunStats.score,
          height: lastRunStats.height,
          combo: lastRunStats.combo,
          floor: lastRunStats.floor,
        });
        TrisyLeaderboard.render(menuLeaderboardEl, scores);
        TrisyLeaderboard.render(gameLeaderboardEl, scores);
        TrisyLeaderboard._onRemoteRefresh = (fresh) => {
          TrisyLeaderboard.render(menuLeaderboardEl, fresh);
          TrisyLeaderboard.render(gameLeaderboardEl, fresh);
          if (saveStatusEl) saveStatusEl.textContent = 'Uložené! Rebríček sa aktualizoval.';
        };
        let msg = 'Odoslané! Rebríček sa doplní o pár sekúnd.';
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

  window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (isJumpCode(e.code)) {
      jumpPressed = true;
      e.preventDefault();
    }
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });

  window.addEventListener('blur', () => {
    Object.keys(keys).forEach(k => { keys[k] = false; });
    [btnJump, btnLeft, btnRight].forEach((btn) => btn?.classList.remove('pressed'));
  });

  function clearTouchKeys() {
    keys.ArrowLeft = false;
    keys.KeyA = false;
    keys.ArrowRight = false;
    keys.KeyD = false;
    keys.ArrowUp = false;
    keys.KeyW = false;
  }

  function bindHoldButton(btn, onPress, onRelease) {
    if (!btn) return;
    const press = (e) => {
      e.preventDefault();
      btn.classList.add('pressed');
      onPress();
    };
    const release = (e) => {
      e.preventDefault();
      btn.classList.remove('pressed');
      onRelease();
    };
    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointerleave', release);
    btn.addEventListener('pointercancel', release);
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
    jumpPressed = true;
  }, () => {
    keys.ArrowUp = false;
    keys.KeyW = false;
  });

  loadSprites().then(() => PixelArt.loadBackgrounds()).then(() => {
    resetGame();
    draw();
  }).catch(err => {
    console.error(err);
    resetGame();
    draw();
  });
})();
