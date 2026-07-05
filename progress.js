(() => {
  'use strict';

  const STORAGE_KEY = 'trisy-player-progress';

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
    saveRun,
    setActiveSkin,
    newUnlocks,
    skinsForFloor,
  };
})();
