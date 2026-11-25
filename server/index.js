require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const { pool, migrate } = require('./db');
const routes = require('./routes');
const { createGeminiSession } = require('./providers/gemini');
const { createMockSession } = require('./providers/mock');

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL = process.env.GEMINI_LIVE_MODEL || 'gemini-3.8-live';
const MODE = API_KEY ? 'gemini' : 'demo';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'up', transcriber: MODE, model: MODE === 'gemini' ? MODEL : null });
  } catch (e) {
    res.status(500).json({ ok: false, db: 'down', error: e.message });
  }
});
app.use('/api/transcriptions', routes);

// Serve the built React app
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));
app.get(/^(?!\/api|\/ws).*/, (_req, res, next) => {
  res.sendFile(path.join(publicDir, 'index.html'), (err) => err && next());
});

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/transcribe' });

wss.on('connection', (client) => {
  let session = null;
  const send = (obj) => client.readyState === 1 && client.send(JSON.stringify(obj));

  function start() {
    if (session) return;
    const handlers = {
      onText: (text) => send({ type: 'delta', text }),
      onError: (err) => {
        console.error('[transcriber]', err.message);
        send({ type: 'error', message: err.message });
      },
      onClose: () => send({ type: 'done' }),
    };
    session =
      MODE === 'gemini'
        ? createGeminiSession({ apiKey: API_KEY, model: MODEL, ...handlers })
        : createMockSession(handlers);
    send({ type: 'ready', mode: MODE });
  }

  client.on('message', (data, isBinary) => {
    if (isBinary) return session && session.sendAudio(Buffer.from(data));
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (msg.type === 'start') start();
    if (msg.type === 'stop' && session) {
      const s = session;
      session = null;
      s.end();
      // give the model a moment to flush the last words, then close
      setTimeout(() => s.close(), 1500);
    }
  });

  client.on('close', () => {
    if (session) session.close();
    session = null;
  });
});

if (require.main === module) {
  migrate()
    .then(() => {
      server.listen(PORT, () => console.log(`Server on :${PORT} (transcriber: ${MODE}${MODE === 'gemini' ? `, model ${MODEL}` : ''})`));
    })
    .catch((e) => {
      console.error('Database migration failed:', e.message);
      process.exit(1);
    });
}

module.exports = { app, server };
