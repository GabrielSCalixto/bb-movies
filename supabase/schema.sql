-- Rodar no SQL Editor do Supabase (https://supabase.com/dashboard → SQL Editor)

CREATE TABLE IF NOT EXISTS movies (
  id            BIGSERIAL PRIMARY KEY,
  tmdb_id       INTEGER UNIQUE,
  title         TEXT NOT NULL,
  original_title TEXT,
  year          INTEGER,
  poster_path   TEXT,
  backdrop_path TEXT,
  overview      TEXT,
  runtime       INTEGER,
  imdb_id       TEXT,
  tmdb_rating   REAL,
  vote_count    INTEGER,
  genres        JSONB DEFAULT '[]'::jsonb,
  platforms     JSONB DEFAULT '[]'::jsonb,
  won_oscar     BOOLEAN DEFAULT FALSE,
  status        TEXT NOT NULL DEFAULT 'want_to_watch',
  personal_rating INTEGER,
  notes         TEXT,
  added_at      TIMESTAMPTZ DEFAULT NOW(),
  watched_at    TIMESTAMPTZ
);

-- Habilita segurança por linha
ALTER TABLE movies ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode ler e escrever
CREATE POLICY "Authenticated full access" ON movies
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
