const WebSocket = require('ws');

const SYSTEM_PROMPT =
  'You are a silent speech-to-text service. The speaker may mix Hindi and English in the same sentence. ' +
  'Never reply, never answer questions and never speak. Only listen.';

/**
 * Streams 16 kHz mono PCM16 audio to the Gemini Live API and reports the
 * server-side "input transcription" text as it arrives.
 */
function createGeminiSession({ apiKey, model, onText, onError, onClose }) {
  const url =
    'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent' +
    `?key=${encodeURIComponent(apiKey)}`;

  const ws = new WebSocket(url);
  const pending = []; // audio queued until setup finishes
  let ready = false;
  let closed = false;

  ws.on('open', () => {
    ws.send(
      JSON.stringify({
        setup: {
          model: `models/${model}`,
          generationConfig: { responseModalities: ['AUDIO'] },
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          inputAudioTranscription: {},
        },
      })
    );
  });

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (msg.setupComplete) {
      ready = true;
      while (pending.length) sendChunk(pending.shift());
      return;
    }
    const t = msg.serverContent && msg.serverContent.inputTranscription;
    if (t && typeof t.text === 'string' && t.text) onText(t.text);
    if (msg.error) onError(new Error(msg.error.message || 'Gemini Live error'));
  });

  ws.on('error', (err) => onError(err));
  ws.on('close', (code, reason) => {
    closed = true;
    if (code !== 1000 && code !== 1005) {
      onError(new Error(`Gemini Live closed (${code}) ${reason ? reason.toString() : ''}`.trim()));
    }
    onClose();
  });

  function sendChunk(buf) {
    ws.send(
      JSON.stringify({
        realtimeInput: { audio: { data: buf.toString('base64'), mimeType: 'audio/pcm;rate=16000' } },
      })
    );
  }

  return {
    sendAudio(buf) {
      if (closed) return;
      if (!ready) return void pending.push(buf);
      if (ws.readyState === WebSocket.OPEN) sendChunk(buf);
    },
    end() {
      if (ready && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
      }
    },
    close() {
      if (!closed) ws.close(1000);
    },
  };
}

module.exports = { createGeminiSession };
