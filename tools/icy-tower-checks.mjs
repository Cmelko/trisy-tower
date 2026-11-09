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
          '.webp': 'image/webp',
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
  const assetRequests = [];
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('/assets/')) assetRequests.push(url);
  });
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

  const startupRequests = assetRequests.slice();
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
      before: T.hurrySpeed(100, 4, 0),
      start: T.hurrySpeed(0, 5, 0),
      beforeStep: T.hurrySpeed(T.HURRY_INTERVAL_STEPS - 1, 5, 0),
      afterStep: T.hurrySpeed(T.HURRY_INTERVAL_STEPS, 5, 0),
      twoSteps: T.hurrySpeed(T.HURRY_INTERVAL_STEPS * 2, 8, 0),
      cap: T.hurrySpeed(T.HURRY_INTERVAL_STEPS * 40, 5000, 0),
      earlyCap: T.hurrySpeed(T.HURRY_INTERVAL_STEPS * 40, 4, null),
      nullStart: T.hurrySpeed(3600, 5, null),
    };
    const lateClock = { simSteps: 3600, highestPlatformIndex: 4, hurryStartStep: null, hurrySpeed: 0 };
    const lateBefore = T.applyHurryClock({ ...lateClock });
    const lateReached = T.applyHurryClock({ ...lateClock, highestPlatformIndex: 5 });
    const lateHold = T.applyHurryClock({
      simSteps: 3600 + T.HURRY_INTERVAL_STEPS - 1,
      highestPlatformIndex: 5,
      hurryStartStep: lateReached.hurryStartStep,
    });
    const lateStep = T.applyHurryClock({
      simSteps: 3600 + T.HURRY_INTERVAL_STEPS,
      highestPlatformIndex: 5,
      hurryStartStep: lateReached.hurryStartStep,
    });
    const lateCap = T.applyHurryClock({
      simSteps: 3600 + T.HURRY_INTERVAL_STEPS * 40,
      highestPlatformIndex: 80,
      hurryStartStep: lateReached.hurryStartStep,
    });
    let burst = 0;
    T.consumeSteps(0, 10000, () => { burst += 1; });

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
      lateBefore,
      lateReached,
      lateHold,
      lateStep,
      lateCap,
      burst,
      powerRatio: T.POWER_JUMP_SOUND_RATIO,
      powerAt07: T.isPowerJumpSound(diff0.maxSpeed * 0.7, diff0.maxSpeed),
      powerBelow: T.isPowerJumpSound(diff0.maxSpeed * 0.69, diff0.maxSpeed),
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
  check(
    'Hurry up bez zapísaného štartu nebeží',
    logic.hurry.nullStart === 0,
    `nullStart=${logic.hurry.nullStart}`,
  );
  check(
    'Hurry po neskorom dosiahnutí 5. plošiny začína na 0,25',
    logic.lateBefore.speed === 0
      && logic.lateBefore.hurryStartStep == null
      && almost(logic.lateReached.speed, 0.25)
      && logic.lateReached.hurryStartStep === 3600
      && almost(logic.lateHold.speed, 0.25)
      && almost(logic.lateStep.speed, 0.37)
      && almost(logic.lateCap.speed, 1.5),
    JSON.stringify({
      before: logic.lateBefore,
      reached: logic.lateReached,
      hold: logic.lateHold,
      step: logic.lateStep,
      cap: logic.lateCap,
    }),
  );
  check(
    'veľký dt nespraví viac než 5 krokov',
    logic.burst === 5,
    `kroky=${logic.burst}`,
  );
  check(
    'powerJump zvuk od r 0,7, stojaci skok bez zmeny',
    logic.powerRatio === 0.7 && logic.powerAt07 === true && logic.powerBelow === false && almost(logic.standVy, logic.jumpForce),
    `prah=${logic.powerRatio}`,
  );

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
  const poisoned = await page.evaluate(() => {
    localStorage.setItem('trisy-device-best', '{"bestScore":"x","bestCombo":"bad","bestPlatform":9,"bestHeight":"nope","bestFloor":null}');
    const read = TrisyProgress.getDeviceBest();
    TrisyProgress.saveDeviceBest({ score: 100, combo: 5, floor: 1, height: 10, platform: 3 });
    const afterHigh = TrisyProgress.getDeviceBest();
    TrisyProgress.saveDeviceBest({ score: 10, combo: 1, floor: 0, height: 1, platform: 1 });
    const afterLow = TrisyProgress.getDeviceBest();
    TrisyProgress.saveDeviceBest({ score: Infinity, combo: NaN, floor: -4, height: '12.9', platform: undefined });
    const afterJunk = TrisyProgress.getDeviceBest();
    localStorage.setItem('trisy-player-progress', JSON.stringify({
      ana: {
        name: 'Ana',
        bestScore: 'x',
        bestFloor: '2',
        bestHeight: Infinity,
        bestCombo: 'bad',
        bestPlatform: '33.8',
        lastSyncedScore: '900',
        lastSyncedFloor: null,
        unlockedSkins: ['default', 'ice'],
        activeSkin: 'ice',
      },
    }));
    const anaRead = TrisyProgress.getProgress('Ana');
    TrisyProgress.saveRun('Ana', { score: 100, floor: 1, height: 10, combo: 5, platform: 4 });
    const anaHigh = TrisyProgress.getProgress('Ana');
    TrisyProgress.saveRun('Ana', { score: 10, floor: 0, height: 1, combo: 1, platform: 1 });
    const anaLow = TrisyProgress.getProgress('Ana');
    const numbers = [read, afterHigh, afterLow, afterJunk, anaRead, anaHigh, anaLow]
      .every((row) => Object.values(row).every((value) => typeof value !== 'number' || Number.isFinite(value)));
    return { read, afterHigh, afterLow, afterJunk, anaRead, anaHigh, anaLow, numbers };
  });
  check(
    'poškodené localStorage sa opraví a nižší beh rekord neprepíše',
    poisoned.numbers
      && poisoned.read.bestScore === 0
      && poisoned.read.bestCombo === 0
      && poisoned.read.bestPlatform === 9
      && poisoned.afterHigh.bestScore === 100
      && poisoned.afterHigh.bestCombo === 5
      && poisoned.afterHigh.bestPlatform === 9
      && poisoned.afterHigh.bestHeight === 10
      && poisoned.afterLow.bestScore === 100
      && poisoned.afterLow.bestCombo === 5
      && poisoned.afterLow.bestPlatform === 9
      && poisoned.afterJunk.bestScore === 100
      && poisoned.afterJunk.bestHeight === 12
      && poisoned.afterJunk.bestFloor === 1
      && poisoned.anaRead.bestScore === 0
      && poisoned.anaRead.bestFloor === 2
      && poisoned.anaRead.bestPlatform === 33
      && poisoned.anaRead.bestHeight === 0
      && poisoned.anaRead.activeSkin === 'ice'
      && poisoned.anaHigh.bestScore === 100
      && poisoned.anaHigh.bestCombo === 5
      && poisoned.anaHigh.lastSyncedScore === 900
      && poisoned.anaLow.bestScore === 100
      && poisoned.anaLow.bestCombo === 5
      && poisoned.anaLow.bestPlatform === 33,
    JSON.stringify(poisoned),
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

  const hidden = await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
    const jumpBtn = document.getElementById('btn-jump');
    jumpBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 4, button: 0 }));
    const before = {
      input: TrisyTest.readInput(),
      jumpPressed: jumpBtn.classList.contains('pressed'),
      clock: TrisyTest.readClock(),
    };
    window.dispatchEvent(new Event('pagehide'));
    const afterHide = {
      input: TrisyTest.readInput(),
      jumpPressed: jumpBtn.classList.contains('pressed'),
      leftPressed: document.getElementById('btn-left').classList.contains('pressed'),
      clock: TrisyTest.readClock(),
    };
    window.dispatchEvent(new Event('pageshow'));
    const afterShow = {
      input: TrisyTest.readInput(),
      clock: TrisyTest.readClock(),
    };
    let visibilityWorked = false;
    try {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true }));
      const desc = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      const whileHidden = TrisyTest.readClock();
      const inputHidden = TrisyTest.readInput();
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
      const whileShown = TrisyTest.readClock();
      visibilityWorked = whileHidden.running === false
        && whileHidden.pausedByHide === true
        && whileHidden.lastTime === 0
        && whileHidden.accum === 0
        && inputHidden.right === false
        && whileShown.running === true
        && whileShown.pausedByHide === false
        && whileShown.lastTime === 0
        && whileShown.accum === 0;
      if (desc) Object.defineProperty(document, 'hidden', desc);
      return { before, afterHide, afterShow, visibilityWorked, whileHidden, whileShown, inputHidden };
    } catch (err) {
      return { before, afterHide, afterShow, visibilityWorked: false, error: err.message };
    }
  });
  check(
    'pagehide pustí vstupy vrátane Space a pozastaví hru',
    hidden.before.input.left === true
      && hidden.before.input.space === true
      && hidden.before.jumpPressed === true
      && hidden.before.clock.running === true
      && hidden.afterHide.input.left === false
      && hidden.afterHide.input.space === false
      && hidden.afterHide.input.jump === false
      && hidden.afterHide.jumpPressed === false
      && hidden.afterHide.clock.running === false
      && hidden.afterHide.clock.pausedByHide === true
      && hidden.afterHide.clock.lastTime === 0
      && hidden.afterHide.clock.accum === 0
      && hidden.afterShow.clock.running === true
      && hidden.afterShow.clock.pausedByHide === false
      && hidden.afterShow.input.left === false
      && hidden.afterShow.input.space === false,
    JSON.stringify({ before: hidden.before, afterHide: hidden.afterHide, afterShow: hidden.afterShow }),
  );
  check(
    'visibilitychange pustí vstup a po návrate hra beží bez skoku času',
    hidden.visibilityWorked === true
      && hidden.whileShown
      && hidden.whileShown.lastTime === 0
      && hidden.whileShown.accum === 0
      && hidden.inputHidden
      && hidden.inputHidden.right === false,
    JSON.stringify({
      worked: hidden.visibilityWorked,
      hidden: hidden.whileHidden,
      shown: hidden.whileShown,
      input: hidden.inputHidden,
      error: hidden.error,
    }),
  );
  check(
    'bez chýb v konzole pri štarte a prvej sekunde',
    relevant.length === 0,
    relevant.join(' || ') || 'žiadne (favicon prehliadača sa neráta)',
  );

  const artNames = startupRequests
    .filter((url) => url.includes('/assets/art-pack/'))
    .map((url) => url.split('/assets/art-pack/')[1].split('?')[0]);
  const uniqueArt = [...new Set(artNames)];
  const oldBackgrounds = startupRequests.filter((url) => /\/assets\/bg-[^/]+\.png/.test(url));
  const oldPop = startupRequests.filter((url) => /\/assets\/[1-4]/.test(url));
  const versioned = startupRequests.filter((url) => url.includes('/assets/art-pack/') && url.includes('v=v3'));
  check(
    'cache verzia v3 je v URL obrázkov',
    versioned.length === uniqueArt.length && uniqueArt.length === 3,
    `${versioned.length}/${uniqueArt.length}`,
  );
  check(
    'pri štarte sa načíta len les a jednorožec',
    uniqueArt.length === 3
      && uniqueArt.includes('bg-forest.webp')
      && uniqueArt.includes('plat-forest.png')
      && uniqueArt.includes('unicorn-spritesheet-small.png')
      && oldBackgrounds.length === 0
      && oldPop.length === 0,
    `${uniqueArt.join(', ') || 'žiadne'} pop=${oldPop.length}`,
  );
  const prefetched = await page.evaluate(() => TrisyTest.preloadAt(40));
  check(
    'ďalšie prostredie sa načíta vopred, nie všetky naraz',
    prefetched.includes('bg-ice.webp')
      && prefetched.includes('plat-ice.png')
      && !prefetched.includes('bg-hell.webp')
      && !prefetched.includes('bg-space.webp'),
    prefetched.join(', '),
  );

  const pack = await page.evaluate(async () => {
    const decos = TrisyTest.themeDecos();
    const kind = ArtPack.THEME_KIND;
    const missing = decos.filter((deco) => !kind[deco]);
    const extra = Object.keys(kind).filter((deco) => !decos.includes(deco));
    const grass = Object.entries(kind).filter(([, value]) => value === 'grass').map(([deco]) => deco);
    async function size(file) {
      const res = await fetch(`assets/art-pack/${file}`);
      const blob = await res.blob();
      const bmp = await createImageBitmap(blob);
      return { ok: res.ok, w: bmp.width, h: bmp.height, bytes: blob.size };
    }
    const dims = {};
    for (const deco of decos) {
      dims[deco] = {
        bg: await size(`bg-${deco}.webp`),
        plat: await size(`plat-${deco}.png`),
      };
    }
    const uni = await size('unicorn-spritesheet-small.png');
    await ArtPack.prefetch('forest');
    const narrow = ArtPack.sliceWidths(56);
    const wide = ArtPack.sliceWidths(400);
    const bakedNarrow = ArtPack.bakePlatform('forest', 56);
    const bakedWide = ArtPack.bakePlatform('forest', 400);
    const bad = ArtPack.sliceWidths(NaN);
    const diff = TrisyTest.getDifficulty(0);
    const poses = {
      idle: ArtPack.poseFor({ onGround: true, vx: 0, vy: 0, landTimer: 0, maxSpeed: diff.maxSpeed }),
      walk: ArtPack.poseFor({ onGround: true, vx: 0.6, vy: 0, landTimer: 0, maxSpeed: diff.maxSpeed }),
      run: ArtPack.poseFor({ onGround: true, vx: diff.maxSpeed, vy: 0, landTimer: 0, maxSpeed: diff.maxSpeed }),
      jump: ArtPack.poseFor({ onGround: false, vx: 0, vy: -7, powerJump: false, maxSpeed: diff.maxSpeed }),
      runJump: ArtPack.poseFor({ onGround: false, vx: diff.maxSpeed, vy: -8, powerJump: true, maxSpeed: diff.maxSpeed }),
      fall: ArtPack.poseFor({ onGround: false, vx: 0.2, vy: 3, powerJump: false, maxSpeed: diff.maxSpeed }),
      land: ArtPack.poseFor({ onGround: true, vx: 0.2, vy: 0, landTimer: 4, maxSpeed: diff.maxSpeed }),
      pushRun: ArtPack.poseFor({ onGround: true, vx: 0.12, vy: 0, landTimer: 0, pushing: true, maxSpeed: diff.maxSpeed }),
    };
    const frames = {};
    for (const hz of [30, 60, 120]) {
      let steps = 0;
      let acc = 0;
      const frame = 1000 / hz;
      const count = Math.round(hz);
      for (let i = 0; i < count; i++) acc = TrisyTest.consumeSteps(acc, frame, () => { steps += 1; });
      frames[hz] = {
        steps,
        run: ArtPack.frameIndex('run', steps),
        idle: ArtPack.frameIndex('idle', steps),
      };
    }
    const box = TrisyTest.playerBox();
    let missThrew = '';
    await ArtPack.prefetch('candy');
    const restore = ArtPack.forceMiss('candy');
    try {
      await TrisyTest.showTheme('candy');
    } catch (err) {
      missThrew = err.message;
    }
    restore();
    const drawMs = TrisyTest.benchDraw(30);
    return {
      missing,
      extra,
      grass,
      ice: kind.ice,
      hell: kind.hell,
      dims,
      uni,
      narrow,
      wide,
      bakedNarrow: bakedNarrow && { w: bakedNarrow.w, h: bakedNarrow.h, cw: bakedNarrow.canvas.width },
      bakedWide: bakedWide && { w: bakedWide.w, h: bakedWide.h, cw: bakedWide.canvas.width },
      bad,
      poses,
      frames,
      box,
      missThrew,
      drawMs,
      cell: ArtPack.CELL,
    };
  });

  const dimOk = pack && Object.values(pack.dims).every((row) => row.bg.ok && row.bg.w === 540 && row.bg.h === 960 && row.plat.ok && row.plat.w === 512 && row.plat.h === 128);
  check('všetky pozadia a plošiny majú očakávané rozmery', dimOk && pack.uni.w === 576 && pack.uni.h === 768 && pack.cell === 96, pack.uni ? `${pack.uni.w}×${pack.uni.h}` : 'chýba');
  const changedOk = pack.dims.crystal.bg.ok && pack.dims.crystal.bg.w === 540 && pack.dims.crystal.bg.h === 960
    && pack.dims.rainbow.bg.ok && pack.dims.rainbow.bg.w === 540 && pack.dims.rainbow.bg.h === 960
    && pack.dims.clouds.plat.ok && pack.dims.clouds.plat.w === 512 && pack.dims.clouds.plat.h === 128;
  let bgBytes = 0;
  let platBytes = 0;
  Object.values(pack.dims).forEach((row) => {
    bgBytes += row.bg.bytes;
    platBytes += row.plat.bytes;
  });
  const startupBytes = pack.dims.forest.bg.bytes + pack.dims.forest.plat.bytes + pack.uni.bytes;
  const totalBytes = bgBytes + platBytes + pack.uni.bytes;
  check(
    'v2 crystal, rainbow a clouds sa načítajú v správnych rozmeroch',
    changedOk,
    `crystal ${pack.dims.crystal.bg.w}×${pack.dims.crystal.bg.h}, rainbow ${pack.dims.rainbow.bg.bytes} B, clouds plat ${pack.dims.clouds.plat.bytes} B`,
  );
  check(
    'váha v3: štart a celý balík',
    startupBytes === 371562 && totalBytes === 1472723,
    `štart ${startupBytes} B, celkom ${totalBytes} B`,
  );
  check(
    'mapovanie tém je úplné a ľad nie je tráva',
    pack.missing.length === 0 && pack.extra.length === 0 && pack.grass.length === 1 && pack.grass[0] === 'forest' && pack.ice === 'snow' && pack.hell === 'lava',
    JSON.stringify({ missing: pack.missing, grass: pack.grass, ice: pack.ice, hell: pack.hell }),
  );
  check(
    '9-slice je konečný pri úzkej aj širokej plošine',
    pack.bad == null
      && pack.narrow
      && pack.wide
      && pack.narrow.total === 56
      && pack.wide.total === 400
      && pack.narrow.mid > 0
      && pack.wide.mid > 0
      && pack.bakedNarrow
      && pack.bakedWide
      && pack.bakedNarrow.cw > 0
      && pack.bakedWide.cw > 0,
    JSON.stringify({ narrow: pack.narrow, wide: pack.wide, bakedNarrow: pack.bakedNarrow, bakedWide: pack.bakedWide }),
  );
  check(
    'stavy jednorožca sedia na animácie',
    pack.poses.idle === 'idle'
      && pack.poses.walk === 'walk'
      && pack.poses.run === 'run'
      && pack.poses.jump === 'jump_up'
      && pack.poses.runJump === 'run_jump'
      && pack.poses.fall === 'fall'
      && pack.poses.land === 'land'
      && pack.poses.pushRun === 'run',
    JSON.stringify(pack.poses),
  );
  check(
    'animácie sú rovnaké pri 30/60/120 Hz',
    pack.frames[30].steps === pack.frames[60].steps
      && pack.frames[120].steps === pack.frames[60].steps
      && pack.frames[30].run === pack.frames[60].run
      && pack.frames[120].run === pack.frames[60].run
      && pack.frames[30].idle === pack.frames[60].idle,
    JSON.stringify(pack.frames),
  );
  check(
    'chyba obrázka hru nezhodí a hitbox ostáva',
    pack.missThrew === '' && pack.box.w === 22 && pack.box.h === 28 && pack.box.platH === 10,
    `draw ${pack.drawMs.toFixed(2)} ms, box ${pack.box.w}×${pack.box.h}`,
  );
  console.log(`kreslenie snímky po art packu: ${pack.drawMs.toFixed(3)} ms (predtým ~0,77 ms)`);

  const repair = await page.evaluate(async () => {
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.canvas.width = 480;
    ctx.canvas.height = 720;
    const restoreForest = ArtPack.forceMiss('forest');
    const platBefore = ArtPack.drawPlatform(ctx, 'forest', 8, 40, 160);
    const bgBefore = ArtPack.prepareBackground('forest');
    restoreForest();
    const platAfter = ArtPack.drawPlatform(ctx, 'forest', 8, 40, 160);
    const bgAfter = ArtPack.prepareBackground('forest');
    const baked = ArtPack.bakePlatform('forest', 160);
    const origFetch = window.fetch.bind(window);
    let swampHits = 0;
    let releaseSwamp = () => {};
    const swampGate = new Promise((resolve) => { releaseSwamp = resolve; });
    window.fetch = (url, opts) => {
      const name = String(url);
      if (name.includes('swamp')) {
        swampHits += 1;
        return swampGate.then(() => origFetch(url, opts));
      }
      return origFetch(url, opts);
    };
    const concurrent = Promise.all([
      ArtPack.prefetch('swamp'),
      ArtPack.prefetch('swamp'),
      ArtPack.prefetch('swamp'),
    ]);
    const swampDuring = swampHits;
    releaseSwamp();
    await concurrent;
    window.fetch = origFetch;

    let clock = 1_000_000;
    ArtPack.debugClock(() => clock);
    ArtPack.debugDelays([5000, 15000, 30000]);
    const goldHits = { bg: 0, plat: 0 };
    window.fetch = (url, opts) => {
      const name = String(url);
      if (name.includes('bg-gold.webp')) {
        goldHits.bg += 1;
        if (goldHits.bg < 2) return Promise.resolve({ ok: false, status: 503 });
      }
      if (name.includes('plat-gold.png')) {
        goldHits.plat += 1;
        if (goldHits.plat < 2) return Promise.resolve({ ok: false, status: 503 });
      }
      return origFetch(url, opts);
    };
    await ArtPack.prefetch('gold');
    const afterFail = { ...goldHits };
    await ArtPack.prefetch('gold');
    const duringWait = { ...goldHits };
    clock += 5000;
    await ArtPack.prefetch('gold');
    const afterRetry = {
      hits: { ...goldHits },
      files: ArtPack.loadedFiles().filter((name) => name.includes('gold')),
      bg: ArtPack.prepareBackground('gold'),
      plat: ArtPack.drawPlatform(ctx, 'gold', 8, 40, 180),
    };
    window.fetch = origFetch;
    ArtPack.debugClock(null);
    ArtPack.debugDelays(null);

    clock = 2_000_000;
    ArtPack.debugClock(() => clock);
    ArtPack.debugDelays([5, 5, 5]);
    let cityHits = 0;
    window.fetch = (url, opts) => {
      if (String(url).includes('city')) {
        cityHits += 1;
        return Promise.resolve({ ok: false, status: 500 });
      }
      return origFetch(url, opts);
    };
    for (let i = 0; i < ArtPack.MAX_ATTEMPTS; i++) {
      await ArtPack.prefetch('city');
      clock += 20;
    }
    const cityAfterLimit = cityHits;
    await ArtPack.prefetch('city');
    clock += 100000;
    await ArtPack.prefetch('city');
    const cityStopped = cityHits === cityAfterLimit;
    const cityStatus = ArtPack.debugFile('bg-city.webp');
    window.fetch = origFetch;
    ArtPack.debugResetDeco('city');
    ArtPack.debugClock(null);
    ArtPack.debugDelays(null);

    await ArtPack.prefetch('clouds');
    await ArtPack.prefetch('rainbow');
    const clouds = ArtPack.bakePlatform('clouds', 200);
    const cctx = clouds.canvas.getContext('2d');
    const pixel = (x, y) => cctx.getImageData(x, y, 1, 1).data;
    const lum = (p) => (p[0] + p[1] + p[2]) / 3;
    const x = clouds.ox + 40;
    let bodyY = -1;
    let lastBody = -1;
    for (let y = 0; y < clouds.canvas.height; y++) {
      const p = pixel(x, y);
      if (p[3] > 180 && p[0] > 160 && p[1] > 160) {
        if (bodyY < 0) bodyY = y;
        lastBody = y;
      }
    }
    const edgeAt = (from, to, step) => {
      for (let y = from; step > 0 ? y <= to : y >= to; y += step) {
        if (y < 0 || y >= clouds.canvas.height) continue;
        const p = pixel(x, y);
        if (p[3] > 80 && p[2] > p[0] + 40 && lum(p) < 150) return { a: p[3], lum: lum(p) };
      }
      return null;
    };
    const topEdge = edgeAt(bodyY - 1, bodyY - 8, -1);
    const botEdge = edgeAt(lastBody + 1, lastBody + 8, 1);
    const rainbow = ArtPack.bakePlatform('rainbow', 420);
    const rctx = rainbow.canvas.getContext('2d');
    const col = (x) => {
      const data = rctx.getImageData(x, 6, 1, 20).data;
      let s = 0;
      let n = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 16) continue;
        s += data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
        n += 1;
      }
      return n ? s / n : 0;
    };
    const seam = rainbow.ox + 114;
    const seamJump = Math.abs(col(seam - 1) - col(seam + 1));
    return {
      platBefore,
      bgBefore,
      platAfter,
      bgAfter,
      bakedW: baked && baked.canvas.width,
      swampDuring,
      afterFail,
      duringWait,
      afterRetry,
      cityStopped,
      cityStatus,
      cityHits,
      topA: topEdge ? topEdge.a : 0,
      botA: botEdge ? botEdge.a : 0,
      topContrast: topEdge ? 255 - topEdge.lum : 0,
      botContrast: botEdge ? 255 - botEdge.lum : 0,
      seamJump,
    };
  });
  check(
    'plošina sa po načítaní prepne na art',
    repair.platBefore === false && repair.platAfter === true && repair.bakedW > 20,
    JSON.stringify({ before: repair.platBefore, after: repair.platAfter, w: repair.bakedW }),
  );
  check(
    'pozadie sa po načítaní prepne na art bez odchodu z témy',
    repair.bgBefore === 'fallback' && repair.bgAfter !== 'fallback',
    JSON.stringify({ before: repair.bgBefore, after: repair.bgAfter }),
  );
  check(
    'sieť sa po čakaní zopakuje a potom načíta',
    repair.afterFail.bg === 1
      && repair.afterFail.plat === 1
      && repair.duringWait.bg === 1
      && repair.duringWait.plat === 1
      && repair.afterRetry.hits.bg === 2
      && repair.afterRetry.hits.plat === 2
      && repair.afterRetry.files.length === 2
      && repair.afterRetry.plat === true
      && repair.afterRetry.bg !== 'fallback',
    JSON.stringify(repair.afterRetry),
  );
  check(
    'po vyčerpaní pokusov ostane fallback a requesty ustanú',
    repair.cityStopped === true && repair.cityStatus.givenUp === true,
    JSON.stringify({ stopped: repair.cityStopped, status: repair.cityStatus, hits: repair.cityHits }),
  );
  check(
    'súbežné prefetch nespustí duplicitné requesty',
    repair.swampDuring === 2,
    `requesty=${repair.swampDuring}`,
  );
  check(
    'clouds má kontrast obrysu hore aj dole',
    repair.topA > 40 && repair.botA > 40 && repair.topContrast > 20 && repair.botContrast > 20,
    JSON.stringify({
      topA: repair.topA,
      botA: repair.botA,
      top: repair.topContrast,
      bot: repair.botContrast,
    }),
  );
  check(
    '9-slice šev na širokej plošine nemá skok farby',
    repair.seamJump < 28,
    `skok=${repair.seamJump.toFixed(1)}`,
  );

  const scale = await page.evaluate(async () => {
    const res = await fetch('assets/art-pack/unicorn-spritesheet-small.png?v=v3');
    const blob = await res.blob();
    const bmp = await createImageBitmap(blob);
    const cell = 96;
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bmp, 0, 0);
    const data = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
    const anims = [
      ['idle', 0, 4], ['walk', 1, 6], ['run', 2, 6], ['jump_up', 3, 3],
      ['fall', 4, 3], ['land', 5, 3], ['win', 6, 6], ['run_jump', 7, 3],
    ];
    function hsv(r, g, b) {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const d = max - min;
      let h = 0;
      if (d !== 0) {
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h /= 6;
        if (h < 0) h += 1;
      }
      return [h, max === 0 ? 0 : d / max, max];
    }
    function isHorn(h, s, v) { return h >= 0.04 && h <= 0.17 && s >= 0.3 && v >= 0.38; }
    function isSnout(h, s, v) { return s <= 0.3 && v >= 0.72 && !isHorn(h, s, v); }
    function largestBox(coords) {
      const set = new Set(coords);
      const seen = new Set();
      let best = [];
      coords.forEach((start) => {
        if (seen.has(start)) return;
        const stack = [start];
        seen.add(start);
        const comp = [];
        while (stack.length) {
          const cur = stack.pop();
          comp.push(cur);
          const x = cur % cell;
          const y = (cur / cell) | 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= cell || ny >= cell) continue;
              const key = ny * cell + nx;
              if (set.has(key) && !seen.has(key)) {
                seen.add(key);
                stack.push(key);
              }
            }
          }
        }
        if (comp.length > best.length) best = comp;
      });
      if (!best.length) return null;
      let minX = cell;
      let minY = cell;
      let maxX = 0;
      let maxY = 0;
      best.forEach((key) => {
        const x = key % cell;
        const y = (key / cell) | 0;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      });
      return { n: best.length, w: maxX - minX + 1, h: maxY - minY + 1 };
    }
    function measure(col, row) {
      const ox = col * cell;
      const oy = row * cell;
      let top = cell;
      let bot = 0;
      const opaque = [];
      for (let y = 0; y < cell; y++) {
        for (let x = 0; x < cell; x++) {
          const i = ((oy + y) * bmp.width + ox + x) * 4;
          if (data[i + 3] <= 40) continue;
          if (y < top) top = y;
          if (y > bot) bot = y;
          opaque.push([x, y, data[i], data[i + 1], data[i + 2]]);
        }
      }
      if (!opaque.length) return null;
      const hgt = bot - top + 1;
      const horn = [];
      const snout = [];
      opaque.forEach(([x, y, r, g, b]) => {
        const [h, s, v] = hsv(r, g, b);
        const key = y * cell + x;
        if (y <= top + hgt * 0.48 && isHorn(h, s, v)) horn.push(key);
        if (y <= top + hgt * 0.68 && isSnout(h, s, v)) snout.push(key);
      });
      const hb = largestBox(horn);
      const sb = largestBox(snout);
      if (!hb || !sb || hb.n < 8 || sb.n < 20) return { feat: null, foot: bot };
      const feat = (Math.sqrt(sb.w * sb.h) + Math.sqrt(hb.w * hb.h)) / 2;
      return { feat, foot: bot };
    }
    const rows = {};
    anims.forEach(([name, row, frames]) => {
      const list = [];
      for (let col = 0; col < frames; col++) list.push(measure(col, row));
      const feats = list.map((item) => item.feat).filter((value) => value != null).sort((a, b) => a - b);
      const mid = (feats.length - 1) / 2;
      const feat = feats.length % 2 === 1
        ? feats[mid]
        : (feats[Math.floor(mid)] + feats[Math.ceil(mid)]) / 2;
      const feet = list.map((item) => item.foot);
      rows[name] = { feat, feet };
    });
    const idle = rows.idle.feat;
    const report = {};
    anims.forEach(([name]) => {
      report[name] = {
        delta: (rows[name].feat - idle) / idle,
        feet: rows[name].feet,
        feat: rows[name].feat,
      };
    });
    return { idleFoot: rows.idle.feet[0], report };
  });
  const ground = ['idle', 'walk', 'run'];
  let scaleOk = true;
  let worst = '';
  Object.entries(scale.report).forEach(([name, row]) => {
    if (!(Math.abs(row.delta) <= 0.08)) {
      scaleOk = false;
      worst += `${name} ${(row.delta * 100).toFixed(1)}% `;
    }
    if (ground.includes(name)) {
      row.feet.forEach((foot) => {
        if (Math.abs(foot - scale.idleFoot) > 2) {
          scaleOk = false;
          worst += `${name} noha ${foot} `;
        }
      });
    }
  });
  check(
    'ňufák a roh sú v ±8 % a kopytá stoja, chodia a bežia na línii',
    scaleOk,
    worst || Object.entries(scale.report).map(([name, row]) => `${name} ${(row.delta * 100).toFixed(1)}%`).join(', '),
  );

  const motion = await page.evaluate(() => {
    const box = TrisyTest.playerBox();
    ArtPack.resetVisual();
    ArtPack.noteMotion({ onGround: false, vy: 8, vx: 0, pose: 'fall', facing: 1, step: 0, powerJump: false });
    ArtPack.noteMotion({ onGround: true, vy: 0, vx: 0, pose: 'land', facing: 1, step: 0, landTimer: 11 });
    const landed = ArtPack.visualState();
    let settled = landed;
    for (let i = 0; i < 8; i++) {
      ArtPack.noteMotion({ onGround: true, vy: 0, vx: 0, pose: 'idle', facing: 1, step: i, powerJump: false });
      settled = ArtPack.visualState();
    }
    ArtPack.resetVisual();
    ArtPack.noteMotion({ onGround: false, vy: -6, vx: 0.4, pose: 'jump_up', facing: 1, step: 0, powerJump: false });
    const hop = ArtPack.visualState();
    ArtPack.resetVisual();
    ArtPack.noteMotion({ onGround: false, vy: -8, vx: 2, pose: 'run_jump', facing: 1, step: 0, powerJump: true });
    const power = ArtPack.visualState();
    const before = TrisyTest.readMotion();
    const probe = TrisyTest.holdProbe(12);
    const last = probe.samples[probe.samples.length - 1];
    const expected = Math.min(probe.maxSpeed, probe.accel * probe.samples.length);
    ArtPack.resetVisual();
    return {
      box,
      landedSy: landed.sy,
      landedSquash: landed.squashLeft,
      settledSy: settled.sy,
      settledSquash: settled.squashLeft,
      hopSy: hop.sy,
      hopAmt: hop.stretchAmt,
      powerSy: power.sy,
      powerAmt: power.stretchAmt,
      y: last.y,
      y0: probe.y0,
      vx: last.vx,
      expected,
      pose: probe.samples[0].pose,
      w: probe.w,
      h: probe.h,
      vx0: before.vx,
    };
  });
  check(
    'dopad stlačí postavu a po pár krokoch sa vráti na mierku 1',
    motion.landedSy < 0.97
      && motion.landedSquash >= 6
      && motion.landedSquash <= 8
      && Math.abs(motion.settledSy - 1) < 1e-6
      && motion.settledSquash === 0,
    `squash ${motion.landedSquash} sy ${motion.landedSy.toFixed(3)} → ${motion.settledSy}`,
  );
  check(
    'odraz natiahne postavu a rozbehový skok viac',
    motion.hopSy > 1.02 && motion.powerSy > motion.hopSy && motion.powerAmt > motion.hopAmt,
    `skok ${motion.hopSy.toFixed(3)} silný ${motion.powerSy.toFixed(3)}`,
  );
  check(
    'mikroanimácia nemení polohu, hitbox ani zrýchlenie',
    motion.box.w === 22
      && motion.box.h === 28
      && motion.box.platH === 10
      && motion.w === 22
      && motion.h === 28
      && Math.abs(motion.y - motion.y0) < 1e-6
      && Math.abs(motion.vx - motion.expected) < 1e-4
      && motion.pose === 'run',
    `vx ${motion.vx.toFixed(3)} očakávané ${motion.expected.toFixed(3)} y ${motion.y} póza ${motion.pose}`,
  );

  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const reduced = await page.evaluate(() => {
    ArtPack.resetVisual();
    ArtPack.noteMotion({ onGround: false, vy: 9, vx: 1, pose: 'fall', facing: 1, step: 0, powerJump: false });
    ArtPack.noteMotion({ onGround: true, vy: 0, vx: 1, pose: 'land', facing: 1, step: 1, landTimer: 11 });
    const state = ArtPack.visualState();
    ArtPack.resetVisual();
    return state;
  });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  check(
    'reduced motion vypne deformáciu aj prach',
    reduced.reduced === true && Math.abs(reduced.sy - 1) < 1e-6 && reduced.sx === 1 && reduced.dust === 0 && reduced.pendingDust === 0,
    JSON.stringify(reduced),
  );

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  const shotDir = process.env.TRISY_SHOT_DIR
    || path.join(path.dirname(fileURLToPath(import.meta.url)), 'shots');
  let shotsWritable = false;
  try {
    fs.mkdirSync(shotDir, { recursive: true });
    fs.accessSync(shotDir, fs.constants.W_OK);
    shotsWritable = true;
  } catch (err) {
    console.log(`snímky nešlo spustiť (${shotDir}): ${err.code || err.message}`);
  }
  const canvas = await page.$('#game');
  for (const deco of ['forest', 'ice', 'hell', 'space', 'desert', 'ocean', 'cave', 'clouds', 'swamp', 'city', 'candy', 'rainbow', 'crystal', 'gold']) {
    const shown = await page.evaluate((name) => TrisyTest.showTheme(name), deco);
    check(`náhľad prostredia ${deco}`, shown === true, deco);
    if (!shotsWritable) continue;
    try {
      await canvas.screenshot({ path: path.join(shotDir, `prostredie-${deco}.png`) });
      if (deco === 'forest') {
        await canvas.screenshot({ path: path.join(shotDir, 'jednorozec-beh.png') });
      }
    } catch (err) {
      shotsWritable = false;
      console.log(`snímky nešlo spustiť: ${err.code || err.message}`);
    }
  }

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
