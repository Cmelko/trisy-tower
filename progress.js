(() => {
  'use strict';

  const STORAGE_KEY = 'trisy-player-progress';
  const DEVICE_BEST_KEY = 'trisy-device-best';

  const SKIN_RULES = [
    { id: 'default', floor: 0, label: 'Pop (základ)' },
    { id: 'ice', floor: 1, label: 'Ľadový Pop' },
    { id: 'lava', floor: 2, label: 'Ohnivý Pop' },
    { id: 'space', floor: 3, label: 'Kozmický Pop' },
    { id: 'gold', floor: 13, label: 'Zlatý Pop' },
  ];

  function defaultProgress(name = '') {
    return {
      name,
      bestScore: 0,
      bestFloor: 0,
      bestHeight: 0,
      bestCombo: 0,
      bestPlatform: 0,
      lastSyncedScore: 0,
      lastSyncedFloor: 0,
      unlockedSkins: ['default'],
      activeSkin: 'default',
    };
  }

  function readAll() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function writeAll(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function normalizeName(name) {
    return name.replace(/[\t\r\n<>]/g, ' ').trim().slice(0, 20).toLowerCase();
  }

  function cleanCount(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.floor(n));
  }

  function skinsForFloor(floor) {
    return SKIN_RULES.filter((r) => floor >= r.floor).map((r) => r.id);
  }

  function mergeSkins(existing, floor) {
    return [...new Set([...(existing || ['default']), ...skinsForFloor(floor)])];
  }

  function sanitizeProgress(raw, fallbackName = '') {
    const src = raw && typeof raw === 'object' ? raw : {};
    const name = (typeof src.name === 'string' ? src.name : fallbackName).trim().slice(0, 20);
    const unlocked = Array.isArray(src.unlockedSkins)
      ? src.unlockedSkins.filter((id) => typeof id === 'string' && id)
      : ['default'];
    const skins = unlocked.length ? [...new Set(unlocked)] : ['default'];
    if (!skins.includes('default')) skins.unshift('default');
    let activeSkin = typeof src.activeSkin === 'string' && src.activeSkin ? src.activeSkin : 'default';
    if (!skins.includes(activeSkin)) activeSkin = 'default';
    return {
      name,
      bestScore: cleanCount(src.bestScore),
      bestFloor: cleanCount(src.bestFloor),
      bestHeight: cleanCount(src.bestHeight),
      bestCombo: cleanCount(src.bestCombo),
      bestPlatform: cleanCount(src.bestPlatform),
      lastSyncedScore: cleanCount(src.lastSyncedScore),
      lastSyncedFloor: cleanCount(src.lastSyncedFloor),
      unlockedSkins: skins,
      activeSkin,
    };
  }

  function getProgress(name) {
    const key = normalizeName(name);
    if (!key) return defaultProgress();
    const all = readAll();
    const clean = sanitizeProgress(all[key] || {}, name);
    clean.name = (name || clean.name).trim().slice(0, 20);
    return clean;
  }

  function getAllProfiles() {
    const all = readAll();
    return Object.values(all)
      .map((p) => sanitizeProgress(p, p && p.name))
      .filter((p) => p && p.name && p.bestScore > 0)
      .sort((a, b) => b.bestScore - a.bestScore || b.bestFloor - a.bestFloor);
  }

  function needsRemoteSync(prog, remoteScores = []) {
    if (!prog?.name) return false;
    const bestScore = cleanCount(prog.bestScore);
    const bestFloor = cleanCount(prog.bestFloor);
    const lastSyncedScore = cleanCount(prog.lastSyncedScore);
    const lastSyncedFloor = cleanCount(prog.lastSyncedFloor);
    if (!bestScore) return false;
    const remote = remoteScores.find(
      (s) => s.name.toLowerCase() === normalizeName(prog.name),
    );
    const beatsSynced = bestScore > lastSyncedScore
      || (bestScore === lastSyncedScore && bestFloor > lastSyncedFloor);
    if (!beatsSynced) return false;
    if (!remote) return true;
    const remoteScore = cleanCount(remote.score);
    const remoteFloor = cleanCount(remote.floor);
    return bestScore > remoteScore
      || (bestScore === remoteScore && bestFloor > remoteFloor);
  }

  function markRemoteSynced(name, run) {
    const key = normalizeName(name);
    if (!key) return;
    const all = readAll();
    const prev = sanitizeProgress({ ...(all[key] || {}), name }, name);
    prev.lastSyncedScore = Math.max(prev.lastSyncedScore, cleanCount(run && run.score));
    prev.lastSyncedFloor = Math.max(prev.lastSyncedFloor, cleanCount(run && run.floor));
    all[key] = prev;
    writeAll(all);
  }

  function emptyDeviceBest() {
    return { bestScore: 0, bestFloor: 0, bestHeight: 0, bestCombo: 0, bestPlatform: 0 };
  }

  function readDeviceBest() {
    try {
      const raw = localStorage.getItem(DEVICE_BEST_KEY);
      if (!raw) return emptyDeviceBest();
      const parsed = JSON.parse(raw);
      const src = parsed && typeof parsed === 'object' ? parsed : {};
      return {
        bestScore: cleanCount(src.bestScore),
        bestFloor: cleanCount(src.bestFloor),
        bestHeight: cleanCount(src.bestHeight),
        bestCombo: cleanCount(src.bestCombo),
        bestPlatform: cleanCount(src.bestPlatform),
      };
    } catch {
      return emptyDeviceBest();
    }
  }

  function getDeviceBest() {
    return readDeviceBest();
  }

  function saveDeviceBest(run) {
    const prev = readDeviceBest();
    const source = run && typeof run === 'object' ? run : {};
    localStorage.setItem(DEVICE_BEST_KEY, JSON.stringify({
      bestScore: Math.max(prev.bestScore, cleanCount(source.score)),
      bestFloor: Math.max(prev.bestFloor, cleanCount(source.floor)),
      bestHeight: Math.max(prev.bestHeight, cleanCount(source.height)),
      bestCombo: Math.max(prev.bestCombo, cleanCount(source.combo)),
      bestPlatform: Math.max(prev.bestPlatform, cleanCount(source.platform)),
    }));
  }

  function saveRun(name, run) {
    const key = normalizeName(name);
    if (!key) return defaultProgress();

    const all = readAll();
    const prev = sanitizeProgress({ ...(all[key] || {}), name }, name);
    const source = run && typeof run === 'object' ? run : {};
    const floor = cleanCount(source.floor);
    const score = cleanCount(source.score);
    const height = cleanCount(source.height);
    const combo = cleanCount(source.combo);
    const platform = cleanCount(source.platform);

    const next = {
      name: name.trim().slice(0, 20),
      bestScore: Math.max(prev.bestScore, score),
      bestFloor: Math.max(prev.bestFloor, floor),
      bestHeight: Math.max(prev.bestHeight, height),
      bestCombo: Math.max(prev.bestCombo, combo),
      bestPlatform: Math.max(prev.bestPlatform, platform),
      lastSyncedScore: prev.lastSyncedScore,
      lastSyncedFloor: prev.lastSyncedFloor,
      unlockedSkins: mergeSkins(prev.unlockedSkins, Math.max(prev.bestFloor, floor)),
      activeSkin: prev.activeSkin || 'default',
    };

    if (!next.unlockedSkins.includes(next.activeSkin)) {
      next.activeSkin = 'default';
    }

    all[key] = next;
    writeAll(all);
    localStorage.setItem('trisy-player-name', next.name);
    return next;
  }

  function setActiveSkin(name, skinId) {
    const prog = getProgress(name);
    if (!prog.unlockedSkins.includes(skinId)) return prog;
    prog.activeSkin = skinId;
    const all = readAll();
    all[normalizeName(name)] = prog;
    writeAll(all);
    return prog;
  }

  function newUnlocks(before, after) {
    const prev = new Set(before.unlockedSkins || ['default']);
    return (after.unlockedSkins || []).filter((id) => !prev.has(id));
  }

  window.TrisyProgress = {
    SKIN_RULES,
    getProgress,
    getAllProfiles,
    needsRemoteSync,
    markRemoteSynced,
    getDeviceBest,
    saveDeviceBest,
    saveRun,
    setActiveSkin,
    newUnlocks,
    skinsForFloor,
  };
})();
