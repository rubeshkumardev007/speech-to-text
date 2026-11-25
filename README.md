# Speech to Text (Hindi + English)

Real-time multilingual speech-to-text web app. Speak into the mic in Hindi, English or a mix, and the transcript streams onto the screen while you talk. Transcripts are saved in PostgreSQL and managed from a history dashboard (create, read, update, delete, search, paging).

## How it works

- **Frontend** (React + Vite): captures the mic with an AudioWorklet, downsamples to 16 kHz PCM16 and streams it over a WebSocket.
- **Backend** (Node + Express + ws): proxies the audio to the Gemini Live API (`inputAudioTranscription`), so the API key never reaches the browser, and relays transcript text back live.
- **Database** (PostgreSQL): table `transcriptions` (id, title, text, language, duration_ms, created_at, updated_at), created automatically on startup.
- **Demo mode**: with no `GEMINI_API_KEY` the server streams a scripted Hindi + English sentence so the whole app can be tried without a key.

## Run locally

```bash
cp .env.example .env        # set DATABASE_URL and GEMINI_API_KEY
npm install
npm run build               # builds the React app into server/public
npm start                   # http://localhost:3000
```

Get a free key at https://aistudio.google.com/apikey. Change `GEMINI_LIVE_MODEL` in `.env` if Google renames the Live model.

Dev mode: `npm run dev` (API) and, in `client/`, `npm run dev` (Vite with proxy).

## Tests

```bash
DATABASE_URL=postgres://stt:stt@localhost:5432/stt npm test
```

Covers health, the full CRUD lifecycle (with Hindi text, validation, search) and the WebSocket streaming path.

## API

| Method | Path | Notes |
| --- | --- | --- |
| GET | /api/transcriptions?search=&limit=&offset= | list with search and paging |
| GET | /api/transcriptions/:id | one record |
| POST | /api/transcriptions | `{title?, text, language?, duration_ms?}` |
| PUT | /api/transcriptions/:id | update title/text/language |
| DELETE | /api/transcriptions/:id | 204 |
| WS | /ws/transcribe | binary PCM16 16 kHz frames; JSON `start` / `stop` |

## Deploy (Render)

Push to GitHub, create a Blueprint from `render.yaml` (web service + free Postgres), then set `GEMINI_API_KEY` in the service environment. A `Dockerfile` is included for any container host. Microphone access needs HTTPS, which Render provides.
