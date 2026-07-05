(() => {
  'use strict';

  const REPO = window.TRISY_REPO || 'Cmelko/trisy-tower';
  const SAVE_URL = window.TRISY_SAVE_URL || '';
  const TOKEN = window.TRISY_DISPATCH_TOKEN || '';
  const SCORES_URL = `https://raw.githubusercontent.com/${REPO}/master/scores.txt`;
  const HEADER = '# score\tname\theight\tcombo\tfloor\tdate';

  function parseScores(text) {
    return text.split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const parts = line.split('\t');
        const [score, name, height, combo, floor, date] = parts;
        return {
          score: Number(score) || 0,
          name: name || '?',
          height: Number(height) || 0,
          combo: Number(combo) || 0,
          floor: Number(floor) || 0,
          date: date || '',
        };
      })
      .sort((a, b) => b.score - a.score || b.floor - a.floor)
      .slice(0, 50);
  }

  function sanitizeName(name) {
    return name.replace(/[\t\r\n<>]/g, ' ').trim().slice(0, 20) || 'Hráč';
  }

  function cleanEntry(entry) {
    return {
      score: Math.min(999999, Math.max(0, Math.floor(entry.score))),
      name: sanitizeName(entry.name),
      height: Math.min(99999, Math.max(0, Math.floor(entry.height))),
      combo: Math.min(999, Math.max(0, Math.floor(entry.combo))),
      floor: Math.min(13, Math.max(0, Math.floor(entry.floor))),
      date: new Date().toISOString().slice(0, 10),
    };
  }

  async function fetchWithTimeout(url, options = {}, ms = 10000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      return await fetch(url, { ...options, signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchRemote() {
    const res = await fetchWithTimeout(`${SCORES_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('fetch failed');
    return parseScores(await res.text());
  }

  function mergeEntry(scores, entry) {
    const key = entry.name.toLowerCase();
    const rest = scores.filter((s) => s.name.toLowerCase() !== key);
    const prev = scores.find((s) => s.name.toLowerCase() === key);
    const merged = {
      score: Math.max(prev?.score || 0, entry.score),
      name: entry.name,
      height: Math.max(prev?.height || 0, entry.height),
      combo: Math.max(prev?.combo || 0, entry.combo),
      floor: Math.max(prev?.floor || 0, entry.floor),
      date: entry.date,
    };
    return [...rest, merged]
      .sort((a, b) => b.score - a.score || b.floor - a.floor)
      .slice(0, 50);
  }

  async function loadScores() {
    return fetchRemote();
  }

  async function waitForRemote(entry, attempts = 5, delayMs = 1500) {
    for (let i = 0; i < attempts; i++) {
      await new Promise((r) => setTimeout(r, delayMs));
      try {
        const scores = await fetchRemote();
        const hit = scores.find((s) =>
          s.name.toLowerCase() === entry.name.toLowerCase()
          && s.score >= entry.score
          && s.floor >= entry.floor);
        if (hit) return scores;
      } catch {
        /* retry */
      }
    }
    try {
      return await fetchRemote();
    } catch {
      return [];
    }
  }

  async function postToWorker(entry) {
    const res = await fetchWithTimeout(SAVE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    if (!res.ok) throw new Error('save url failed');
    return res.json().catch(() => ({}));
  }

  async function postToGitHub(entry) {
    const res = await fetchWithTimeout(`https://api.github.com/repos/${REPO}/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'save-score',
        client_payload: entry,
      }),
    });
    if (!res.ok) throw new Error('dispatch failed');
  }

  async function saveScore(entry) {
    const clean = cleanEntry(entry);

    if (window.TrisyProgress) {
      TrisyProgress.saveRun(clean.name, clean);
    }

    let baseline = [];
    try {
      baseline = await fetchRemote();
    } catch {
      /* ok — použijeme optimistický merge */
    }

    if (SAVE_URL) {
      await postToWorker(clean);
    } else if (TOKEN) {
      await postToGitHub(clean);
    } else {
      throw new Error('no-save-backend');
    }

    const optimistic = mergeEntry(baseline, clean);

    waitForRemote(clean).then((fresh) => {
      if (fresh.length && typeof window.TrisyLeaderboard._onRemoteRefresh === 'function') {
        window.TrisyLeaderboard._onRemoteRefresh(fresh);
      }
    }).catch(() => {});

    return optimistic;
  }

  async function syncLocalHistory(skipName = '') {
    if (!hasRemoteSave() || !window.TrisyProgress) return [];

    let scores = [];
    try {
      scores = await fetchRemote();
    } catch {
      scores = [];
    }

    const skip = skipName.trim().toLowerCase();
    const pending = TrisyProgress.getAllProfiles().filter((prog) => {
      if (prog.name.toLowerCase() === skip) return false;
      return TrisyProgress.needsRemoteSync(prog, scores);
    });

    for (const prog of pending) {
      const entry = cleanEntry({
        name: prog.name,
        score: prog.bestScore,
        height: prog.bestHeight,
        combo: prog.bestCombo,
        floor: prog.bestFloor,
      });
      try {
        if (SAVE_URL) {
          await postToWorker(entry);
        } else if (TOKEN) {
          await postToGitHub(entry);
        }
        scores = mergeEntry(scores, entry);
        TrisyProgress.markRemoteSynced(prog.name, entry);
        await new Promise((r) => setTimeout(r, 800));
      } catch {
        break;
      }
    }

    return scores;
  }

  function floorLabel(floor) {
    const names = ['Les', 'Ľad', 'Peklo', 'Vesmír', 'Púšť', 'Oceán', 'Jaskyňa', 'Oblaky', 'Bažina', 'Mesto', 'Cukrík', 'Dúha', 'Kryštál', 'Zlatý vrch'];
    return names[floor] || `Poschodie ${floor + 1}`;
  }

  function render(listEl, scores) {
    if (!listEl) return;
    listEl.innerHTML = '';
    if (!scores.length) {
      listEl.innerHTML = '<li class="lb-empty">Zatiaľ prázdne — buď prvý!</li>';
      return;
    }
    scores.slice(0, 10).forEach((s, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="lb-rank">${i + 1}.</span> `
        + `<strong>${escapeHtml(s.name)}</strong> `
        + `<span class="lb-score">${s.score}</span> `
        + `<span class="lb-meta">${s.height} m · ×${s.combo} · ${escapeHtml(floorLabel(s.floor))}</span>`;
      listEl.appendChild(li);
    });
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  window.TrisyLeaderboard = {
    loadScores,
    saveScore,
    syncLocalHistory,
    render,
    hasRemoteSave: () => Boolean(SAVE_URL || TOKEN),
    HEADER,
  };
})();
