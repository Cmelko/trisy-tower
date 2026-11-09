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

  const CELL = 96;
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
    const src = `assets/art-pack/${file}`;
    return window.TRISY_BUILD ? `${src}?v=${window.TRISY_BUILD}` : src;
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

  function loadUnicorn() {
    if (unicorn) return Promise.resolve(true);
    return loadBitmap('unicorn-spritesheet-small.png').then((bitmap) => {
      if (bitmap) unicorn = bitmap;
      return Boolean(unicorn);
    });
  }

  function loadStartup() {
    return Promise.all([prefetch('forest'), loadUnicorn()]).then(() => true);
  }

  function paintBackground(ctx, deco, rw, rh) {
    let cached = bgCanvas[deco];
    if (!cached) {
      const img = bg[deco];
      if (!img) return false;
      cached = document.createElement('canvas');
      cached.width = rw;
      cached.height = rh;
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

  function stampSlices(c, img, ox, oy, q) {
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
      softenSeams(c, seams, oy);
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
    if (!stampSlices(coreCtx, img, 0, 0, q)) return null;
    let canvas = core;
    let ox = 0;
    let oy = 0;
    if (deco === 'clouds') {
      const padX = 6;
      const padTop = 5;
      const padBottom = 7;
      canvas = document.createElement('canvas');
      canvas.width = q + padX * 2;
      canvas.height = VIS_H + padTop + padBottom;
      const c = canvas.getContext('2d');
      c.save();
      c.filter = 'brightness(0)';
      [[0, -2], [0, 2], [-2, 0], [2, 0], [0, 3], [0, -3]].forEach(([dx, dy]) => {
        c.drawImage(core, padX + dx, padTop + dy);
      });
      c.filter = 'none';
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = 'rgba(10, 36, 98, 0.95)';
      c.fillRect(0, 0, canvas.width, canvas.height);
      c.restore();
      c.drawImage(core, padX, padTop);
      traceCloudEdge(c);
      ox = padX;
      oy = padTop;
    }
    const entry = { canvas, ox, oy, w: q, h: VIS_H };
    platCache.set(key, entry);
    if (platCache.size > CACHE_MAX) platCache.delete(platCache.keys().next().value);
    return entry;
  }

  function traceCloudEdge(c) {
    const w = c.canvas.width;
    const h = c.canvas.height;
    const image = c.getImageData(0, 0, w, h);
    const d = image.data;
    const mark = (x, y) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const i = (y * w + x) * 4;
      d[i] = 16;
      d[i + 1] = 48;
      d[i + 2] = 118;
      d[i + 3] = 235;
    };
    for (let x = 0; x < w; x++) {
      let top = -1;
      let bot = -1;
      for (let y = 0; y < h; y++) {
        if (d[(y * w + x) * 4 + 3] > 48) {
          if (top < 0) top = y;
          bot = y;
        }
      }
      if (top < 0) continue;
      mark(x, top);
      mark(x, top - 1);
      mark(x, bot);
      mark(x, bot + 1);
    }
    c.putImageData(image, 0, 0);
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
    if (speed < WALK_SPEED) return 'idle';
    const maxSpeed = s.maxSpeed || 0;
    if (maxSpeed > 0 && speed >= maxSpeed * RUN_SPEED_RATIO) return 'run';
    return 'walk';
  }

  function frameIndex(name, step) {
    const spec = ANIMS[name] || ANIMS.idle;
    const stepsPer = 60 / spec.fps;
    let frame = Math.floor((step || 0) / stepsPer);
    if (frame < 0) frame = 0;
    if (spec.loop) return frame % spec.frames;
    return frame >= spec.frames ? spec.frames - 1 : frame;
  }

  function drawUnicorn(ctx, centerX, feetY, facing, pose, step) {
    if (!unicorn) return false;
    const spec = ANIMS[pose] || ANIMS.idle;
    const frame = frameIndex(pose, step);
    const sx = frame * CELL;
    const sy = spec.row * CELL;
    const scale = DEST_CELL / CELL;
    const ax = CELL * ANCHOR_X * scale;
    const ay = CELL * ANCHOR_Y * scale;
    if (facing < 0) {
      ctx.save();
      ctx.translate(centerX, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(unicorn, sx, sy, CELL, CELL, -ax, feetY - ay, DEST_CELL, DEST_CELL);
      ctx.restore();
    } else {
      ctx.drawImage(unicorn, sx, sy, CELL, CELL, centerX - ax, feetY - ay, DEST_CELL, DEST_CELL);
    }
    return true;
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
    WALK_SPEED,
    RUN_SPEED_RATIO,
    DEST_CELL,
    loadStartup,
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
    frameIndex,
    drawUnicorn,
    sliceWidths,
    loadedFiles,
    forceMiss,
    hasPlatform: (deco) => Boolean(plat[deco]),
    bakePlatform,
  };
})();
