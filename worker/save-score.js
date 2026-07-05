const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function clean(payload) {
  return {
    score: Math.min(999999, Math.max(0, Math.floor(Number(payload.score) || 0))),
    name: String(payload.name || 'Hráč').replace(/[\t\r\n<>]/g, ' ').trim().slice(0, 20) || 'Hráč',
    height: Math.min(99999, Math.max(0, Math.floor(Number(payload.height) || 0))),
    combo: Math.min(999, Math.max(0, Math.floor(Number(payload.combo) || 0))),
    floor: Math.min(13, Math.max(0, Math.floor(Number(payload.floor) || 0))),
    date: new Date().toISOString().slice(0, 10),
  };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }
    if (request.method !== 'POST') {
      return json({ ok: true, service: 'trisy-tower-save' });
    }
    if (!env.GITHUB_TOKEN) {
      return json({ error: 'missing token' }, 500);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: 'bad json' }, 400);
    }

    const entry = clean(payload);
    const repo = env.GITHUB_REPO || 'Cmelko/trisy-tower';

    const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'trisy-tower-worker',
      },
      body: JSON.stringify({
        event_type: 'save-score',
        client_payload: entry,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return json({ error: 'github dispatch failed', detail: text }, 502);
    }

    return json({ ok: true, entry });
  },
};
