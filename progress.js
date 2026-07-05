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

  function skinsForFloor(floor) {
    return SKIN_RULES.filter((r) => floor >= r.floor).map((r) => r.id);
  }

  function mergeSkins(existing, floor) {
    return [...new Set([...(existing || ['default']), ...skinsForFloor(floor)])];
  }

  function getProgress(name) {
    const key = normalizeName(name);
    if (!key) return defaultProgress();
    const all = readAll();
    return { ...defaultProgress(name), ...(all[key] || {}), name: name.trim().slice(0, 20) };
  }

  function getAllProfiles() {
    const all = readAll();
    return Object.values(all)
      .filter((p) => p && p.name && p.bestScore > 0)
      .sort((a, b) => b.bestScore - a.bestScore || b.bestFloor - a.bestFloor);
  }

  function needsRemoteSync(prog, remoteScores = []) {
    if (!prog?.name || !prog.bestScore) return false;
    const remote = remoteScores.find(
      (s) => s.name.toLowerCase() === normalizeName(prog.name),
    );
    const beatsSynced = prog.bestScore > (prog.lastSyncedScore || 0)
      || (prog.bestScore === (prog.lastSyncedScore || 0) && prog.bestFloor > (prog.lastSyncedFloor || 0));
    if (!beatsSynced) return false;
    if (!remote) return true;
    return prog.bestScore > remote.score
      || (prog.bestScore === remote.score && prog.bestFloor > remote.floor);
  }

  function markRemoteSynced(name, run) {
    const key = normalizeName(name);
    if (!key) return;
    const all = readAll();
    const prev = { ...defaultProgress(name), ...(all[key] || {}) };
    prev.lastSyncedScore = Math.max(prev.lastSyncedScore || 0, Math.floor(run.score || 0));
    prev.lastSyncedFloor = Math.max(prev.lastSyncedFloor || 0, Math.floor(run.floor || 0));
    all[key] = prev;
    writeAll(all);
  }

  function getDeviceBest() {
    try {
      const raw = localStorage.getItem(DEVICE_BEST_KEY);
      if (!raw) return { bestScore: 0, bestFloor: 0, bestHeight: 0, bestCombo: 0 };
      return { bestScore: 0, bestFloor: 0, bestHeight: 0, bestCombo: 0, ...JSON.parse(raw) };
    } catch {
      return { bestScore: 0, bestFloor: 0, bestHeight: 0, bestCombo: 0 };
    }
  }

  function saveDeviceBest(run) {
    const floor = Math.max(0, Math.floor(run.floor || 0));
    const score = Math.max(0, Math.floor(run.score || 0));
    const height = Math.max(0, Math.floor(run.height || 0));
    const combo = Math.max(0, Math.floor(run.combo || 0));
    const prev = getDeviceBest();
    localStorage.setItem(DEVICE_BEST_KEY, JSON.stringify({
      bestScore: Math.max(prev.bestScore, score),
      bestFloor: Math.max(prev.bestFloor, floor),
      bestHeight: Math.max(prev.bestHeight, height),
      bestCombo: Math.max(prev.bestCombo, combo),
    }));
  }

  function saveRun(name, run) {
    const key = normalizeName(name);
    if (!key) return defaultProgress();

    const all = readAll();
    const prev = { ...defaultProgress(name), ...(all[key] || {}) };
    const floor = Math.max(0, Math.floor(run.floor || 0));
    const score = Math.max(0, Math.floor(run.score || 0));
    const height = Math.max(0, Math.floor(run.height || 0));
    const combo = Math.max(0, Math.floor(run.combo || 0));

    const next = {
      name: name.trim().slice(0, 20),
      bestScore: Math.max(prev.bestScore, score),
      bestFloor: Math.max(prev.bestFloor, floor),
      bestHeight: Math.max(prev.bestHeight, height),
      bestCombo: Math.max(prev.bestCombo, combo),
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
