import React, { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { useRecorder } from './useRecorder.js';

const fmtDur = (ms) => {
  const s = Math.round((ms || 0) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const fmtDate = (d) => new Date(d).toLocaleString();
const PAGE = 8;

function Recorder({ onSaved }) {
  const { status, text, setText, error, mode, durationMs, start, stop } = useRecorder();
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const recording = status === 'recording';
  const busy = status === 'connecting' || status === 'stopping';

  const save = async () => {
    setSaving(true);
    setMsg('');
    try {
      await api.create({ title: title.trim() || null, text, language: 'hi-en', duration_ms: durationMs });
      setText('');
      setTitle('');
      setMsg('Saved to history.');
      onSaved();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card">
      <h2>Live transcription</h2>
      <p className="muted">Speak in Hindi, English, or a mix of both. Words appear as you talk.</p>
      <div className="row">
        <button
          className={recording ? 'btn danger' : 'btn primary'}
          disabled={busy}
          onClick={recording ? stop : start}
        >
          {status === 'connecting' ? 'Connecting...' : status === 'stopping' ? 'Finishing...' : recording ? 'Stop' : 'Start recording'}
        </button>
        {recording && <span className="live"><i /> Recording {fmtDur(durationMs)}</span>}
        {mode === 'demo' && <span className="badge">Demo mode (no API key set)</span>}
      </div>
      {error && <div className="alert">{error}</div>}
      <input
        className="input"
        placeholder="Title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className="input transcript"
        placeholder="Your transcript shows up here. You can also edit it before saving."
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={7}
      />
      <div className="row">
        <button className="btn primary" disabled={!text.trim() || saving || recording} onClick={save}>
          {saving ? 'Saving...' : 'Save transcript'}
        </button>
        <button className="btn" disabled={!text || recording} onClick={() => setText('')}>Clear</button>
        {msg && <span className="muted">{msg}</span>}
      </div>
    </section>
  );
}

function Row({ item, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title || '');
  const [text, setText] = useState(item.text);
  const [err, setErr] = useState('');

  const saveEdit = async () => {
    try {
      await api.update(item.id, { title: title.trim() || null, text });
      setEditing(false);
      setErr('');
      onChanged();
    } catch (e) {
      setErr(e.message);
    }
  };
  const del = async () => {
    if (!window.confirm('Delete this transcript?')) return;
    await api.remove(item.id);
    onChanged();
  };

  return (
    <li className="item">
      {editing ? (
        <>
          <input className="input" value={title} placeholder="Title" onChange={(e) => setTitle(e.target.value)} />
          <textarea className="input" rows={4} value={text} onChange={(e) => setText(e.target.value)} />
          {err && <div className="alert">{err}</div>}
          <div className="row">
            <button className="btn primary" onClick={saveEdit} disabled={!text.trim()}>Save</button>
            <button className="btn" onClick={() => { setEditing(false); setTitle(item.title || ''); setText(item.text); }}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          <div className="item-head">
            <strong>{item.title || `Transcript #${item.id}`}</strong>
            <span className="muted">{fmtDate(item.created_at)} · {fmtDur(item.duration_ms)}</span>
          </div>
          <p className="item-text">{item.text}</p>
          <div className="row">
            <button className="btn" onClick={() => setEditing(true)}>Edit</button>
            <button className="btn danger-outline" onClick={del}>Delete</button>
          </div>
        </>
      )}
    </li>
  );
}

function History({ refreshKey, onChanged }) {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api.list({ search, limit: PAGE + 1, offset: page * PAGE });
      setItems(Array.isArray(rows) ? rows : rows.items || []);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => { setPage(0); }, [search]);

  const addManual = async () => {
    await api.create({ text: newText, language: 'manual' });
    setNewText('');
    setAdding(false);
    onChanged();
  };

  const visible = items.slice(0, PAGE);
  return (
    <section className="card">
      <div className="item-head">
        <h2>History</h2>
        <button className="btn" onClick={() => setAdding((a) => !a)}>{adding ? 'Close' : '+ New entry'}</button>
      </div>
      {adding && (
        <div className="add">
          <textarea className="input" rows={3} placeholder="Type or paste a transcript" value={newText} onChange={(e) => setNewText(e.target.value)} />
          <button className="btn primary" disabled={!newText.trim()} onClick={addManual}>Add</button>
        </div>
      )}
      <input className="input" placeholder="Search transcripts..." value={search} onChange={(e) => setSearch(e.target.value)} />
      {error && <div className="alert">{error}</div>}
      {loading && !visible.length ? <p className="muted">Loading...</p> : null}
      {!loading && !visible.length && !error ? <p className="muted">No transcripts yet. Record something above.</p> : null}
      <ul className="list">
        {visible.map((it) => <Row key={`${it.id}-${it.updated_at}`} item={it} onChanged={onChanged} />)}
      </ul>
      <div className="row">
        <button className="btn" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
        <span className="muted">Page {page + 1}</span>
        <button className="btn" disabled={items.length <= PAGE} onClick={() => setPage((p) => p + 1)}>Next</button>
      </div>
    </section>
  );
}

export default function App() {
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey((k) => k + 1);
  return (
    <main className="wrap">
      <header>
        <h1>Speech to Text</h1>
        <p className="muted">Real-time Hindi + English transcription with a saved history.</p>
      </header>
      <Recorder onSaved={bump} />
      <History refreshKey={refreshKey} onChanged={bump} />
    </main>
  );
}
