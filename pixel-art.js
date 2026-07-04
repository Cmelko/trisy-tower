/* Trisy tower — HD raster renderer (zhodná kvalita s Pop sprite-mi) */
const PixelArt = (() => {
  'use strict';

  let pxCanvas;
  let px;
  let GW = 240;
  let GH = 360;
  let RW = 480;
  let RH = 720;
  let SC = 2;
  const tileCache = {};
  const TILE_GW = 16;
  const TILE_GH = 12;
  const TILE_PX = 4;

  function init(gameW, gameH, renderW, renderH) {
    GW = gameW;
    GH = gameH;
    RW = renderW;
    RH = renderH;
    SC = renderW / gameW;
    pxCanvas = document.createElement('canvas');
    pxCanvas.width = RW;
    pxCanvas.height = RH;
    px = pxCanvas.getContext('2d');
    px.imageSmoothingEnabled = true;
    if (px.imageSmoothingQuality) px.imageSmoothingQuality = 'high';
  }

  function sc(v) { return v * SC; }
  function getCtx() { return px; }
  function getCanvas() { return pxCanvas; }

  function begin() {
    px.clearRect(0, 0, RW, RH);
  }

  function blit(mainCtx) {
    mainCtx.imageSmoothingEnabled = true;
    if (mainCtx.imageSmoothingQuality) mainCtx.imageSmoothingQuality = 'high';
    mainCtx.clearRect(0, 0, RW, RH);
    mainCtx.drawImage(pxCanvas, 0, 0);
  }

  function hexRgb(hex) {
    return [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ];
  }

  function setPx(img, x, y, r, g, b, a = 255) {
    if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
    const i = (y * img.width + x) * 4;
    img.data[i] = r;
    img.data[i + 1] = g;
    img.data[i + 2] = b;
    img.data[i + 3] = a;
  }

  function fillPx(img, x, y, w, h, hex) {
    const [r, g, b] = hexRgb(hex);
    for (let py = y; py < y + h; py++) {
      for (let px0 = x; px0 < x + w; px0++) {
        setPx(img, px0, py, r, g, b);
      }
    }
  }

  const PAL = {
    forest: {
      sky0: '#1a3a5c', sky1: '#4a90c2', sky2: '#9fd4f0', sky3: '#c8eeb8',
      hill0: '#1e5631', hill1: '#2d7a45', hill2: '#3d9958',
      trunk: '#5c3d1e', trunkD: '#3d2810',
      leaf0: '#2d6b3a', leaf1: '#3d8b4a', leaf2: '#52a85e', leaf3: '#6dcc6d',
      bush: '#358050', cloud: '#ffffff',
      grass: '#5cd65c', grassD: '#3a9e3a', grassH: '#7aea74',
      dirt: '#9e6b3a', dirtD: '#6b4423', dirtH: '#b8844f', pebble: '#5a3820',
      outline: '#2d5016',
    },
    ice: {
      sky0: '#0a1628', sky1: '#2a5a8a', sky2: '#8ec4e8', sky3: '#dceefb',
      hill0: '#3d5a73', hill1: '#5a7896', hill2: '#8aa4be',
      snow: '#f0f9ff', snowD: '#bae6fd', snowH: '#ffffff',
      grass: '#e0f2fe', grassD: '#93c5fd', grassH: '#ffffff',
      dirt: '#64748b', dirtD: '#334155', dirtH: '#94a3b8', pebble: '#1e293b',
      outline: '#1e3a5f',
    },
    hell: {
      sky0: '#120404', sky1: '#5c1010', sky2: '#b83810', sky3: '#f08030',
      hill0: '#2a0808', hill1: '#4a1010', hill2: '#6a1818',
      rockD: '#1c1917', lava: '#f97316', lavaH: '#fb923c', ember: '#fde047',
      grass: '#f97316', grassD: '#dc2626', grassH: '#fb923c',
      dirt: '#292524', dirtD: '#1c1917', dirtH: '#44403c', pebble: '#57534e',
      outline: '#450a0a',
    },
    space: {
      sky0: '#020014', sky1: '#120838', sky2: '#2a1868', sky3: '#482898',
      hill2: '#334155', star: '#ffffff', starP: '#e879f9',
      grass: '#818cf8', grassD: '#6366f1', grassH: '#a5b4fc',
      dirt: '#1e293b', dirtD: '#0f172a', dirtH: '#334155', pebble: '#475569',
      outline: '#312e81',
    },
    desert: {
      sky0: '#78350f', sky1: '#d97706', sky2: '#fde68a', sky3: '#fef3c7',
      hill0: '#b45309', hill1: '#d97706', hill2: '#fbbf24',
      grass: '#fbbf24', grassD: '#d97706', grassH: '#fde68a',
      dirt: '#92400e', dirtD: '#78350f', dirtH: '#b45309', pebble: '#451a03',
      outline: '#451a03',
    },
    ocean: {
      sky0: '#0c4a6e', sky1: '#0284c7', sky2: '#7dd3fc', sky3: '#e0f2fe',
      hill0: '#0369a1', hill1: '#0ea5e9', hill2: '#38bdf8',
      grass: '#38bdf8', grassD: '#0284c7', grassH: '#7dd3fc',
      dirt: '#164e63', dirtD: '#0c4a6e', dirtH: '#155e75', pebble: '#083344',
      outline: '#0c4a6e',
    },
    cave: {
      sky0: '#1c1917', sky1: '#292524', sky2: '#44403c', sky3: '#57534e',
      hill0: '#292524', hill1: '#44403c', hill2: '#57534e',
      grass: '#a8a29e', grassD: '#78716c', grassH: '#d6d3d1',
      dirt: '#44403c', dirtD: '#292524', dirtH: '#57534e', pebble: '#1c1917',
      outline: '#1c1917',
    },
    clouds: {
      sky0: '#38bdf8', sky1: '#7dd3fc', sky2: '#bae6fd', sky3: '#ffffff',
      hill0: '#93c5fd', hill1: '#bfdbfe', hill2: '#e0f2fe',
      grass: '#ffffff', grassD: '#e0f2fe', grassH: '#ffffff',
      dirt: '#cbd5e1', dirtD: '#94a3b8', dirtH: '#e2e8f0', pebble: '#64748b',
      outline: '#94a3b8',
    },
    swamp: {
      sky0: '#14532d', sky1: '#166534', sky2: '#4ade80', sky3: '#86efac',
      hill0: '#166534', hill1: '#15803d', hill2: '#22c55e',
      grass: '#22c55e', grassD: '#15803d', grassH: '#4ade80',
      dirt: '#365314', dirtD: '#1a2e05', dirtH: '#4d7c0f', pebble: '#1a2e05',
      outline: '#14532d',
    },
    city: {
      sky0: '#0f172a', sky1: '#1e293b', sky2: '#334155', sky3: '#6366f1',
      hill0: '#1e293b', hill1: '#334155', hill2: '#475569',
      grass: '#818cf8', grassD: '#6366f1', grassH: '#a5b4fc',
      dirt: '#334155', dirtD: '#1e293b', dirtH: '#475569', pebble: '#0f172a',
      outline: '#312e81',
    },
    candy: {
      sky0: '#fce7f3', sky1: '#f9a8d4', sky2: '#fbcfe8', sky3: '#fdf2f8',
      hill0: '#f472b6', hill1: '#fb7185', hill2: '#fda4af',
      grass: '#f472b6', grassD: '#ec4899', grassH: '#fbcfe8',
      dirt: '#be185d', dirtD: '#9d174d', dirtH: '#db2777', pebble: '#831843',
      outline: '#9d174d',
    },
    rainbow: {
      sky0: '#6366f1', sky1: '#a855f7', sky2: '#f472b6', sky3: '#fde047',
      hill0: '#7c3aed', hill1: '#c026d3', hill2: '#e879f9',
      grass: '#e879f9', grassD: '#c026d3', grassH: '#f0abfc',
      dirt: '#7e22ce', dirtD: '#581c87', dirtH: '#9333ea', pebble: '#4c1d95',
      outline: '#581c87',
    },
    crystal: {
      sky0: '#134e4a', sky1: '#0d9488', sky2: '#5eead4', sky3: '#99f6e4',
      hill0: '#0f766e', hill1: '#14b8a6', hill2: '#2dd4bf',
      grass: '#5eead4', grassD: '#14b8a6', grassH: '#99f6e4',
      dirt: '#115e59', dirtD: '#0f766e', dirtH: '#0d9488', pebble: '#134e4a',
      outline: '#134e4a',
    },
    gold: {
      sky0: '#713f12', sky1: '#ca8a04', sky2: '#fde047', sky3: '#fef9c3',
      hill0: '#a16207', hill1: '#ca8a04', hill2: '#eab308',
      grass: '#facc15', grassD: '#ca8a04', grassH: '#fde047',
      dirt: '#854d0e', dirtD: '#713f12', dirtH: '#a16207', pebble: '#422006',
      outline: '#713f12',
    },
  };

  function palFor(deco) {
    return PAL[deco] || PAL.forest;
  }

  function drawSkyGradient(pal) {
    const grad = px.createLinearGradient(0, 0, 0, RH);
    grad.addColorStop(0, pal.sky0);
    grad.addColorStop(0.32, pal.sky1);
    grad.addColorStop(0.68, pal.sky2);
    grad.addColorStop(1, pal.sky3 || pal.sky2);
    px.fillStyle = grad;
    px.fillRect(0, 0, RW, RH);
  }

  function hillHeight(x, seed, amp, freq) {
    return amp * 0.5
      + Math.sin(x * freq + seed) * amp * 0.35
      + Math.sin(x * freq * 2.3 + seed * 1.7) * amp * 0.2
      + Math.sin(x * freq * 0.5 + seed * 0.5) * amp * 0.15;
  }

  function drawHills(cam, pal, layers) {
    for (const layer of layers) {
      const offset = cam * layer.parallax;
      px.fillStyle = layer.color;
      px.beginPath();
      px.moveTo(0, RH);
      for (let sx0 = 0; sx0 <= RW; sx0 += 3) {
        const gx = sx0 / SC;
        const h = hillHeight(gx + offset, layer.seed, layer.amp, layer.freq);
        px.lineTo(sx0, sc(GH - layer.base) - sc(h));
      }
      px.lineTo(RW, RH);
      px.closePath();
      px.fill();
    }
  }

  function drawCloud(gcx, gcy, w, pal) {
    const cx = sc(gcx);
    const cy = sc(gcy);
    const rw = sc(w);
    px.fillStyle = 'rgba(255,255,255,0.92)';
    px.beginPath();
    px.arc(cx, cy, rw * 0.32, 0, Math.PI * 2);
    px.arc(cx - rw * 0.3, cy + sc(2), rw * 0.22, 0, Math.PI * 2);
    px.arc(cx + rw * 0.28, cy + sc(1.5), rw * 0.26, 0, Math.PI * 2);
    px.arc(cx - rw * 0.08, cy - sc(2), rw * 0.2, 0, Math.PI * 2);
    px.fill();
  }

  function drawTree(gx, gby, tall, pal, snowy) {
    const x = sc(gx);
    const baseY = sc(gby);
    const trunkW = sc(tall > 28 ? 3.5 : 2.5);
    const trunkH = sc(tall * 0.28);
    px.fillStyle = pal.trunkD || pal.trunk;
    px.fillRect(x - trunkW / 2, baseY - trunkH, trunkW, trunkH);

    const tiers = tall > 28 ? 4 : 3;
    for (let t = 0; t < tiers; t++) {
      const w = sc(4 + t * 2.5);
      const ty = baseY - trunkH - sc(t * 5 + 4);
      const col = snowy
        ? (t === 0 ? (pal.snowH || pal.snow) : (pal.hill1 || '#5a7896'))
        : [pal.leaf0, pal.leaf1, pal.leaf2, pal.leaf3][t] || pal.leaf1;
      px.fillStyle = col;
      px.beginPath();
      px.moveTo(x, ty - sc(t + 3));
      px.lineTo(x - w / 2, ty);
      px.lineTo(x + w / 2, ty);
      px.closePath();
      px.fill();
    }
  }

  function drawRoundTree(gx, gby, r, pal) {
    const x = sc(gx);
    const baseY = sc(gby);
    px.fillStyle = pal.trunkD || pal.trunk;
    px.fillRect(x - sc(1), baseY - sc(5), sc(2), sc(5));
    const rad = sc(r);
    const grad = px.createRadialGradient(x - rad * 0.2, baseY - sc(r + 3), 1, x, baseY - sc(r + 2), rad);
    grad.addColorStop(0, pal.leaf3 || pal.leaf2);
    grad.addColorStop(0.6, pal.leaf1 || pal.bush);
    grad.addColorStop(1, pal.leaf0 || '#2d6b3a');
    px.fillStyle = grad;
    px.beginPath();
    px.arc(x, baseY - sc(r + 3), rad, 0, Math.PI * 2);
    px.fill();
  }

  function drawSkyFromTheme(theme) {
    const sky = theme.sky || ['#1a3a5c', '#4a90c2', '#9fd4f0', '#c8eeb8'];
    const grad = px.createLinearGradient(0, 0, 0, RH);
    grad.addColorStop(0, sky[0]);
    grad.addColorStop(0.38, sky[1]);
    grad.addColorStop(0.72, sky[2]);
    grad.addColorStop(1, sky[3] || sky[2]);
    px.fillStyle = grad;
    px.fillRect(0, 0, RW, RH);
  }

  function drawTinyAccent(deco, cam, anim, pal) {
    switch (deco) {
      case 'forest':
        drawCloud((100 - cam * 0.008) % (GW + 30), 55, 11, pal);
        break;
      case 'ice': {
        const mx = 120 - cam * 0.015;
        px.fillStyle = pal.hill1;
        px.beginPath();
        px.moveTo(sc(mx - 22), sc(GH - 8));
        px.lineTo(sc(mx), sc(GH - 38));
        px.lineTo(sc(mx + 22), sc(GH - 8));
        px.closePath();
        px.fill();
        break;
      }
      case 'hell':
        px.fillStyle = pal.lava || '#f97316';
        px.globalAlpha = 0.35;
        px.fillRect(0, sc(GH - 10), RW, sc(10));
        px.globalAlpha = 1;
        break;
      case 'space':
        for (let i = 0; i < 18; i++) {
          px.fillStyle = i % 5 === 0 ? (pal.starP || '#e879f9') : '#ffffff';
          px.globalAlpha = 0.45 + (i % 3) * 0.15;
          px.beginPath();
          px.arc(sc((i * 19 + 7) % GW), sc((i * 23 + 11) % (GH * 0.65)), sc(0.35), 0, Math.PI * 2);
          px.fill();
        }
        px.globalAlpha = 1;
        break;
      case 'desert':
        px.fillStyle = '#fde047';
        px.beginPath();
        px.arc(sc(185), sc(52), sc(14), 0, Math.PI * 2);
        px.fill();
        break;
      case 'ocean':
        px.fillStyle = pal.hill1;
        px.globalAlpha = 0.45;
        px.fillRect(0, sc(GH - 14), RW, sc(14));
        px.globalAlpha = 1;
        break;
      case 'clouds':
        drawCloud(70 - cam * 0.01, 48, 12, pal);
        drawCloud(170 - cam * 0.012, 68, 9, pal);
        break;
      case 'city':
        for (let i = 0; i < 4; i++) {
          const bx = 30 + i * 55 - cam * 0.02;
          const bh = 28 + (i % 2) * 14;
          px.fillStyle = pal.hill0;
          px.fillRect(sc(bx), sc(GH - bh), sc(22), sc(bh));
        }
        break;
      case 'gold':
        for (let i = 0; i < 6; i++) {
          px.fillStyle = '#fef08a';
          px.globalAlpha = 0.35;
          px.beginPath();
          px.arc(sc((i * 37 + 10) % GW), sc((i * 29 + 20) % (GH * 0.5)), sc(0.8), 0, Math.PI * 2);
          px.fill();
        }
        px.globalAlpha = 1;
        break;
      default:
        break;
    }
  }

  function drawProceduralBackground(deco, cam, anim, theme) {
    drawSkyFromTheme(theme);
    const pal = palFor(deco);
    drawHills(cam, pal, [{
      color: pal.hill0,
      parallax: 0.01,
      seed: deco.charCodeAt(0) + deco.charCodeAt(deco.length - 1),
      amp: 9,
      freq: 0.048,
      base: 1,
    }]);
    drawTinyAccent(deco, cam, anim, pal);
  }

  function drawBackground(theme, prevTheme, blendT) {
    const drew = drawBackgroundImage(theme.deco);
    if (!drew) drawProceduralBackground(theme.deco, 0, 0, theme);

    if (blendT > 0.02 && prevTheme && prevTheme.deco !== theme.deco) {
      px.save();
      px.globalAlpha = blendT;
      if (!drawBackgroundImage(prevTheme.deco)) {
        drawProceduralBackground(prevTheme.deco, 0, 0, prevTheme);
      }
      px.restore();
    }
  }

  const BG_FILES = {
    forest: 'assets/bg-forest.png',
    ice: 'assets/bg-ice.png',
    hell: 'assets/bg-hell.png',
    space: 'assets/bg-space.png',
    desert: 'assets/bg-desert.png',
    ocean: 'assets/bg-ocean.png',
    cave: 'assets/bg-cave.png',
    clouds: 'assets/bg-clouds.png',
    swamp: 'assets/bg-swamp.png',
    city: 'assets/bg-city.png',
    candy: 'assets/bg-candy.png',
    rainbow: 'assets/bg-rainbow.png',
    crystal: 'assets/bg-crystal.png',
    gold: 'assets/bg-gold.png',
  };
  const bgImages = {};

  function loadBackgrounds() {
    const entries = Object.entries(BG_FILES);
    return Promise.all(entries.map(([key, src]) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        bgImages[key] = img;
        resolve();
      };
      img.onerror = () => resolve();
      img.src = `${src}?v=8`;
    })));
  }

  function drawBackgroundImage(deco) {
    const img = bgImages[deco];
    if (!img) return false;
    const scale = Math.max(RW / img.width, RH / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const dx = (RW - drawW) * 0.5;
    const dy = RH - drawH;
    px.drawImage(img, 0, 0, img.width, img.height, dx, dy, drawW, drawH);
    return true;
  }

  const CARTOON = {
    outline: '#2a3a48',
    grass: '#5cd65c',
    grassHi: '#7aea74',
    grassLo: '#38b838',
    rockHi: '#c4956c',
    rock: '#a67c52',
    rockLo: '#7a5230',
    rockDark: '#5c3d28',
    crack: '#4a3020',
  };

  function drawThemedPlatform(x0, y0, w, bodyH, capH, pal, deco, seed) {
    const style = wallStyleFor(deco);
    const dark = pal.dirtD || pal.hill0;
    const mid = pal.dirt || pal.hill1;
    const light = pal.dirtH || pal.hill2 || mid;
    const outline = pal.outline || '#2a3a48';
    const lw = Math.max(1, sc(1.1));
    const topY = y0 + capH;

    if (style === 'ice') {
      const bg = px.createLinearGradient(x0, topY, x0, topY + bodyH);
      bg.addColorStop(0, pal.snow || '#e0f2fe');
      bg.addColorStop(0.35, mid);
      bg.addColorStop(1, dark);
      px.fillStyle = bg;
      px.fillRect(x0, topY, w, bodyH);
      px.fillStyle = pal.snowH || '#ffffff';
      px.fillRect(x0, y0, w, capH);
      px.fillStyle = 'rgba(255,255,255,0.45)';
      px.fillRect(x0 + sc(1), y0 + sc(0.5), w * 0.55, sc(1));
      px.strokeStyle = 'rgba(147,197,253,0.5)';
      px.lineWidth = lw * 0.4;
      for (let i = 0; i < 3; i++) {
        const ly = topY + sc(3) + i * (bodyH / 4);
        px.beginPath();
        px.moveTo(x0 + sc(2), ly);
        px.lineTo(x0 + w - sc(2), ly);
        px.stroke();
      }
    } else if (style === 'lava') {
      const bg = px.createLinearGradient(x0, topY, x0, topY + bodyH);
      bg.addColorStop(0, mid);
      bg.addColorStop(1, dark);
      px.fillStyle = bg;
      px.fillRect(x0, topY, w, bodyH);
      px.fillStyle = pal.lavaH || '#fb923c';
      px.fillRect(x0, y0, w, capH);
      px.strokeStyle = pal.lava || '#f97316';
      px.lineWidth = lw * 0.45;
      for (let i = 0; i < 4; i++) {
        const cx = x0 + sc(4) + ((seed + i * 23) % 100) / 100 * (w - sc(8));
        px.beginPath();
        px.moveTo(cx, topY + sc(2));
        px.lineTo(cx + sc(3), topY + bodyH - sc(2));
        px.stroke();
      }
    } else if (style === 'water') {
      const bg = px.createLinearGradient(x0, topY, x0, topY + bodyH);
      bg.addColorStop(0, light);
      bg.addColorStop(0.5, mid);
      bg.addColorStop(1, dark);
      px.fillStyle = bg;
      px.fillRect(x0, topY, w, bodyH);
      px.fillStyle = 'rgba(125,211,252,0.55)';
      px.fillRect(x0, y0, w, capH);
      px.fillStyle = 'rgba(255,255,255,0.3)';
      for (let i = 0; i < Math.floor(w / sc(12)); i++) {
        px.beginPath();
        px.arc(x0 + sc(6) + i * sc(12), topY + sc(4), sc(0.8), 0, Math.PI * 2);
        px.fill();
      }
    } else if (style === 'sand') {
      const bg = px.createLinearGradient(x0, topY, x0, topY + bodyH);
      bg.addColorStop(0, light);
      bg.addColorStop(0.6, mid);
      bg.addColorStop(1, dark);
      px.fillStyle = bg;
      px.fillRect(x0, topY, w, bodyH);
      px.fillStyle = light;
      px.fillRect(x0, y0, w, capH);
      px.strokeStyle = pal.pebble || outline;
      px.lineWidth = lw * 0.35;
      for (let i = 0; i < Math.floor(w / sc(10)); i++) {
        px.beginPath();
        px.moveTo(x0 + i * sc(10), y0 + capH);
        px.quadraticCurveTo(x0 + i * sc(10) + sc(5), y0 + capH - sc(1.5), x0 + i * sc(10) + sc(10), y0 + capH);
        px.stroke();
      }
    } else if (style === 'metal') {
      px.fillStyle = dark;
      px.fillRect(x0, topY, w, bodyH);
      px.fillStyle = mid;
      px.fillRect(x0, y0, w, capH);
      px.strokeStyle = 'rgba(129,140,248,0.4)';
      px.lineWidth = lw * 0.4;
      for (let i = 0; i < Math.floor(bodyH / sc(5)); i++) {
        px.strokeRect(x0 + sc(1), topY + i * sc(5), w - sc(2), sc(4));
      }
    } else if (style === 'crystal') {
      const bg = px.createLinearGradient(x0, topY, x0 + w, topY + bodyH);
      bg.addColorStop(0, light);
      bg.addColorStop(0.5, mid);
      bg.addColorStop(1, dark);
      px.fillStyle = bg;
      px.fillRect(x0, topY, w, bodyH);
      px.fillStyle = pal.grass || light;
      px.fillRect(x0, y0, w, capH);
      px.strokeStyle = 'rgba(255,255,255,0.35)';
      px.lineWidth = lw * 0.4;
      for (let i = 0; i < 3; i++) {
        px.beginPath();
        px.moveTo(x0 + (i + 1) * w / 4, topY);
        px.lineTo(x0 + (i + 1) * w / 4 + sc(4), topY + bodyH);
        px.stroke();
      }
    } else if (style === 'gold') {
      const bg = px.createLinearGradient(x0, topY, x0, topY + bodyH);
      bg.addColorStop(0, '#fde047');
      bg.addColorStop(0.45, '#ca8a04');
      bg.addColorStop(1, dark);
      px.fillStyle = bg;
      px.fillRect(x0, topY, w, bodyH);
      px.fillStyle = '#fef08a';
      px.fillRect(x0, y0, w, capH);
      px.fillStyle = 'rgba(255,255,255,0.35)';
      px.fillRect(x0 + sc(2), y0 + sc(0.5), w * 0.4, sc(1));
    } else {
      const bg = px.createLinearGradient(x0, topY, x0, topY + bodyH);
      bg.addColorStop(0, light);
      bg.addColorStop(0.4, mid);
      bg.addColorStop(1, dark);
      px.fillStyle = bg;
      px.fillRect(x0, topY, w, bodyH);
      px.fillStyle = mid;
      px.fillRect(x0, y0, w, capH);
      const layers = 3;
      px.strokeStyle = 'rgba(0,0,0,0.12)';
      px.lineWidth = lw * 0.35;
      for (let i = 1; i < layers; i++) {
        const ly = topY + (bodyH / layers) * i;
        px.beginPath();
        px.moveTo(x0, ly);
        px.lineTo(x0 + w, ly);
        px.stroke();
      }
      for (let i = 0; i < Math.max(3, Math.floor(w / sc(14))); i++) {
        px.fillStyle = pal.pebble || dark;
        px.beginPath();
        px.arc(
          x0 + sc(3) + ((seed + i * 17) % 100) / 100 * (w - sc(6)),
          topY + sc(3) + ((seed + i * 11) % 100) / 100 * (bodyH - sc(5)),
          sc(0.9 + (i % 2) * 0.4),
          0, Math.PI * 2,
        );
        px.fill();
      }
    }

    px.strokeStyle = outline;
    px.lineWidth = lw;
    px.strokeRect(x0 + lw * 0.5, y0 + lw * 0.5, w - lw, topY + bodyH - y0 - lw);
  }

  function wallStyleFor(deco) {
    const map = {
      forest: 'dirt',
      ice: 'ice',
      hell: 'lava',
      space: 'metal',
      desert: 'sand',
      ocean: 'water',
      cave: 'stone',
      clouds: 'cloud',
      swamp: 'mud',
      city: 'brick',
      candy: 'candy',
      rainbow: 'rainbow',
      crystal: 'crystal',
      gold: 'gold',
    };
    return map[deco] || 'dirt';
  }

  function drawThemedWallFace(pal, style, x, w, innerEdgeRight, blockH, lw) {
    const scroll = 0;
    const dark = pal.dirtD || pal.hill0;
    const mid = pal.dirt || pal.hill1;
    const light = pal.dirtH || pal.hill2 || mid;
    const outline = pal.outline || CARTOON.outline;
    const g = px.createLinearGradient(x, 0, x + (innerEdgeRight ? w : -w), 0);

    if (style === 'ice') {
      g.addColorStop(0, pal.snowD || '#93c5fd');
      g.addColorStop(0.5, pal.snow || '#e0f2fe');
      g.addColorStop(1, pal.snowH || '#ffffff');
      px.fillStyle = g;
      px.fillRect(x, 0, w, RH);
      px.strokeStyle = 'rgba(147,197,253,0.6)';
      px.lineWidth = lw * 0.45;
      for (let y = -blockH + scroll; y < RH + blockH; y += blockH) {
        px.beginPath();
        px.moveTo(x, y);
        px.lineTo(x + w, y);
        px.stroke();
      }
      for (let y = scroll; y < RH; y += blockH * 2.2) {
        px.fillStyle = pal.snowH || '#ffffff';
        px.fillRect(x + sc(0.5), y, w - sc(1), sc(4));
        if (innerEdgeRight) {
          px.beginPath();
          px.moveTo(x + w - sc(1), y + sc(4));
          px.lineTo(x + w - sc(3), y + sc(14));
          px.lineTo(x + w - sc(1), y + sc(10));
          px.fill();
        } else {
          px.beginPath();
          px.moveTo(x + sc(1), y + sc(4));
          px.lineTo(x + sc(3), y + sc(14));
          px.lineTo(x + sc(1), y + sc(10));
          px.fill();
        }
      }
    } else if (style === 'lava') {
      g.addColorStop(0, dark);
      g.addColorStop(0.55, mid);
      g.addColorStop(1, light);
      px.fillStyle = g;
      px.fillRect(x, 0, w, RH);
      px.strokeStyle = pal.lava || '#f97316';
      px.lineWidth = lw * 0.55;
      for (let y = -blockH + scroll; y < RH + blockH; y += blockH * 1.4) {
        px.beginPath();
        px.moveTo(x, y + blockH * 0.3);
        px.lineTo(x + w, y + blockH * 0.7);
        px.stroke();
      }
      for (let y = scroll + blockH; y < RH; y += blockH * 3) {
        px.fillStyle = pal.lavaH || '#fb923c';
        px.fillRect(x + sc(1), y, w - sc(2), sc(2));
      }
    } else if (style === 'metal' || style === 'brick') {
      g.addColorStop(0, dark);
      g.addColorStop(0.5, mid);
      g.addColorStop(1, light);
      px.fillStyle = g;
      px.fillRect(x, 0, w, RH);
      const brickH = blockH * 0.85;
      px.strokeStyle = outline;
      px.lineWidth = lw * 0.45;
      for (let y = -brickH + scroll; y < RH + brickH; y += brickH) {
        px.strokeRect(x + sc(0.5), y, w - sc(1), brickH);
        const off = (Math.floor(y / brickH) % 2) * (w * 0.35);
        px.beginPath();
        px.moveTo(x + off, y + brickH * 0.5);
        px.lineTo(x + w, y + brickH * 0.5);
        px.stroke();
        if (style === 'brick') {
          for (let wx = x + sc(6); wx < x + w - sc(4); wx += sc(10)) {
            if ((wx + y) % 17 < 8) {
              px.fillStyle = '#fde047';
              px.fillRect(wx, y + sc(4), sc(3), sc(4));
            }
          }
        } else {
          for (let ry = y + sc(5); ry < y + brickH - sc(3); ry += sc(12)) {
            px.fillStyle = pal.grass || '#818cf8';
            px.beginPath();
            px.arc(x + w * 0.5, ry, sc(1.2), 0, Math.PI * 2);
            px.fill();
          }
        }
      }
    } else if (style === 'water') {
      g.addColorStop(0, dark);
      g.addColorStop(0.5, mid);
      g.addColorStop(1, light);
      px.fillStyle = g;
      px.fillRect(x, 0, w, RH);
      px.fillStyle = 'rgba(255,255,255,0.25)';
      for (let y = scroll; y < RH; y += blockH * 1.8) {
        px.beginPath();
        px.arc(x + w * 0.35, y, sc(2), 0, Math.PI * 2);
        px.fill();
        px.beginPath();
        px.arc(x + w * 0.7, y + sc(6), sc(1.5), 0, Math.PI * 2);
        px.fill();
      }
      px.strokeStyle = 'rgba(255,255,255,0.45)';
      px.lineWidth = lw * 0.4;
      for (let y = -blockH + scroll; y < RH; y += blockH) {
        px.beginPath();
        px.moveTo(x, y);
        px.lineTo(x + w, y + blockH * 0.25);
        px.stroke();
      }
    } else if (style === 'sand') {
      g.addColorStop(0, dark);
      g.addColorStop(0.45, mid);
      g.addColorStop(1, light);
      px.fillStyle = g;
      px.fillRect(x, 0, w, RH);
      px.strokeStyle = pal.pebble || outline;
      px.lineWidth = lw * 0.4;
      for (let y = -blockH + scroll; y < RH + blockH; y += blockH * 0.7) {
        px.beginPath();
        px.moveTo(x, y);
        px.quadraticCurveTo(x + w * 0.5, y + sc(3), x + w, y);
        px.stroke();
      }
    } else if (style === 'mud' || style === 'stone' || style === 'dirt') {
      g.addColorStop(0, dark);
      g.addColorStop(0.5, mid);
      g.addColorStop(1, light);
      px.fillStyle = g;
      px.fillRect(x, 0, w, RH);
      px.strokeStyle = pal.pebble || outline;
      px.lineWidth = lw * 0.5;
      for (let y = -blockH + scroll; y < RH + blockH; y += blockH) {
        px.beginPath();
        px.moveTo(x, y);
        px.lineTo(x + w, y);
        px.stroke();
        const off = (Math.floor(y / blockH) % 2) * (w * 0.28);
        px.beginPath();
        px.moveTo(x + off, y + blockH * 0.5);
        px.lineTo(x + w, y + blockH * 0.5);
        px.stroke();
      }
      if (style === 'dirt' || style === 'mud') {
        /* bez trávy */
      }
    } else if (style === 'cloud') {
      g.addColorStop(0, '#bfdbfe');
      g.addColorStop(1, '#ffffff');
      px.fillStyle = g;
      px.fillRect(x, 0, w, RH);
      px.fillStyle = 'rgba(255,255,255,0.55)';
      for (let y = scroll; y < RH; y += blockH * 2) {
        px.beginPath();
        px.ellipse(x + w * 0.5, y, w * 0.45, sc(5), 0, 0, Math.PI * 2);
        px.fill();
      }
    } else if (style === 'candy') {
      for (let y = 0; y < RH; y += sc(8)) {
        px.fillStyle = (Math.floor(y / sc(8)) % 2) ? (pal.dirt || '#f472b6') : '#ffffff';
        px.fillRect(x, y, w, sc(8));
      }
    } else if (style === 'rainbow') {
      const cols = ['#ef4444', '#f97316', '#fde047', '#22c55e', '#3b82f6', '#a855f7'];
      const stripe = sc(6);
      for (let i = 0; i < RH / stripe + 1; i++) {
        px.fillStyle = cols[i % cols.length];
        px.globalAlpha = 0.55;
        px.fillRect(x, i * stripe, w, stripe);
      }
      px.globalAlpha = 1;
    } else if (style === 'crystal') {
      g.addColorStop(0, dark);
      g.addColorStop(0.5, mid);
      g.addColorStop(1, light);
      px.fillStyle = g;
      px.fillRect(x, 0, w, RH);
      px.strokeStyle = 'rgba(255,255,255,0.35)';
      px.lineWidth = lw * 0.45;
      for (let y = -blockH + scroll; y < RH; y += blockH) {
        px.beginPath();
        px.moveTo(x, y);
        px.lineTo(x + w, y + blockH);
        px.stroke();
        px.beginPath();
        px.moveTo(x + w, y);
        px.lineTo(x, y + blockH);
        px.stroke();
      }
    } else if (style === 'gold') {
      g.addColorStop(0, dark);
      g.addColorStop(0.4, '#eab308');
      g.addColorStop(1, '#fde047');
      px.fillStyle = g;
      px.fillRect(x, 0, w, RH);
      px.strokeStyle = '#a16207';
      px.lineWidth = lw * 0.45;
      for (let y = -blockH + scroll; y < RH + blockH; y += blockH) {
        px.beginPath();
        px.moveTo(x, y);
        px.lineTo(x + w, y);
        px.stroke();
      }
      for (let y = scroll + sc(10); y < RH; y += blockH * 2.5) {
        px.fillStyle = '#fef08a';
        px.fillRect(x + sc(2), y, sc(2), sc(2));
      }
    } else {
      g.addColorStop(0, dark);
      g.addColorStop(0.5, mid);
      g.addColorStop(1, light);
      px.fillStyle = g;
      px.fillRect(x, 0, w, RH);
    }

    px.strokeStyle = outline;
    px.lineWidth = lw;
    px.beginPath();
    px.moveTo(innerEdgeRight ? x + w : x, 0);
    px.lineTo(innerEdgeRight ? x + w : x, RH);
    px.stroke();
  }

  function drawWalls(theme, wallW) {
    const pal = palFor(theme.deco);
    const style = wallStyleFor(theme.deco);
    const ww = sc(wallW);
    const lw = Math.max(1.5, sc(1.5));
    const blockH = sc(14);

    drawThemedWallFace(pal, style, 0, ww, true, blockH, lw);
    drawThemedWallFace(pal, style, RW - ww, ww, false, blockH, lw);
  }

  function drawPlatform(plat, theme, camY) {
    const py = plat.y - camY;
    if (py < -20 || py > GH + 20) return;

    const pal = palFor(theme.deco);
    const x0 = sc(plat.x);
    const y0 = sc(py);
    const w = sc(plat.width);
    const capH = sc(3.5);
    const bodyH = sc(TILE_GH - 2);
    const seed = plat.index * 7 + 3;

    drawThemedPlatform(x0, y0, w, bodyH, capH, pal, theme.deco, seed);

    if (plat.index > 0 && plat.index % 10 === 0) {
      px.fillStyle = '#ffffff';
      px.strokeStyle = CARTOON.outline;
      px.lineWidth = sc(0.8);
      px.font = `bold ${Math.round(sc(7))}px Fredoka, sans-serif`;
      px.textAlign = 'center';
      px.textBaseline = 'bottom';
      px.strokeText(String(plat.index), x0 + w / 2, y0 - sc(2));
      px.fillText(String(plat.index), x0 + w / 2, y0 - sc(2));
    }
  }

  function drawCoin(gcx, gcy, color, bob) {
    const x = sc(gcx);
    const y = sc(gcy + bob);
    const r = sc(5.5);
    px.fillStyle = '#fde047';
    px.beginPath();
    px.arc(x, y, r, 0, Math.PI * 2);
    px.fill();
    px.fillStyle = '#fef08a';
    px.beginPath();
    px.arc(x - r * 0.2, y - r * 0.2, r * 0.55, 0, Math.PI * 2);
    px.fill();
    px.strokeStyle = CARTOON.outline;
    px.lineWidth = Math.max(1.5, sc(1.3));
    px.beginPath();
    px.arc(x, y, r, 0, Math.PI * 2);
    px.stroke();
    px.fillStyle = '#ffffff';
    px.beginPath();
    px.arc(x - r * 0.25, y - r * 0.3, sc(1.2), 0, Math.PI * 2);
    px.fill();
  }

  function drawParticle(gx, gy, color, life, maxLife) {
    px.globalAlpha = life / maxLife;
    px.fillStyle = color;
    const s = sc(2);
    px.beginPath();
    px.arc(sc(gx), sc(gy), s * 0.5, 0, Math.PI * 2);
    px.fill();
    px.globalAlpha = 1;
  }

  function drawHUD(state, theme, platformsPerTheme = 50) {
    const barH = sc(58);
    const pad = sc(4);
    const lw = Math.max(1.5, sc(1.8));
    const floor = Math.floor(state.highestPlatformIndex / platformsPerTheme) + 1;

    px.fillStyle = '#5eb8f0';
    px.fillRect(0, 0, RW, barH);
    px.fillStyle = '#87ceeb';
    px.fillRect(pad, pad, RW - pad * 2, barH - pad * 2);
    px.strokeStyle = CARTOON.outline;
    px.lineWidth = lw;
    px.strokeRect(pad + lw * 0.5, pad + lw * 0.5, RW - pad * 2 - lw, barH - pad * 2 - lw);

    px.textAlign = 'center';
    px.textBaseline = 'middle';
    px.font = `bold ${Math.round(sc(14))}px Fredoka, sans-serif`;
    px.fillStyle = CARTOON.outline;
    px.fillText('TRISY TOWER', RW / 2 + sc(1), pad + sc(13));
    px.fillStyle = '#ffffff';
    px.fillText('TRISY TOWER', RW / 2, pad + sc(12));

    const statsY = pad + sc(26);
    px.textAlign = 'left';
    px.font = `800 ${Math.round(sc(11))}px Fredoka, sans-serif`;
    px.fillStyle = CARTOON.outline;
    px.fillText(String(state.score), pad + sc(9), statsY + sc(1));
    px.fillStyle = '#ffffff';
    px.fillText(String(state.score), pad + sc(8), statsY);
    px.font = `700 ${Math.round(sc(8))}px Nunito, sans-serif`;
    px.fillStyle = '#2d5016';
    px.fillText(`×${state.combo}  #${state.highestPlatformIndex}`, pad + sc(8), statsY + sc(11));

    const tier = Math.floor(state.highestPlatformIndex / 25);
    px.textAlign = 'right';
    px.fillStyle = '#713f12';
    px.font = `700 ${Math.round(sc(8))}px Fredoka, sans-serif`;
    px.fillText(`Posch. ${floor}`, RW - pad - sc(8), statsY);
    px.fillStyle = '#2d5016';
    px.font = `600 ${Math.round(sc(8))}px Nunito, sans-serif`;
    px.fillText(`${theme.name} · T${tier + 1}`, RW - pad - sc(8), statsY + sc(11));

    const prog = state.highestPlatformIndex % platformsPerTheme;
    const barX = pad + sc(6);
    const barW = RW - (pad + sc(6)) * 2;
    const barY = barH - pad - sc(5);
    const barHt = sc(4);
    px.fillStyle = 'rgba(42,58,72,0.25)';
    px.fillRect(barX, barY, barW, barHt);
    px.strokeStyle = CARTOON.outline;
    px.lineWidth = sc(0.8);
    px.strokeRect(barX, barY, barW, barHt);
    const filled = barW * (prog / platformsPerTheme);
    if (filled > 0) {
      px.fillStyle = CARTOON.grass;
      px.fillRect(barX + sc(0.5), barY + sc(0.5), filled - sc(1), barHt - sc(1));
    }
  }

  function drawVignette() {
    const g = px.createRadialGradient(RW / 2, RH / 2, RH * 0.35, RW / 2, RH / 2, RH * 0.9);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.12)');
    px.fillStyle = g;
    px.fillRect(0, 0, RW, RH);
  }

  return {
    init,
    sc,
    getCtx,
    getCanvas,
    begin,
    blit,
    loadBackgrounds,
    drawBackground,
    drawWalls,
    drawPlatform,
    drawCoin,
    drawParticle,
    drawHUD,
    drawVignette,
  };
})();
