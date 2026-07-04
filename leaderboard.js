(() => {
  'use strict';

  const REPO = window.TRISY_REPO || 'Cmelko/trisy-tower';
  const TOKEN = window.TRISY_DISPATCH_TOKEN || '';
  const SCORES_URL = `https://raw.githubusercontent.com/${REPO}/master/scores.txt`;
  const LOCAL_KEY = 'trisy-local-scores';

  function parseScores(text) {
    return text.split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const [score, name, height, combo, date] = line.split('\t');
        return {
          score: Number(score) || 0,
          name: name || '?',
          height: Number(height) || 0,
          combo: Number(combo) || 0,
          date: date || '',
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 25);
  }

  function formatScores(scores) {
    const header = '# score\tname\theight\tcombo\tdate';
    const body = scores.map((s) => `${s.score}\t${s.name}\t${s.height}\t${s.combo}\t${s.date}`).join('\n');
    return `${header}\n${body}\n`;
  }

  function readLocal() {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function writeLocal(scores) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(scores.slice(0, 25)));
  }

  async function fetchRemote() {
    const res = await fetch(`${SCORES_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('fetch failed');
    return parseScores(await res.text());
  }

  async function loadScores() {
    try {
      const remote = await fetchRemote();
      writeLocal(remote);
      return remote;
    } catch {
      return readLocal();
    }
  }

  function sanitizeName(name) {
    return name.replace(/[\t\r\n<>]/g, ' ').trim().slice(0, 20) || 'Hráč';
  }

  async function saveScore(entry) {
    const clean = {
      score: Math.max(0, Math.floor(entry.score)),
      name: sanitizeName(entry.name),
      height: Math.max(0, Math.floor(entry.height)),
      combo: Math.max(0, Math.floor(entry.combo)),
      date: new Date().toISOString().slice(0, 10),
    };

    if (TOKEN) {
      try {
        const res = await fetch(`https://api.github.com/repos/${REPO}/dispatches`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${TOKEN}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            event_type: 'save-score',
            client_payload: clean,
          }),
        });
        if (!res.ok) throw new Error('dispatch failed');
        await new Promise((r) => setTimeout(r, 2500));
        return loadScores();
      } catch {
        /* fallback local */
      }
    }

    const merged = [...readLocal(), clean]
      .sort((a, b) => b.score - a.score)
      .slice(0, 25);
    writeLocal(merged);
    return merged;
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
        + `<span class="lb-meta">${s.height} m · ×${s.combo}</span>`;
      listEl.appendChild(li);
    });
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  window.TrisyLeaderboard = {
    loadScores,
    saveScore,
    render,
    hasRemoteSave: () => Boolean(TOKEN),
  };
})();
