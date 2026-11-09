/**
 * Overenie Icy Tower režimu v prehliadači.
 * Spustenie z koreňa repa: node tools/icy-tower-checks.mjs
 * Potrebuje puppeteer-core a nainštalovaný Chrome.
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';

function loadPuppeteer() {
  const candidates = [
    import.meta.url,
    '/tmp/ppt/package.json',
    '/tmp/ppt/node_modules/puppeteer-core/package.json',
  ];
  for (const from of candidates) {
    try {
      const req = createRequire(from);
      return req('puppeteer-core');
    } catch {
      /* ďalšia cesta */
    }
  }
  throw new Error('Chýba puppeteer-core. Nainštaluj ho (npm install puppeteer-core) alebo do /tmp/ppt.');
}

const puppeteer = loadPuppeteer();

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';

const results = [];

function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  const mark = ok ? 'PREŠLO' : 'NEPREŠLO';
  console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ''}`);
}

function almost(a, b, eps = 1e-6) {
  return Math.abs(a - b) <= eps;
}

function serve(root) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      let rel = decodeURIComponent(url.pathname);
      if (rel === '/') rel = '/index.html';
      const file = path.normalize(path.join(root, rel));
      if (!file.startsWith(root)) {
        res.writeHead(403);
        res.end();
        return;
      }
      fs.readFile(file, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('not found');
          return;
        }
        const ext = path.extname(file);
        const type = {
          '.html': 'text/html',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.png': 'image/png',
          '.svg': 'image/svg+xml',
        }[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function main() {
  const server = await serve(ROOT);
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}/index.html`;
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  page.on('response', (res) => {
    if (res.status() >= 400) errors.push(`http ${res.status()} ${res.url()}`);
  });

  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('trisy-device-best', JSON.stringify({
      bestScore: 1200,
      bestFloor: 3,
      bestHeight: 80,
      bestCombo: 40,
    }));
    localStorage.setItem('trisy-player-progress', JSON.stringify({
      ana: {
        name: 'Ana',
        bestScore: 900,
        bestFloor: 2,
        bestHeight: 40,
        bestCombo: 15,
        unlockedSkins: ['default', 'ice'],
        activeSkin: 'ice',
        lastSyncedScore: 900,
        lastSyncedFloor: 2,
      },
    }));
  });

  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.TrisyTest && window.TrisyProgress, { timeout: 15000 });
  await page.waitForFunction(() => {
    const c = document.getElementById('game');
    if (!c) return false;
    const sample = c.getContext('2d').getImageData(0, 0, 8, 8).data;
    return sample.some((v) => v > 0);
  }, { timeout: 20000 });

  const startupErrors = errors.slice();

  const logic = await page.evaluate(() => {
    const T = window.TrisyTest;
    const diff0 = T.getDifficulty(0);
    const standVy = T.jumpVelocity(diff0, 0);
    const runVy = T.jumpVelocity(diff0, diff0.maxSpeed);
    const halfVy = T.jumpVelocity(diff0, diff0.maxSpeed * 0.5);
    const standApex = T.standingApex(diff0);
    const hz = [30, 60, 120, 144].map((rate) => {
      const stand = T.sampleJump(rate, 1, 0);
      const run = T.sampleJump(rate, 1, diff0.maxSpeed);
      return {
        rate,
        steps: stand.steps,
        y30: stand.yAtStep[30],
        y60: stand.yAtStep[60],
        runY30: run.yAtStep[30],
        runY60: run.yAtStep[60],
      };
    });

    let formulaBad = 0;
    let worst = 0;
    for (let i = 0; i <= 5000; i++) {
      const diff = T.getDifficulty(i);
      const apex = T.standingApex(diff);
      const cap = apex * T.GAP_APEX_RATIO;
      const gap = Math.min(diff.gapMax, cap);
      if (gap > cap + 1e-6 || gap > apex + 1e-6) formulaBad++;
      const ratio = apex > 0 ? gap / apex : 1;
      if (ratio > worst) worst = ratio;
    }
    const generated = T.measureGeneratedGaps(5000);

    const scenarios = {
      plus2: T.runScenario([{ land: 2 }]),
      plus1: T.runScenario([{ land: 1 }]),
      plus2then1: T.runScenario([{ land: 2 }, { land: 3 }]),
      fall: T.runScenario([{ land: 5 }, { land: 2 }]),
      timeout: T.runScenario([{ land: 2 }, { ticks: 180 }]),
      justBefore: T.runScenario([{ land: 2 }, { ticks: 179 }]),
      airDoesNotEnd: T.runScenario([{ land: 2 }, { air: 400 }]),
      chain: T.runScenario([{ land: 2 }, { land: 4 }, { land: 7 }, { fall: true }]),
      coin: T.runScenario([{ land: 2 }, { coin: true }]),
      same: T.runScenario([{ land: 0 }]),
    };

    const hurry = {
      before: T.hurrySpeed(100, 4),
      start: T.hurrySpeed(0, 5),
      beforeStep: T.hurrySpeed(T.HURRY_INTERVAL_STEPS - 1, 5),
      afterStep: T.hurrySpeed(T.HURRY_INTERVAL_STEPS, 5),
      twoSteps: T.hurrySpeed(T.HURRY_INTERVAL_STEPS * 2, 8),
      cap: T.hurrySpeed(T.HURRY_INTERVAL_STEPS * 40, 5000),
      earlyCap: T.hurrySpeed(T.HURRY_INTERVAL_STEPS * 40, 4),
    };

    const plat = { x: 100, width: 40 };
    const edge = {
      inside: T.playerOverlapsPlatform(120, plat),
      sixOutside: T.playerOverlapsPlatform(94, plat),
      eightOutside: T.playerOverlapsPlatform(92, plat),
      rightSix: T.playerOverlapsPlatform(140 + 6, plat),
      rightEight: T.playerOverlapsPlatform(140 + 8, plat),
    };

    T.noteJumpPress();
    const tapStart = T.readInput();
    const tapMid = T.pumpJumpBuffer(7, false);
    const tapEnd = T.pumpJumpBuffer(3, false);
    T.noteJumpPress();
    const held = T.pumpJumpBuffer(40, true);

    const runPath = T.sampleJump(60, 3, diff0.maxSpeed);
    let runMin = 0;
    runPath.yAtStep.forEach((y) => { if (y < runMin) runMin = y; });

    return {
      standVy,
      jumpForce: diff0.jumpForce,
      runVy,
      halfVy,
      standApex,
      runApex: -runMin,
      maxSpeed: diff0.maxSpeed,
      tierAt5000: Math.floor(5000 / 25),
      diffTier: T.getDifficulty(5000),
      diff16: T.getDifficulty(16 * 25),
      hz,
      formulaBad,
      worst,
      generated,
      scenarios,
      hurry,
      edge,
      tapStart,
      tapMid,
      tapEnd,
      held,
      landEdge: T.LAND_EDGE,
    };
  });

  const base = logic.hz.find((h) => h.rate === 60);
  for (const row of logic.hz) {
    const sameSteps = row.rate === 144 ? Math.abs(row.steps - 60) <= 1 : row.steps === 60;
    const samePath = almost(row.y30, base.y30) && (row.y60 == null || base.y60 == null || almost(row.y60, base.y60));
    const sameRun = almost(row.runY30, base.runY30) && (row.runY60 == null || base.runY60 == null || almost(row.runY60, base.runY60));
    check(
      `dráha skoku pri ${row.rate} Hz`,
      sameSteps && samePath && sameRun,
      `kroky=${row.steps} y30=${row.y30} y60=${row.y60}`,
    );
  }

  check(
    'stojaci skok sa nezmenil',
    almost(logic.standVy, logic.jumpForce),
    `vy=${logic.standVy} jumpForce=${logic.jumpForce} apex=${logic.standApex.toFixed(2)}`,
  );
  check(
    'rozbeh zvýši skok a má strop',
    logic.runVy < logic.jumpForce - 0.5 && logic.runApex > logic.standApex && logic.runApex < 210,
    `runVy=${logic.runVy.toFixed(3)} runApex=${logic.runApex.toFixed(2)}`,
  );
  check(
    'polovičný rozbeh dá menší bonus než plný (r²)',
    logic.halfVy < logic.jumpForce && logic.halfVy > logic.runVy,
    `half=${logic.halfVy.toFixed(3)} full=${logic.runVy.toFixed(3)}`,
  );
  check(
    'generátor 0–5000 je dosiahnuteľný zo stoja',
    logic.formulaBad === 0 && logic.generated.bad === 0 && logic.worst <= 0.85 + 1e-6,
    `formulaBad=${logic.formulaBad} generatedBad=${logic.generated.bad} worstRatio=${logic.worst.toFixed(4)} index=${logic.generated.worstIndex}`,
  );
  check(
    'tier na indexe 5000 je zastropovaný',
    almost(logic.diffTier.gravity, logic.diff16.gravity) && almost(logic.diffTier.gapMax, logic.diff16.gapMax),
    `tierBezStropu=${logic.tierAt5000}`,
  );

  const s = logic.scenarios;
  check('kombo skok o 2', s.plus2.combo === 1 && s.plus2.pending === 4 && s.plus2.score === 20 && s.plus2.timer === 180, JSON.stringify(s.plus2));
  check('skok o 1 kombo nerobí', s.plus1.combo === 0 && s.plus1.pending === 0 && s.plus1.score === 10, JSON.stringify(s.plus1));
  check('skok o 1 ukončí kombo a pripíše bonus', s.plus2then1.combo === 0 && s.plus2then1.score === 34 && s.plus2then1.highest === 3, JSON.stringify(s.plus2then1));
  check('pád na nižšiu plošinu ukončí kombo', s.fall.combo === 0 && s.fall.highest === 5 && s.fall.score === 50 + 25, JSON.stringify(s.fall));
  check('3 s čakanie ukončí kombo', s.timeout.combo === 0 && s.timeout.score === 24 && s.justBefore.combo === 1 && s.justBefore.timer === 1, `timeout=${JSON.stringify(s.timeout)} before=${JSON.stringify(s.justBefore)}`);
  check('vo vzduchu kombo nepadá', s.airDoesNotEnd.combo === 1 && s.airDoesNotEnd.timer === 180, JSON.stringify(s.airDoesNotEnd));
  check('reťaz 2+2+3 a pád', s.chain.combo === 0 && s.chain.maxCombo === 3 && s.chain.score === 87, JSON.stringify(s.chain));
  check('minca je +50 bez násobenia', s.coin.score === 20 + 50 && s.coin.combo === 1, JSON.stringify(s.coin));
  check('pristátie na tej istej plošine kombo nerobí', s.same.combo === 0 && s.same.score === 0, JSON.stringify(s.same));

  check('Hurry up pred 5. plošinou stojí', logic.hurry.before === 0 && logic.hurry.earlyCap === 0, JSON.stringify(logic.hurry));
  check('Hurry up štart 0,25', almost(logic.hurry.start, 0.25), String(logic.hurry.start));
  check('Hurry up +0,12 po 30 s', almost(logic.hurry.beforeStep, 0.25) && almost(logic.hurry.afterStep, 0.37), JSON.stringify(logic.hurry));
  check('Hurry up druhý krok', almost(logic.hurry.twoSteps, 0.49), String(logic.hurry.twoSteps));
  check('Hurry up strop 1,5', almost(logic.hurry.cap, 1.5), String(logic.hurry.cap));

  check('hrana ±6 px áno, ±8 px nie', logic.edge.inside && logic.edge.sixOutside && logic.edge.rightSix && !logic.edge.eightOutside && !logic.edge.rightEight, `LAND_EDGE=${logic.landEdge} ${JSON.stringify(logic.edge)}`);

  check(
    'ťuknutie do skoku sa do 8 krokov zabudne',
    logic.tapStart.jumpPressedTimer === 8 && logic.tapMid.jumpPressedTimer === 1 && logic.tapEnd.jumpPressedTimer === 0 && logic.tapEnd.jumpBuffer === 0,
    JSON.stringify({ start: logic.tapStart, mid: logic.tapMid, end: logic.tapEnd }),
  );
  check(
    'držanie skoku buffer nenechá vypršať',
    logic.held.jumpBuffer === 8,
    JSON.stringify(logic.held),
  );

  const records = await page.evaluate(() => {
    const device = TrisyProgress.getDeviceBest();
    const ana = TrisyProgress.getProgress('Ana');
    let corruptOk = true;
    try {
      localStorage.setItem('trisy-device-best', '{');
      TrisyProgress.getDeviceBest();
      localStorage.setItem('trisy-player-progress', 'nope');
      TrisyProgress.getProgress('Ana');
      TrisyProgress.getAllProfiles();
    } catch (err) {
      corruptOk = false;
    }
    localStorage.setItem('trisy-device-best', JSON.stringify({
      bestScore: 1200, bestFloor: 3, bestHeight: 80, bestCombo: 40,
    }));
    localStorage.setItem('trisy-player-progress', JSON.stringify({
      ana: {
        name: 'Ana', bestScore: 900, bestFloor: 2, bestHeight: 40, bestCombo: 15,
        unlockedSkins: ['default', 'ice'], activeSkin: 'ice',
        lastSyncedScore: 900, lastSyncedFloor: 2,
      },
    }));
    TrisyProgress.saveDeviceBest({ score: 50, floor: 1, height: 5, combo: 3, platform: 77 });
    const savedDevice = TrisyProgress.getDeviceBest();
    TrisyProgress.saveRun('Ana', { score: 100, floor: 1, height: 10, combo: 2, platform: 33 });
    const savedAna = TrisyProgress.getProgress('Ana');
    const text = document.getElementById('menu-personal-best').textContent;
    return { device, ana, corruptOk, savedDevice, savedAna, text };
  });

  check(
    'staré lokálne dáta nespadnú a doplní sa poschodie',
    records.corruptOk
      && records.device.bestScore === 1200
      && records.device.bestPlatform === 0
      && records.device.bestFloor === 3
      && records.ana.bestScore === 900
      && records.ana.bestPlatform === 0
      && records.ana.activeSkin === 'ice'
      && records.savedDevice.bestScore === 1200
      && records.savedDevice.bestPlatform === 77
      && records.savedDevice.bestCombo === 40
      && records.savedAna.bestPlatform === 33
      && records.savedAna.bestScore === 900
      && records.savedAna.lastSyncedScore === 900
      && records.savedAna.unlockedSkins.includes('ice'),
    JSON.stringify({
      device: records.savedDevice,
      ana: records.savedAna,
      corruptOk: records.corruptOk,
    }),
  );
  check(
    'menu ukazuje tri rekordy',
    records.text.includes('Maximum na tomto PC')
      && records.text.includes('Najvyššie poschodie')
      && records.text.includes('Najdlhšie kombo'),
    records.text.replace(/\n/g, ' | '),
  );

  const touch = await page.evaluate(() => {
    function poke(id) {
      const btn = document.getElementById(id);
      let captured = null;
      const orig = btn.setPointerCapture ? btn.setPointerCapture.bind(btn) : null;
      btn.setPointerCapture = (pointerId) => {
        captured = pointerId;
        try { if (orig) orig(pointerId); } catch (err) { /* syntetický pointer */ }
      };
      const down = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 7, button: 0 });
      btn.dispatchEvent(down);
      const afterDown = { input: TrisyTest.readInput(), pressed: btn.classList.contains('pressed'), captured };
      btn.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true, pointerId: 7 }));
      const afterLeave = { input: TrisyTest.readInput(), pressed: btn.classList.contains('pressed') };
      btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 7, button: 0 }));
      const afterUp = { input: TrisyTest.readInput(), pressed: btn.classList.contains('pressed') };
      return { afterDown, afterLeave, afterUp };
    }
    return { left: poke('btn-left'), jump: poke('btn-jump') };
  });

  check(
    'ľavé tlačidlo drží smer aj po pointerleave',
    touch.left.afterDown.input.left
      && touch.left.afterDown.pressed
      && touch.left.afterDown.captured === 7
      && touch.left.afterLeave.input.left
      && touch.left.afterLeave.pressed
      && !touch.left.afterUp.input.left
      && !touch.left.afterUp.pressed,
    JSON.stringify(touch.left),
  );
  check(
    'skokové tlačidlo drží skok aj po pointerleave',
    touch.jump.afterDown.input.jump
      && touch.jump.afterLeave.input.jump
      && !touch.jump.afterUp.input.jump,
    JSON.stringify(touch.jump),
  );

  const sfx = await page.evaluate(() => {
    const names = ['step', 'powerJump', 'combo', 'hurry', 'wallBounce'];
    const missing = names.filter((name) => typeof GameSfx[name] !== 'function');
    let threw = '';
    try {
      GameSfx.muted = true;
      GameSfx.init();
      GameSfx.step(0);
      GameSfx.step(1);
      GameSfx.powerJump();
      GameSfx.combo(3);
      GameSfx.hurry(false);
      GameSfx.hurry(true);
      GameSfx.wallBounce();
    } catch (err) {
      threw = err.message;
    }
    return { missing, threw };
  });
  check('zvuky sa dajú zavolať a nespamujú výnimkou', sfx.missing.length === 0 && !sfx.threw, JSON.stringify(sfx));
  const beforeStart = errors.length;
  await page.click('#start-btn');
  await page.waitForFunction(() => document.getElementById('overlay').classList.contains('hidden'));
  await new Promise((r) => setTimeout(r, 700));
  const started = await page.evaluate(() => {
    const c = document.getElementById('game');
    const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let ink = 0;
    for (let i = 0; i < data.length; i += 400) if (data[i + 3] > 10) ink++;
    return {
      ink,
      overlayHidden: document.getElementById('overlay').classList.contains('hidden'),
      gameOverHidden: document.getElementById('game-over').classList.contains('hidden'),
    };
  });
  const playErrors = errors.slice(beforeStart);
  const relevant = [...startupErrors, ...playErrors].filter((line) => {
    if (line.includes('favicon.ico')) return false;
    if (line.includes('Failed to load resource: the server responded with a status of 404')) return false;
    return true;
  });
  check(
    'hra sa spustí a kreslí',
    started.overlayHidden && started.gameOverHidden && started.ink > 50,
    `ink=${started.ink}`,
  );
  check(
    'bez chýb v konzole pri štarte a prvej sekunde',
    relevant.length === 0,
    relevant.join(' || ') || 'žiadne (favicon prehliadača sa neráta)',
  );

  await browser.close();
  server.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} prešlo`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error('NEŠLO SPUSTIŤ', err);
  process.exit(2);
});
