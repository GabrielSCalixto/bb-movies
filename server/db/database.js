const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'movies.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS movies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tmdb_id INTEGER UNIQUE,
    title TEXT NOT NULL,
    original_title TEXT,
    year INTEGER,
    poster_path TEXT,
    backdrop_path TEXT,
    overview TEXT,
    runtime INTEGER,
    imdb_id TEXT,
    imdb_rating REAL,
    tmdb_rating REAL,
    vote_count INTEGER,
    genres TEXT,
    platforms TEXT,
    won_oscar INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'want_to_watch',
    personal_rating INTEGER,
    notes TEXT,
    added_at TEXT DEFAULT (datetime('now')),
    watched_at TEXT
  );
`);

module.exports = db;
