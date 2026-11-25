process.env.GEMINI_API_KEY = ''; // force demo transcriber
const test = require('node:test');
const assert = require('node:assert');
const WebSocket = require('ws');
const { server } = require('../index');
const { migrate, pool } = require('../db');

let base;
let wsUrl;

test.before(async () => {
  await migrate();
  await pool.query('TRUNCATE transcriptions RESTART IDENTITY');
  await new Promise((r) => server.listen(0, r));
  const { port } = server.address();
  base = `http://127.0.0.1:${port}`;
  wsUrl = `ws://127.0.0.1:${port}/ws/transcribe`;
});

test.after(async () => {
  server.close();
  await pool.end();
});

const j = (path, opts = {}) =>
  fetch(base + path, { headers: { 'content-type': 'application/json' }, ...opts });

test('health reports db up and demo transcriber', async () => {
  const r = await j('/api/health');
  const b = await r.json();
  assert.equal(r.status, 200);
  assert.equal(b.db, 'up');
  assert.equal(b.transcriber, 'demo');
});

test('CRUD lifecycle', async () => {
  // create (Hindi + English)
  let r = await j('/api/transcriptions', {
    method: 'POST',
    body: JSON.stringify({ title: 'First', text: 'मेरा नाम Rubesh है', language: 'hi-en', duration_ms: 2400 }),
  });
  assert.equal(r.status, 201);
  const created = await r.json();
  assert.equal(created.text, 'मेरा नाम Rubesh है');
  assert.equal(created.duration_ms, 2400);

  // validation
  r = await j('/api/transcriptions', { method: 'POST', body: JSON.stringify({ text: '   ' }) });
  assert.equal(r.status, 400);

  // read one + list + search
  r = await j(`/api/transcriptions/${created.id}`);
  assert.equal((await r.json()).id, created.id);
  r = await j('/api/transcriptions?search=rubesh');
  let list = await r.json();
  assert.equal(list.total, 1);
  r = await j('/api/transcriptions?search=nomatch');
  assert.equal((await r.json()).total, 0);

  // update
  r = await j(`/api/transcriptions/${created.id}`, {
    method: 'PUT',
    body: JSON.stringify({ title: 'Edited', text: 'Hello दुनिया', language: 'hi-en' }),
  });
  const updated = await r.json();
  assert.equal(updated.title, 'Edited');
  assert.equal(updated.text, 'Hello दुनिया');

  // delete
  r = await j(`/api/transcriptions/${created.id}`, { method: 'DELETE' });
  assert.equal(r.status, 204);
  r = await j(`/api/transcriptions/${created.id}`);
  assert.equal(r.status, 404);
});

test('websocket streams transcript deltas back while audio frames arrive', async () => {
  const text = await new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let out = '';
    ws.on('error', reject);
    ws.on('open', () => ws.send(JSON.stringify({ type: 'start' })));
    ws.on('message', (data) => {
      const m = JSON.parse(data.toString());
      if (m.type === 'ready') {
        for (let i = 0; i < 20; i++) ws.send(Buffer.alloc(3200)); // 20 x 100ms of silence
        ws.send(JSON.stringify({ type: 'stop' }));
      }
      if (m.type === 'delta') out += m.text;
      if (m.type === 'done') {
        ws.close();
        resolve(out);
      }
    });
  });
  assert.ok(text.includes('Hello'), `got: ${text}`);
  assert.ok(/[ऀ-ॿ]/.test(text), 'expected Devanagari (Hindi) text in demo output');
});
