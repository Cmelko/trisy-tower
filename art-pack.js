/* Art pack: pozadia, 9-slice plošiny a plyšový jednorožec.
   Záloha ostáva procedurálne kreslenie v pixel-art.js. Fyzika sa tu nemení. */
window.ArtPack = (() => {
  'use strict';

  const DECOS = [
    'forest', 'ice', 'hell', 'space', 'desert', 'ocean', 'cave',
    'clouds', 'swamp', 'city', 'candy', 'rainbow', 'crystal', 'gold',
  ];

  // Kľúč = theme.deco v game.js. Tráva je len v lese, ľad je sneh, peklo je láva.
  const THEME_KIND = {
    forest: 'grass',
    ice: 'snow',
    hell: 'lava',
    space: 'metal',
    desert: 'sand',
    ocean: 'coral',
    cave: 'rock',
    clouds: 'cloud',
    swamp: 'mud',
    city: 'concrete',
    candy: 'icing',
    rainbow: 'glass',
    crystal: 'gem',
    gold: 'gold',
  };

  const SRC_W = 512;
  const SRC_H = 128;
  const CAP = 56;
  const MID = 400;
  const VIS_H = 32;
  const CACHE_MAX = 48;
  const ART_VERSION = 'v6';
  // Tieto plošiny už majú vlastný spoj a obrys v súbore. Kód ich znova nerozmazáva ani neobkresľuje.
  const ASSET_FINISHED = { hell: true, candy: true, gold: true, rainbow: true, clouds: true };

  let CELL = 96;
  let sheetRows = 0;
  const ANCHOR_X = 0.5;
  const ANCHOR_Y = 0.9375;
  const DEST_CELL = 84;
  const WALK_SPEED = 0.35;
  const RUN_SPEED_RATIO = 0.45;

  const ANIMS = {
    idle: { row: 0, frames: 4, fps: 6, loop: true },
    walk: { row: 1, frames: 6, fps: 10, loop: true },
    run: { row: 2, frames: 6, fps: 14, loop: true },
    jump_up: { row: 3, frames: 3, fps: 8, loop: false },
    fall: { row: 4, frames: 3, fps: 8, loop: true },
    land: { row: 5, frames: 3, fps: 12, loop: false },
    win: { row: 6, frames: 6, fps: 10, loop: true },
    run_jump: { row: 7, frames: 3, fps: 8, loop: false },
    turn: { row: 8, frames: 3, fps: 12, loop: false },
  };

  const DEFAULT_DELAYS = [5000, 15000, 30000];
  const MAX_ATTEMPTS = 4;

  const bg = Object.create(null);
  const plat = Object.create(null);
  const inflight = Object.create(null);
  const attempts = Object.create(null);
  const retryAt = Object.create(null);
  const givenUp = Object.create(null);
  const holdPromise = Object.create(null);
  const readyPromise = Object.create(null);
  const decoInflight = Object.create(null);
  const decoReady = Object.create(null);
  const decoHold = Object.create(null);
  const bgCanvas = Object.create(null);
  const bgFade = Object.create(null);
  const platCache = new Map();
  let unicorn = null;
  let delays = DEFAULT_DELAYS;
  let nowFn = () => Date.now();

  function now() { return nowFn(); }

  function dropPlatCache(deco) {
    const prefix = `${deco}:`;
    for (const key of platCache.keys()) {
      if (key.startsWith(prefix)) platCache.delete(key);
    }
  }

  function fileUrl(file) {
    const src = `assets/art-pack/${file}?v=${ART_VERSION}`;
    return window.TRISY_BUILD ? `${src}&b=${encodeURIComponent(window.TRISY_BUILD)}` : src;
  }

  function rememberBitmap(file, bitmap) {
    readyPromise[file] = Promise.resolve(bitmap);
    delete retryAt[file];
    delete holdPromise[file];
    const deco = file.replace(/^bg-/, '').replace(/^plat-/, '').replace(/\.webp$/, '').replace(/\.png$/, '');
    if (file.startsWith('bg-') && bg[deco] !== bitmap) {
      bg[deco] = bitmap;
      delete bgCanvas[deco];
      delete bgFade[deco];
    }
    if (file.startsWith('plat-') && plat[deco] !== bitmap) {
      plat[deco] = bitmap;
      dropPlatCache(deco);
    }
  }

  function noteFailure(file) {
    const count = (attempts[file] || 0) + 1;
    attempts[file] = count;
    delete holdPromise[file];
    if (count >= MAX_ATTEMPTS) {
      givenUp[file] = true;
      delete retryAt[file];
      holdPromise[file] = Promise.resolve(null);
      return;
    }
    const delay = delays[Math.min(count - 1, delays.length - 1)];
    retryAt[file] = now() + delay;
    holdPromise[file] = Promise.resolve(null);
  }

  function loadBitmap(file) {
    if (readyPromise[file]) return readyPromise[file];
    if (inflight[file]) return inflight[file];
    if (givenUp[file]) {
      if (!holdPromise[file]) holdPromise[file] = Promise.resolve(null);
      return holdPromise[file];
    }
    if (retryAt[file] && now() < retryAt[file]) {
      if (!holdPromise[file]) holdPromise[file] = Promise.resolve(null);
      return holdPromise[file];
    }
    delete holdPromise[file];
    const job = fetch(fileUrl(file)).then((res) => {
      if (!res.ok) throw new Error(file);
      return res.blob();
    }).then((blob) => createImageBitmap(blob)).then((bitmap) => {
      delete inflight[file];
      rememberBitmap(file, bitmap);
      return bitmap;
    }).catch(() => {
      delete inflight[file];
      noteFailure(file);
      return null;
    });
    inflight[file] = job;
    return job;
  }

  function loadDeco(deco) {
    if (THEME_KIND[deco] == null) return Promise.resolve(false);
    return Promise.all([
      loadBitmap(`bg-${deco}.webp`),
      loadBitmap(`plat-${deco}.png`),
    ]).then(() => Boolean(bg[deco] && plat[deco]));
  }

  function prefetch(deco) {
    if (!deco || THEME_KIND[deco] == null) return Promise.resolve(false);
    if (bg[deco] && plat[deco]) {
      if (!decoReady[deco]) decoReady[deco] = Promise.resolve(true);
      return decoReady[deco];
    }
    if (decoInflight[deco]) return decoInflight[deco];
    const bgFile = `bg-${deco}.webp`;
    const platFile = `plat-${deco}.png`;
    const t = now();
    const waiting = (file, have) => have || inflight[file] || givenUp[file] || (retryAt[file] && t < retryAt[file]);
    const canStart = (file, have) => !have && !inflight[file] && !givenUp[file] && !(retryAt[file] && t < retryAt[file]);
    if (!canStart(bgFile, bg[deco]) && !canStart(platFile, plat[deco])) {
      if (!waiting(bgFile, bg[deco]) && !waiting(platFile, plat[deco])) {
        if (!decoHold[deco]) decoHold[deco] = Promise.resolve(false);
        return decoHold[deco];
      }
      if (!decoHold[deco]) decoHold[deco] = Promise.resolve(false);
      return decoHold[deco];
    }
    delete decoHold[deco];
    const job = loadDeco(deco).then((ok) => {
      delete decoInflight[deco];
      if (ok) decoReady[deco] = Promise.resolve(true);
      return ok;
    });
    decoInflight[deco] = job;
    return job;
  }

  let unicornFull = null;
  let fullCell = 128;
  let hiRes = false;
  const wallImg = Object.create(null);
  const wallTile = Object.create(null);

  function loadUnicorn() {
    if (unicorn) return Promise.resolve(true);
    return loadBitmap('unicorn-spritesheet-small.png').then((bitmap) => {
      if (bitmap) {
        unicorn = bitmap;
        syncCell();
      }
      return Boolean(unicorn);
    });
  }

  function loadFullUnicorn() {
    if (unicornFull) return Promise.resolve(true);
    return loadBitmap('unicorn-spritesheet.png').then((bitmap) => {
      if (bitmap) {
        unicornFull = bitmap;
        if (sheetRows > 0) fullCell = Math.round(bitmap.height / sheetRows);
      }
      return Boolean(unicornFull);
    });
  }

  function noteResolution(dpr, scale) {
    const next = dpr >= 2 || scale >= 3;
    if (next && !hiRes) loadFullUnicorn();
    hiRes = next;
    Object.keys(bgCanvas).forEach((key) => { delete bgCanvas[key]; });
    platCache.clear();
    Object.keys(wallTile).forEach((key) => { delete wallTile[key]; });
  }

  function wallFile(deco) {
    return hiRes ? `wall-${deco}@2x.png` : `wall-${deco}.png`;
  }

  function ensureWall(deco) {
    if (!deco) return Promise.resolve(false);
    const file = wallFile(deco);
    if (wallImg[file]) return Promise.resolve(true);
    return loadBitmap(file).then((bitmap) => {
      if (bitmap) wallImg[file] = bitmap;
      return Boolean(wallImg[file]);
    });
  }

  function wallTileFor(deco, ww) {
    const file = wallFile(deco);
    const img = wallImg[file];
    if (!img) return null;
    const width = Math.max(1, Math.round(ww));
    const height = width * 8;
    const key = `${file}:${width}`;
    if (wallTile[key]) return wallTile[key];
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext('2d');
    g.imageSmoothingEnabled = true;
    if (g.imageSmoothingQuality) g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, width, height);
    wallTile[key] = canvas;
    return canvas;
  }

  function wallRows(camY, ww, rh) {
    const width = Math.max(1, Math.round(ww));
    const th = width * 8;
    const scale = width / 10;
    const off = (((-camY * scale) % th) + th) % th;
    const ys = [];
    for (let y = off - th; y < rh; y += th) ys.push(Math.round(y));
    return { th, ys };
  }

  function drawWalls(ctx, deco, camY, scale, rw, rh, wallW) {
    ensureWall(deco);
    const ww = Math.max(1, Math.round((wallW || 10) * scale));
    const tile = wallTileFor(deco, ww);
    if (!tile) return false;
    const rows = wallRows(camY, ww, rh);
    const paint = () => {
      rows.ys.forEach((y) => {
        ctx.drawImage(tile, 0, y);
      });
    };
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, ww, rh);
    ctx.clip();
    paint();
    ctx.restore();
    ctx.save();
    ctx.translate(rw, 0);
    ctx.scale(-1, 1);
    ctx.beginPath();
    ctx.rect(0, 0, ww, rh);
    ctx.clip();
    paint();
    ctx.restore();
    return true;
  }

  function loadAnims() {
    return fetch(fileUrl('unicorn-spritesheet.json')).then((res) => {
      if (!res.ok) throw new Error('json');
      return res.json();
    }).then((meta) => {
      const list = meta && meta.animations;
      if (!list) return;
      if (meta.cell > 0 && meta.height > 0) sheetRows = meta.height / meta.cell;
      list.forEach((anim) => {
        if (!ANIMS[anim.name]) ANIMS[anim.name] = { row: anim.row, frames: anim.frames, fps: anim.fps, loop: anim.loop !== false };
        const spec = ANIMS[anim.name];
        spec.row = anim.row;
        spec.frames = anim.frames;
        spec.fps = anim.fps;
        spec.loop = anim.loop !== false;
      });
      syncCell();
    }).catch(() => {});
  }

  function syncCell() {
    if (!unicorn || !(sheetRows > 0)) return;
    const next = Math.round(unicorn.height / sheetRows);
    if (next > 0) CELL = next;
  }

  function loadStartup() {
    return Promise.all([prefetch('forest'), loadUnicorn(), loadAnims()]).then(() => {
      ensureWall('forest');
      return true;
    });
  }

  function paintBackground(ctx, deco, rw, rh) {
    if (!(rw >= 1) || !(rh >= 1)) return false;
    let cached = bgCanvas[deco];
    if (cached && (cached.width !== rw || cached.height !== rh || cached.width < 1)) {
      delete bgCanvas[deco];
      cached = null;
    }
    if (!cached) {
      const img = bg[deco];
      if (!img) return false;
      cached = document.createElement('canvas');
      cached.width = rw;
      cached.height = rh;
      if (cached.width < 1 || cached.height < 1) return false;
      const c = cached.getContext('2d');
      const scale = Math.max(rw / img.width, rh / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      c.drawImage(img, (rw - dw) * 0.5, rh - dh, dw, dh);
      bgCanvas[deco] = cached;
    }
    ctx.drawImage(cached, 0, 0);
    return true;
  }

  function prepareBackground(deco) {
    if (!bg[deco]) return 'fallback';
    if ((bgFade[deco] || 0) >= 5) return 'art';
    bgFade[deco] = (bgFade[deco] || 0) + 1;
    return 'mix';
  }

  function fadeAlpha(deco) {
    return Math.min(1, (bgFade[deco] || 0) / 5);
  }

  function paintPrepared(ctx, deco, rw, rh) {
    if (!bg[deco]) return false;
    return paintBackground(ctx, deco, rw, rh);
  }

  function drawBackground(ctx, deco, rw, rh) {
    if (!bg[deco]) return false;
    bgFade[deco] = 5;
    return paintBackground(ctx, deco, rw, rh);
  }

  function sliceWidths(destW) {
    if (!(destW > 0) || !Number.isFinite(destW)) return null;
    let cap = CAP * (VIS_H / SRC_H);
    if (cap * 2 > destW) cap = destW / 2;
    const mid = destW - cap * 2;
    if (!Number.isFinite(cap) || !Number.isFinite(mid) || cap < 0 || mid < 0) return null;
    return { cap, mid, height: VIS_H, total: cap * 2 + mid };
  }

  function stampSlices(c, img, ox, oy, q, soften) {
    const widths = sliceWidths(q);
    if (!widths) return false;
    const { cap, mid } = widths;
    c.drawImage(img, 0, 0, CAP, SRC_H, ox, oy, cap, VIS_H);
    if (mid > 0.5) {
      const tileW = MID * (VIS_H / SRC_H);
      let x = ox + cap;
      const end = ox + cap + mid;
      let flip = false;
      let guard = 0;
      const seams = [Math.round(ox + cap)];
      while (x < end - 0.4 && guard < 40) {
        guard += 1;
        if (x > ox + cap + 0.5) seams.push(Math.round(x));
        const remain = end - x;
        const dw = Math.min(tileW, remain);
        if (!(dw > 0.4)) break;
        const sw = MID * (dw / tileW);
        if (flip) {
          c.save();
          c.translate(Math.round(x + dw), 0);
          c.scale(-1, 1);
          c.drawImage(img, CAP, 0, sw, SRC_H, 0, oy, dw, VIS_H);
          c.restore();
        } else {
          c.drawImage(img, CAP, 0, sw, SRC_H, x, oy, dw, VIS_H);
        }
        const next = x + dw;
        if (next >= end - 0.4) break;
        x = next;
        flip = !flip;
      }
      seams.push(Math.round(ox + cap + mid));
      c.drawImage(img, SRC_W - CAP, 0, CAP, SRC_H, ox + cap + mid, oy, cap, VIS_H);
      if (soften) softenSeams(c, seams, oy);
    } else {
      c.drawImage(img, SRC_W - CAP, 0, CAP, SRC_H, ox + cap + mid, oy, cap, VIS_H);
    }
    if (mid <= 0.5) {
      c.drawImage(img, SRC_W - CAP, 0, CAP, SRC_H, ox + cap, oy, cap, VIS_H);
    }
    return true;
  }

  function bakePlatform(deco, width) {
    const img = plat[deco];
    const q = Math.max(4, Math.round(width / 4) * 4);
    if (!img || !sliceWidths(q)) return null;
    const key = `${deco}:${q}`;
    const hit = platCache.get(key);
    if (hit) {
      platCache.delete(key);
      platCache.set(key, hit);
      return hit;
    }
    const core = document.createElement('canvas');
    core.width = q;
    core.height = VIS_H;
    const coreCtx = core.getContext('2d');
    if (!stampSlices(coreCtx, img, 0, 0, q, !ASSET_FINISHED[deco])) return null;
    const canvas = core;
    const ox = 0;
    const oy = 0;
    const entry = { canvas, ox, oy, w: q, h: VIS_H };
    platCache.set(key, entry);
    if (platCache.size > CACHE_MAX) platCache.delete(platCache.keys().next().value);
    return entry;
  }

  function softenSeams(c, seams, oy) {
    const radius = 2;
    seams.forEach((seamX) => {
      const x0 = Math.max(0, seamX - radius);
      const w = Math.min(c.canvas.width - x0, radius * 2 + 1);
      if (w < 3) return;
      const image = c.getImageData(x0, oy, w, VIS_H);
      const src = new Uint8ClampedArray(image.data);
      const out = image.data;
      for (let y = 0; y < VIS_H; y++) {
        for (let x = 0; x < w; x++) {
          let r = 0;
          let g = 0;
          let b = 0;
          let a = 0;
          let n = 0;
          for (let k = -1; k <= 1; k++) {
            const xx = Math.min(w - 1, Math.max(0, x + k));
            const i = (y * w + xx) * 4;
            r += src[i];
            g += src[i + 1];
            b += src[i + 2];
            a += src[i + 3];
            n += 1;
          }
          const o = (y * w + x) * 4;
          out[o] = r / n;
          out[o + 1] = g / n;
          out[o + 2] = b / n;
          out[o + 3] = a / n;
        }
      }
      c.putImageData(image, x0, oy);
    });
  }

  function drawPlatform(ctx, deco, x, y, w) {
    if (!(w > 0) || !Number.isFinite(w) || !plat[deco]) return false;
    const baked = bakePlatform(deco, w);
    if (!baked) return false;
    ctx.drawImage(baked.canvas, x - baked.ox, y - baked.oy);
    return true;
  }

  function poseFor(s) {
    if (!s) return 'idle';
    if (s.win) return 'win';
    if (!s.onGround) {
      if ((s.vy || 0) > 0) return 'fall';
      return s.powerJump ? 'run_jump' : 'jump_up';
    }
    if ((s.landTimer || 0) > 0) return 'land';
    const speed = Math.abs(s.vx || 0);
    // Držaný smer je rozbeh. Beh sa ukáže hneď, fyzika zrýchlenia ostáva.
    if (s.pushing && speed > 0.02) return 'run';
    if (speed < WALK_SPEED) return 'idle';
    const maxSpeed = s.maxSpeed || 0;
    if (maxSpeed > 0 && speed >= maxSpeed * RUN_SPEED_RATIO) return 'run';
    return 'walk';
  }

  let drawFacing = 1;
  let turnActive = false;
  let turnFrom = 1;
  let turnTarget = 1;
  let turnStep = 0;

  function resetTurn() {
    drawFacing = 1;
    turnActive = false;
    turnFrom = 1;
    turnTarget = 1;
    turnStep = 0;
  }

  function noteTurn(s) {
    const want = (s && s.facing) < 0 ? -1 : 1;
    const onGround = !!(s && s.onGround);
    if (turnActive) {
      if (!onGround || want !== turnTarget) {
        turnActive = false;
        drawFacing = want;
        return { turning: false, facing: drawFacing, step: 0 };
      }
      const spec = ANIMS.turn || { frames: 3, fps: 12 };
      const span = spec.frames * (60 / spec.fps);
      if (turnStep >= span) {
        turnActive = false;
        drawFacing = turnTarget;
        return { turning: false, facing: drawFacing, step: 0 };
      }
      const step = turnStep;
      turnStep += 1;
      return { turning: true, facing: turnFrom, step };
    }
    if (!onGround) {
      drawFacing = want;
      return { turning: false, facing: drawFacing, step: 0 };
    }
    if (want !== drawFacing) {
      turnActive = true;
      turnFrom = drawFacing;
      turnTarget = want;
      turnStep = 1;
      return { turning: true, facing: turnFrom, step: 0 };
    }
    return { turning: false, facing: drawFacing, step: 0 };
  }

  function frameIndex(name, step) {
    const spec = ANIMS[name] || ANIMS.idle;
    const stepsPer = 60 / spec.fps;
    let frame = Math.floor((step || 0) / stepsPer);
    if (frame < 0) frame = 0;
    if (spec.loop) return frame % spec.frames;
    return frame >= spec.frames ? spec.frames - 1 : frame;
  }

  // Jedna mierka pre všetky stavy. Krátky squash/stretch sa vráti na 1 a je ukotvený na nohy.
  const DUST_POOL = 12;
  const dust = [];
  for (let i = 0; i < DUST_POOL; i++) {
    dust.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 8, r: 3 });
  }
  let dustCursor = 0;
  let pendingDust = 0;
  let squashLeft = 0;
  let stretchLeft = 0;
  let squashAmt = 0;
  let stretchAmt = 0;
  let bob = 0;
  let airVy = 0;
  let prevGround = true;
  let lastPose = '';
  let lastFacing = 1;

  function prefersReduced() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function spawnDust(x, y, dir) {
    const p = dust[dustCursor];
    dustCursor = (dustCursor + 1) % DUST_POOL;
    p.alive = true;
    p.x = x;
    p.y = y;
    p.vx = dir * 0.85;
    p.vy = -0.55;
    p.life = 8;
    p.max = 8;
    p.r = 3.2;
  }

  function noteMotion(s) {
    if (!s) return;
    if (squashLeft > 0) squashLeft -= 1;
    else if (stretchLeft > 0) stretchLeft -= 1;
    for (let i = 0; i < DUST_POOL; i++) {
      const p = dust[i];
      if (!p.alive) continue;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.life -= 1;
      if (p.life <= 0) p.alive = false;
    }
    const onGround = !!s.onGround;
    if (!onGround) airVy = s.vy || 0;
    const impact = onGround && !prevGround;
    const leftGround = !onGround && prevGround;
    prevGround = onGround;
    if (impact) {
      const fall = Math.max(0, airVy);
      squashAmt = 0.07 + 0.11 * Math.min(1, fall / 8);
      squashLeft = 7;
      stretchLeft = 0;
      if (fall > 0.8) pendingDust += 2;
    } else if (leftGround && (s.vy || 0) < 0) {
      stretchAmt = s.powerJump ? 0.14 : 0.07;
      stretchLeft = 6;
      squashLeft = 0;
    }
    const pose = s.pose || '';
    if (pose === 'run' && lastPose !== 'run') pendingDust += 1;
    if (pose === 'run' && s.facing && s.facing !== lastFacing) pendingDust += 1;
    bob = 0;
    if (pose) lastPose = pose;
    if (s.facing) lastFacing = s.facing;
    if (prefersReduced()) pendingDust = 0;
  }

  function deform() {
    if (prefersReduced()) return { sx: 1, sy: 1, tilt: 0 };
    let sy = 1;
    let sx = 1;
    let tilt = prevGround ? bob : Math.max(-0.22, Math.min(0.22, airVy * 0.015));
    if (squashLeft > 0) {
      const drop = squashAmt * (squashLeft / 7);
      sy = 1 - drop;
      sx = 1 + drop * 0.65;
      tilt = bob * 0.35;
    } else if (stretchLeft > 0) {
      const up = stretchAmt * (stretchLeft / 6);
      sy = 1 + up;
      sx = 1 - up * 0.45;
    } else if (!prevGround) {
      const extra = Math.min(0.06, Math.abs(airVy) * 0.008);
      sy = 1 + extra;
      sx = 1 - extra * 0.35;
    }
    return { sx, sy, tilt };
  }

  function resetVisual() {
    squashLeft = 0;
    stretchLeft = 0;
    squashAmt = 0;
    stretchAmt = 0;
    bob = 0;
    airVy = 0;
    prevGround = true;
    lastPose = '';
    lastFacing = 1;
    pendingDust = 0;
    dustCursor = 0;
    for (let i = 0; i < DUST_POOL; i++) dust[i].alive = false;
  }

  function visualState() {
    const d = deform();
    let alive = 0;
    for (let i = 0; i < DUST_POOL; i++) if (dust[i].alive) alive += 1;
    return {
      squashLeft,
      stretchLeft,
      squashAmt,
      stretchAmt,
      sx: d.sx,
      sy: d.sy,
      tilt: d.tilt,
      dust: alive,
      pendingDust,
      reduced: prefersReduced(),
    };
  }

  function drawDust(ctx) {
    if (prefersReduced()) return;
    for (let i = 0; i < DUST_POOL; i++) {
      const p = dust[i];
      if (!p.alive) continue;
      ctx.globalAlpha = Math.max(0, p.life / p.max) * 0.45;
      ctx.fillStyle = '#f3e2c4';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawUnicorn(ctx, centerX, feetY, facing, pose, step) {
    if (!unicorn) return false;
    if (pendingDust && !prefersReduced()) {
      const dir = facing < 0 ? 1 : -1;
      spawnDust(centerX + dir * 10, feetY - 2, dir);
      if (pendingDust > 1) spawnDust(centerX - dir * 6, feetY - 1, -dir * 0.6);
      pendingDust = 0;
    }
    const spec = ANIMS[pose] || ANIMS.idle;
    const frame = frameIndex(pose, step);
    const sharp = hiRes && unicornFull;
    const sheet = sharp ? unicornFull : unicorn;
    const cell = sharp ? fullCell : CELL;
    const sx = frame * cell;
    const sy = spec.row * cell;
    const d = (pose === 'run' || pose === 'turn') ? { sx: 1, sy: 1, tilt: 0 } : deform();
    const dest = Math.max(1, Math.round(42 * (window.PixelArt && PixelArt.sc ? PixelArt.sc(1) : 2)));
    const dw = dest * d.sx;
    const dh = dest * d.sy;
    const ax = ANCHOR_X * dw;
    const ay = ANCHOR_Y * dh;
    ctx.save();
    ctx.translate(centerX, feetY);
    if (d.tilt) ctx.rotate(d.tilt);
    if (facing < 0) ctx.scale(-1, 1);
    ctx.drawImage(sheet, sx, sy, cell, cell, -ax, -ay, dw, dh);
    ctx.restore();
    drawDust(ctx);
    return true;
  }

  function pokeDust(count) {
    if (prefersReduced()) return;
    pendingDust += count > 0 ? count : 1;
  }

  const TRAIL = 12;
  const trail = [];
  for (let i = 0; i < TRAIL; i++) trail.push({ x: 0, y: 0, life: 0 });
  let trailWrite = 0;

  function noteTrail(x, y, active) {
    for (let i = 0; i < TRAIL; i++) {
      if (trail[i].life > 0) trail[i].life -= 1;
    }
    if (!active || prefersReduced()) return;
    const point = trail[trailWrite];
    trailWrite = (trailWrite + 1) % TRAIL;
    point.x = x;
    point.y = y;
    point.life = TRAIL;
  }

  function drawTrail(ctx, cameraY, scale) {
    if (prefersReduced()) return;
    for (let i = 0; i < TRAIL; i++) {
      const point = trail[i];
      if (point.life <= 0) continue;
      const t = point.life / TRAIL;
      ctx.globalAlpha = 0.12 + t * 0.5;
      ctx.fillStyle = t > 0.45 ? '#f7c2dc' : '#f6d48a';
      ctx.beginPath();
      ctx.ellipse(point.x * scale, (point.y - cameraY) * scale, 1.5 + t * 7, 1.2 + t * 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  let coinSheet = null;
  let coinSheetHq = null;
  let sparkleSheet = null;
  let coinFrames = null;
  let coinFramesHq = null;
  let sparkleFrames = null;
  const SPARKS = 6;
  const sparks = [];
  for (let i = 0; i < SPARKS; i++) sparks.push({ alive: false, x: 0, y: 0, tick: 0 });
  let sparkCursor = 0;

  function loadUiBitmap(file) {
    return fetch(`assets/ui/${file}?v=${ART_VERSION}`).then((res) => {
      if (!res.ok) throw new Error(file);
      return res.blob();
    }).then((blob) => createImageBitmap(blob)).catch(() => null);
  }

  function isolateFrames(bitmap, cell, count) {
    const frames = [];
    for (let i = 0; i < count; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = cell;
      canvas.height = cell;
      const g = canvas.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.drawImage(bitmap, i * cell, 0, cell, cell, 0, 0, cell, cell);
      frames.push(canvas);
    }
    return frames;
  }

  function loadCoins() {
    return Promise.all([
      loadUiBitmap('coin-spritesheet.png').then((bitmap) => {
        if (!bitmap) return;
        coinSheet = bitmap;
        coinFrames = isolateFrames(bitmap, 64, 8);
      }),
      loadUiBitmap('coin-spritesheet-96.png').then((bitmap) => {
        if (!bitmap) return;
        coinSheetHq = bitmap;
        coinFramesHq = isolateFrames(bitmap, 96, 8);
      }),
      loadUiBitmap('coin-pickup-sparkle.png').then((bitmap) => {
        if (!bitmap) return;
        sparkleSheet = bitmap;
        sparkleFrames = isolateFrames(bitmap, 64, 6);
      }),
    ]).then(() => true);
  }

  function renderScale() {
    return window.PixelArt && PixelArt.sc ? PixelArt.sc(1) : 2;
  }

  function coinDrawBox(x, y) {
    const size = Math.max(8, Math.round(12 * renderScale()));
    const cx = Math.round(x);
    const cy = Math.round(y);
    return { cx, cy, size, dx: cx - size / 2, dy: cy - size / 2 };
  }

  function paintCell(ctx, frameCanvas, box) {
    const prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    const inset = 0.5;
    ctx.drawImage(
      frameCanvas,
      inset,
      inset,
      frameCanvas.width - inset * 2,
      frameCanvas.height - inset * 2,
      box.dx,
      box.dy,
      box.size,
      box.size,
    );
    ctx.imageSmoothingEnabled = prev;
  }

  function drawCoin(ctx, x, y, frame) {
    const hq = window.devicePixelRatio >= 2 && coinFramesHq;
    const frames = hq ? coinFramesHq : coinFrames;
    if (!frames) return false;
    const index = ((frame % 8) + 8) % 8;
    paintCell(ctx, frames[index], coinDrawBox(x, y));
    return true;
  }

  function noteSparkle(x, y) {
    if (prefersReduced()) return;
    const spark = sparks[sparkCursor];
    sparkCursor = (sparkCursor + 1) % SPARKS;
    spark.alive = true;
    spark.x = x;
    spark.y = y;
    spark.tick = 0;
  }

  function stepSparkles() {
    for (let i = 0; i < SPARKS; i++) {
      const spark = sparks[i];
      if (!spark.alive) continue;
      spark.tick += 1;
      if (((spark.tick / 4) | 0) >= 6) spark.alive = false;
    }
  }

  function drawSparkles(ctx, cameraY, scale) {
    if (!sparkleSheet || prefersReduced()) return;
    for (let i = 0; i < SPARKS; i++) {
      const spark = sparks[i];
      if (!spark.alive) continue;
      const frame = (spark.tick / 4) | 0;
      if (frame >= 6 || !sparkleFrames || !sparkleFrames[frame]) continue;
      const scaleNow = scale || renderScale();
      const box = coinDrawBox(spark.x * scaleNow, (spark.y - cameraY) * scaleNow);
      paintCell(ctx, sparkleFrames[frame], box);
    }
  }

  function loadedFiles() {
    const files = [];
    DECOS.forEach((deco) => {
      if (bg[deco]) files.push(`bg-${deco}.webp`);
      if (plat[deco]) files.push(`plat-${deco}.png`);
    });
    if (unicorn) files.push('unicorn-spritesheet-small.png');
    return files;
  }

  function forceMiss(deco) {
    const prev = { bg: bg[deco] || null, plat: plat[deco] || null };
    delete bg[deco];
    delete plat[deco];
    delete bgCanvas[deco];
    delete bgFade[deco];
    dropPlatCache(deco);
    return () => {
      if (prev.bg) bg[deco] = prev.bg;
      if (prev.plat) plat[deco] = prev.plat;
      delete bgCanvas[deco];
      delete bgFade[deco];
      dropPlatCache(deco);
    };
  }

  function debugClock(fn) { nowFn = typeof fn === 'function' ? fn : () => Date.now(); }
  function debugDelays(list) { delays = list && list.length ? list.slice() : DEFAULT_DELAYS.slice(); }
  function debugReset(file) {
    delete attempts[file];
    delete retryAt[file];
    delete givenUp[file];
    delete holdPromise[file];
    delete inflight[file];
    delete readyPromise[file];
  }
  function debugResetDeco(deco) {
    debugReset(`bg-${deco}.webp`);
    debugReset(`plat-${deco}.png`);
    delete decoHold[deco];
    delete decoInflight[deco];
    delete decoReady[deco];
    delete bg[deco];
    delete plat[deco];
    delete bgCanvas[deco];
    delete bgFade[deco];
    dropPlatCache(deco);
  }
  function debugFile(file) {
    return {
      attempts: attempts[file] || 0,
      givenUp: Boolean(givenUp[file]),
      retryAt: retryAt[file] || 0,
    };
  }

  return {
    DECOS,
    THEME_KIND,
    ANIMS,
    CELL,
    VIS_H,
    ART_VERSION,
    ASSET_FINISHED,
    WALK_SPEED,
    RUN_SPEED_RATIO,
    DEST_CELL,
    noteMotion,
    resetVisual,
    visualState,
    loadStartup,
    noteResolution,
    drawWalls,
    ensureWall,
    wallRows,
    prefetch,
    unicornReady: () => Boolean(unicorn),
    drawBackground,
    prepareBackground,
    fadeAlpha,
    paintPrepared,
    debugClock,
    debugDelays,
    debugFile,
    debugResetDeco,
    MAX_ATTEMPTS,
    drawPlatform,
    poseFor,
    noteTurn,
    resetTurn,
    frameIndex,
    drawUnicorn,
    pokeDust,
    noteTrail,
    drawTrail,
    loadCoins,
    drawCoin,
    coinDrawBox,
    coinIsolated: () => Boolean(coinFrames && coinFrames.length === 8 && coinFrames[0].width === 64),
    noteSparkle,
    stepSparkles,
    drawSparkles,
    reducedMotion: prefersReduced,
    sliceWidths,
    loadedFiles,
    forceMiss,
    hasPlatform: (deco) => Boolean(plat[deco]),
    bakePlatform,
  };
})();
