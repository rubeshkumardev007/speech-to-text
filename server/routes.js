const express = require('express');
const { pool } = require('./db');

const router = express.Router();

function clean(body = {}) {
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : '';
  const language = typeof body.language === 'string' && body.language.trim() ? body.language.trim().slice(0, 30) : 'auto';
  const duration = Number.isFinite(Number(body.duration_ms)) ? Math.max(0, Math.round(Number(body.duration_ms))) : 0;
  return { text, title, language, duration_ms: duration };
}

// READ (list + search + pagination)
router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const where = search ? 'WHERE text ILIKE $3 OR title ILIKE $3' : '';
    const params = search ? [limit, offset, `%${search}%`] : [limit, offset];
    const rows = await pool.query(
      `SELECT * FROM transcriptions ${where} ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2`,
      params
    );
    const count = await pool.query(
      `SELECT COUNT(*)::int AS total FROM transcriptions ${search ? 'WHERE text ILIKE $1 OR title ILIKE $1' : ''}`,
      search ? [`%${search}%`] : []
    );
    res.json({ items: rows.rows, total: count.rows[0].total, limit, offset });
  } catch (e) { next(e); }
});

// READ (one)
router.get('/:id(\\d+)', async (req, res, next) => {
  try {
    const r = await pool.query('SELECT * FROM transcriptions WHERE id = $1', [req.params.id]);
    if (!r.rowCount) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { next(e); }
});

// CREATE
router.post('/', async (req, res, next) => {
  try {
    const d = clean(req.body);
    if (!d.text) return res.status(400).json({ error: 'text is required' });
    const r = await pool.query(
      `INSERT INTO transcriptions (title, text, language, duration_ms) VALUES ($1,$2,$3,$4) RETURNING *`,
      [d.title, d.text, d.language, d.duration_ms]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { next(e); }
});

// UPDATE
router.put('/:id(\\d+)', async (req, res, next) => {
  try {
    const d = clean(req.body);
    if (!d.text) return res.status(400).json({ error: 'text is required' });
    const r = await pool.query(
      `UPDATE transcriptions SET title=$1, text=$2, language=$3, updated_at=now() WHERE id=$4 RETURNING *`,
      [d.title, d.text, d.language, req.params.id]
    );
    if (!r.rowCount) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { next(e); }
});

// DELETE
router.delete('/:id(\\d+)', async (req, res, next) => {
  try {
    const r = await pool.query('DELETE FROM transcriptions WHERE id = $1 RETURNING id', [req.params.id]);
    if (!r.rowCount) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

module.exports = router;
