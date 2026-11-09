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

  const bg = Object.create(null);
  const plat = Object.create(null);
  const failed = Object.create(null);
  const inflight = Object.create(null);
  const bgCanvas = Object.create(null);
  const bgLatch = Object.create(null);
  const platLatch = Object.create(null);
  const platCache = new Map();
  let activeBg = null;
  let unicorn = null;

  function fileUrl(file) {
    const src = `assets/art-pack/${file}`;
    return window.TRISY_BUILD ? `${src}?v=${window.TRISY_BUILD}` : src;
  }

  function loadBitmap(file) {
    if (inflight[file]) return inflight[file];
    inflight[file] = fetch(fileUrl(file)).then((res) => {
      if (!res.ok) throw new Error(file);
      return res.blob();
    }).then((blob) => createImageBitmap(blob)).then((bitmap) => {
      return bitmap;
    }).catch(() => {
      failed[file] = true;
      return null;
    });
    return inflight[file];
  }

  function loadDeco(deco) {
    if (THEME_KIND[deco] == null) return Promise.resolve(false);
    const bgFile = `bg-${deco}.webp`;
    const platFile = `plat-${deco}.png`;
    const bgJob = bg[deco] || failed[bgFile]
      ? Promise.resolve(bg[deco] || null)
      : loadBitmap(bgFile).then((bitmap) => {
        if (bitmap) bg[deco] = bitmap;
        return bitmap;
      });
    const platJob = plat[deco] || failed[platFile]
      ? Promise.resolve(plat[deco] || null)
      : loadBitmap(platFile).then((bitmap) => {
        if (bitmap) plat[deco] = bitmap;
        return bitmap;
      });
    return Promise.all([bgJob, platJob]).then(() => Boolean(bg[deco] && plat[deco]));
  }

  function prefetch(deco) {
    if (!deco || THEME_KIND[deco] == null) return Promise.resolve(false);
    const key = `deco:${deco}`;
    if (!inflight[key]) inflight[key] = loadDeco(deco);
    return inflight[key];
  }

  function loadUnicorn() {
    if (unicorn) return Promise.resolve(true);
    if (failed['unicorn-spritesheet-small.png']) return Promise.resolve(false);
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

  function paintPrepared(ctx, deco, rw, rh) {
    if (bgLatch[deco] === 'fallback' || !bg[deco]) return false;
    return paintBackground(ctx, deco, rw, rh);
  }

  function drawBackground(ctx, deco, rw, rh) {
    if (activeBg !== deco) {
      if (activeBg && bgLatch[activeBg] === 'fallback' && bg[activeBg]) delete bgLatch[activeBg];
      activeBg = deco;
      if (!bgLatch[deco]) bgLatch[deco] = bg[deco] ? 'art' : 'fallback';
    }
    if (bgLatch[deco] !== 'art') return false;
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
      while (x < end - 0.4 && guard < 40) {
        guard += 1;
        const remain = end - x;
        const dw = Math.min(tileW, remain);
        if (!(dw > 0.4)) break;
        const sw = MID * (dw / tileW);
        if (flip) {
          c.save();
          c.translate(Math.round(x + dw), 0);
          c.scale(-1, 1);
          c.drawImage(img, CAP, 0, sw, SRC_H, 0, oy, dw + 1, VIS_H);
          c.restore();
        } else {
          c.drawImage(img, CAP, 0, sw, SRC_H, x, oy, dw + 1, VIS_H);
        }
        const next = x + dw;
        if (next >= end - 0.4) break;
        x = next - 1;
        flip = !flip;
      }
    }
    c.drawImage(img, SRC_W - CAP, 0, CAP, SRC_H, ox + cap + mid, oy, cap, VIS_H);
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
      const padX = 5;
      const padTop = 3;
      const padBottom = 6;
      canvas = document.createElement('canvas');
      canvas.width = q + padX * 2;
      canvas.height = VIS_H + padTop + padBottom;
      const c = canvas.getContext('2d');
      c.save();
      c.filter = 'brightness(0)';
      c.drawImage(core, padX, padTop + 3);
      c.filter = 'none';
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = 'rgba(16, 48, 112, 0.92)';
      c.fillRect(0, 0, canvas.width, canvas.height);
      c.restore();
      c.drawImage(core, padX, padTop);
      ox = padX;
      oy = padTop;
    }
    const entry = { canvas, ox, oy, w: q, h: VIS_H };
    platCache.set(key, entry);
    if (platCache.size > CACHE_MAX) platCache.delete(platCache.keys().next().value);
    return entry;
  }

  function drawPlatform(ctx, deco, x, y, w) {
    if (!(w > 0) || !Number.isFinite(w)) return false;
    if (!platLatch[deco]) platLatch[deco] = plat[deco] ? 'art' : 'fallback';
    if (platLatch[deco] !== 'art') return false;
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
    const prev = {
      bg: bg[deco] || null,
      plat: plat[deco] || null,
      bgLatch: bgLatch[deco] || '',
      platLatch: platLatch[deco] || '',
    };
    delete bg[deco];
    delete plat[deco];
    bgLatch[deco] = 'fallback';
    platLatch[deco] = 'fallback';
    return () => {
      if (prev.bg) bg[deco] = prev.bg;
      if (prev.plat) plat[deco] = prev.plat;
      if (prev.bgLatch) bgLatch[deco] = prev.bgLatch;
      else delete bgLatch[deco];
      if (prev.platLatch) platLatch[deco] = prev.platLatch;
      else delete platLatch[deco];
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
    paintPrepared,
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
