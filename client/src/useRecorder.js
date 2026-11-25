import { useCallback, useRef, useState } from 'react';

/**
 * Captures the microphone, streams 16 kHz PCM16 frames over a WebSocket and
 * appends the transcript text that the server sends back in real time.
 */
export function useRecorder() {
  const [status, setStatus] = useState('idle'); // idle | connecting | recording | stopping
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState('');
  const [durationMs, setDurationMs] = useState(0);
  const refs = useRef({});

  const cleanupAudio = () => {
    const r = refs.current;
    r.stream?.getTracks().forEach((t) => t.stop());
    r.node?.disconnect();
    r.source?.disconnect();
    r.ctx?.close().catch(() => {});
    clearInterval(r.timer);
    refs.current = { ws: r.ws, startedAt: r.startedAt };
  };

  const start = useCallback(async () => {
    setError('');
    setText('');
    setDurationMs(0);
    setStatus('connecting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      await ctx.audioWorklet.addModule('/pcm-worklet.js');
      const source = ctx.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(ctx, 'pcm-processor');
      source.connect(node);

      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/ws/transcribe`);
      ws.binaryType = 'arraybuffer';
      refs.current = { stream, ctx, source, node, ws };

      ws.onopen = () => ws.send(JSON.stringify({ type: 'start' }));
      ws.onmessage = (ev) => {
        const m = JSON.parse(ev.data);
        if (m.type === 'ready') {
          setMode(m.mode);
          setStatus('recording');
          refs.current.startedAt = Date.now();
          refs.current.timer = setInterval(
            () => setDurationMs(Date.now() - refs.current.startedAt),
            200
          );
          node.port.onmessage = (e) => ws.readyState === 1 && ws.send(e.data);
        } else if (m.type === 'delta') {
          setText((t) => t + m.text);
        } else if (m.type === 'error') {
          setError(m.message);
        } else if (m.type === 'done') {
          setStatus('idle');
          ws.close();
        }
      };
      ws.onerror = () => {
        setError('Could not reach the transcription server.');
        cleanupAudio();
        setStatus('idle');
      };
      ws.onclose = () => setStatus((s) => (s === 'stopping' || s === 'recording' ? 'idle' : s));
    } catch (e) {
      cleanupAudio();
      setError(
        e.name === 'NotAllowedError'
          ? 'Microphone permission was denied. Allow it in the browser address bar and try again.'
          : e.message
      );
      setStatus('idle');
    }
  }, []);

  const stop = useCallback(() => {
    const { ws, startedAt } = refs.current;
    if (startedAt) setDurationMs(Date.now() - startedAt);
    setStatus('stopping');
    cleanupAudio();
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'stop' }));
    // safety net in case the server never answers with "done"
    setTimeout(() => setStatus((s) => (s === 'stopping' ? 'idle' : s)), 4000);
  }, []);

  return { status, text, setText, error, mode, durationMs, start, stop };
}
