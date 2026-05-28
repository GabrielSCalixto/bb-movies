const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', (req, res) => {
  const { status, genre, min_imdb, max_imdb, won_oscar, platform, sort, search } = req.query;

  let query = 'SELECT * FROM movies WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  if (search) {
    query += ' AND (title LIKE ? OR original_title LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  if (min_imdb) {
    query += ' AND tmdb_rating >= ?';
    params.push(parseFloat(min_imdb));
  }

  if (max_imdb) {
    query += ' AND tmdb_rating <= ?';
    params.push(parseFloat(max_imdb));
  }

  if (won_oscar === 'true') {
    query += ' AND won_oscar = 1';
  }

  if (genre) {
    query += ' AND genres LIKE ?';
    params.push(`%${genre}%`);
  }

  if (platform) {
    query += ' AND platforms LIKE ?';
    params.push(`%${platform}%`);
  }

  const sortMap = {
    title: 'title ASC',
    year_desc: 'year DESC',
    year_asc: 'year ASC',
    imdb_desc: 'imdb_rating DESC',
    added: 'added_at DESC',
    rating_desc: 'personal_rating DESC',
  };
  query += ` ORDER BY ${sortMap[sort] || 'added_at DESC'}`;

  const movies = db.prepare(query).all(...params);
  const parsed = movies.map(m => ({
    ...m,
    genres: m.genres ? JSON.parse(m.genres) : [],
    platforms: m.platforms ? JSON.parse(m.platforms) : [],
    won_oscar: Boolean(m.won_oscar),
  }));

  res.json(parsed);
});

router.get('/genres/all', (req, res) => {
  const rows = db.prepare('SELECT genres FROM movies WHERE genres IS NOT NULL').all();
  const all = [...new Set(rows.flatMap(r => JSON.parse(r.genres)))].sort();
  res.json(all);
});

router.get('/:id', (req, res) => {
  const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(req.params.id);
  if (!movie) return res.status(404).json({ error: 'Filme não encontrado' });
  res.json({
    ...movie,
    genres: movie.genres ? JSON.parse(movie.genres) : [],
    platforms: movie.platforms ? JSON.parse(movie.platforms) : [],
    won_oscar: Boolean(movie.won_oscar),
  });
});

router.post('/', (req, res) => {
  const {
    tmdb_id, title, original_title, year, poster_path, backdrop_path,
    overview, runtime, imdb_id, imdb_rating, tmdb_rating, vote_count,
    genres, platforms, won_oscar, status, personal_rating, notes
  } = req.body;

  if (!title) return res.status(400).json({ error: 'Título obrigatório' });

  const existing = tmdb_id ? db.prepare('SELECT id FROM movies WHERE tmdb_id = ?').get(tmdb_id) : null;
  if (existing) return res.status(409).json({ error: 'Filme já adicionado', id: existing.id });

  const stmt = db.prepare(`
    INSERT INTO movies (
      tmdb_id, title, original_title, year, poster_path, backdrop_path,
      overview, runtime, imdb_id, imdb_rating, tmdb_rating, vote_count,
      genres, platforms, won_oscar, status, personal_rating, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    tmdb_id || null, title, original_title || null, year || null,
    poster_path || null, backdrop_path || null, overview || null,
    runtime || null, imdb_id || null, imdb_rating || null,
    tmdb_rating || null, vote_count || null,
    genres ? JSON.stringify(genres) : null,
    platforms ? JSON.stringify(platforms) : null,
    won_oscar ? 1 : 0,
    status || 'want_to_watch',
    personal_rating || null, notes || null
  );

  res.status(201).json({ id: result.lastInsertRowid });
});

router.patch('/:id', (req, res) => {
  const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(req.params.id);
  if (!movie) return res.status(404).json({ error: 'Filme não encontrado' });

  const allowed = ['status', 'personal_rating', 'notes', 'won_oscar', 'watched_at'];
  const updates = {};

  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (req.body.status === 'watched' && !movie.watched_at) {
    updates.watched_at = new Date().toISOString();
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Nenhum campo válido para atualizar' });
  }

  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE movies SET ${setClauses} WHERE id = ?`).run(...Object.values(updates), req.params.id);

  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM movies WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Filme não encontrado' });
  res.json({ success: true });
});

module.exports = router;
