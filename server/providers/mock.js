// Demo transcriber used when GEMINI_API_KEY is not set. It does NOT understand audio;
// it emits a scripted Hindi + English sentence word by word while audio frames arrive,
// so the whole pipeline (mic -> websocket -> database -> dashboard) can be demonstrated.
const SCRIPT = [
  'Hello, ', 'मेरा ', 'नाम ', 'Rubesh ', 'है ', 'and ', 'I ', 'am ', 'testing ', 'real-time ',
  'transcription ', 'आज ', 'का ', 'मौसम ', 'बहुत ', 'अच्छा ', 'है. ',
];

function createMockSession({ onText, onClose }) {
  let frames = 0;
  let i = 0;
  let closed = false;
  return {
    sendAudio() {
      if (closed) return;
      frames += 1;
      if (frames % 5 === 0) onText(SCRIPT[i++ % SCRIPT.length]);
    },
    end() {},
    close() {
      if (!closed) {
        closed = true;
        onClose();
      }
    },
  };
}

module.exports = { createMockSession };
