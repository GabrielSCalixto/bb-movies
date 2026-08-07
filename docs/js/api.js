const { createClient } = supabase;
const db = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

const TMDB_BASE = 'https://api.themoviedb.org/3';
const OMDB_BASE = 'https://www.omdbapi.com/';
const OSCAR_CACHE_KEY = 'bb_oscar_cache_v1';

let _tmdbGenres = null;

function loadOscarCache() {
  try { return JSON.parse(localStorage.getItem(OSCAR_CACHE_KEY)) || {}; } catch { return {}; }
}
function saveOscarCache(cache) {
  try { localStorage.setItem(OSCAR_CACHE_KEY, JSON.stringify(cache)); } catch {}
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const API = {
  // Auth
  async signIn(email, password) {
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signOut() {
    await db.auth.signOut();
  },

  async getSession() {
    const { data } = await db.auth.getSession();
    return data.session;
  },

  async updateProfile(metadata) {
    const { error } = await db.auth.updateUser({ data: metadata });
    if (error) throw error;
  },

  async updatePassword(password) {
    const { error } = await db.auth.updateUser({ password });
    if (error) throw error;
  },

  // Movies
  async getMovies({ status, search, sort, genre, won_oscar, min_imdb } = {}) {
    let query = db.from('movies').select('*');

    if (status) query = query.eq('status', status);
    if (search) query = query.or(`title.ilike.%${search}%,original_title.ilike.%${search}%`);
    if (min_imdb) query = query.gte('tmdb_rating', parseFloat(min_imdb));
    if (won_oscar === 'true') query = query.eq('won_oscar', true);
    if (genre) query = query.filter('genres', 'cs', JSON.stringify([genre]));

    const sortMap = {
      title:        { column: 'title',           ascending: true  },
      year_desc:    { column: 'year',            ascending: false },
      year_asc:     { column: 'year',            ascending: true  },
      rating_desc:  { column: 'tmdb_rating',     ascending: false },
      added:        { column: 'added_at',        ascending: false },
      gabriel_desc: { column: 'gabriel_rating',  ascending: false },
      bianca_desc:  { column: 'bianca_rating',   ascending: false },
    };
    const s = sortMap[sort] || sortMap.added;
    query = query.order(s.column, { ascending: s.ascending });

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getMovie(id) {
    const { data, error } = await db.from('movies').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },

  async addMovie(movie) {
    if (movie.tmdb_id) {
      const { data: existing } = await db.from('movies').select('id').eq('tmdb_id', movie.tmdb_id).maybeSingle();
      if (existing) return { error: 'Filme já adicionado', id: existing.id };
    }
    const { data, error } = await db.from('movies').insert([movie]).select().single();
    if (error) throw error;
    return { id: data.id };
  },

  async updateMovie(id, updates) {
    if (updates.status === 'watched' && !updates.watched_at) {
      updates.watched_at = new Date().toISOString();
    }
    if (updates.status === 'want_to_watch') {
      updates.watched_at = null;
    }
    const { error } = await db.from('movies').update(updates).eq('id', id);
    if (error) throw error;
    return { success: true };
  },

  async deleteMovie(id) {
    const { error } = await db.from('movies').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  },

  async getAllGenres() {
    const { data } = await db.from('movies').select('genres');
    return [...new Set((data || []).flatMap(r => r.genres || []))].sort();
  },

  // TMDB (direto do browser)
  async searchTMDB(q) {
    const res = await fetch(`${TMDB_BASE}/search/movie?api_key=${CONFIG.TMDB_API_KEY}&language=pt-BR&query=${encodeURIComponent(q)}`);
    const data = await res.json();
    return (data.results || []).slice(0, 10);
  },

  async getTMDBMovie(id) {
    const details = await fetch(`${TMDB_BASE}/movie/${id}?api_key=${CONFIG.TMDB_API_KEY}&language=pt-BR&append_to_response=external_ids,watch/providers`).then(r => r.json());

    const providers = details['watch/providers']?.results?.BR || {};
    const allProviders = [...(providers.flatrate || []), ...(providers.rent || []), ...(providers.buy || [])];
    const uniqueProviders = [...new Map(allProviders.map(p => [p.provider_id, p.provider_name])).values()];

    return {
      tmdb_id: details.id,
      title: details.title,
      original_title: details.original_title,
      year: details.release_date ? parseInt(details.release_date.split('-')[0]) : null,
      poster_path: details.poster_path,
      backdrop_path: details.backdrop_path,
      overview: details.overview,
      runtime: details.runtime,
      imdb_id: details.external_ids?.imdb_id || null,
      tmdb_rating: details.vote_average,
      vote_count: details.vote_count,
      genres: details.genres.map(g => g.name),
      platforms: uniqueProviders,
    };
  },

  // Explorar / Recomendações
  async getTMDBGenres() {
    if (_tmdbGenres) return _tmdbGenres;
    const res = await fetch(`${TMDB_BASE}/genre/movie/list?api_key=${CONFIG.TMDB_API_KEY}&language=pt-BR`);
    const data = await res.json();
    _tmdbGenres = data.genres || [];
    return _tmdbGenres;
  },

  async getLibraryTmdbIds() {
    const { data } = await db.from('movies').select('tmdb_id').not('tmdb_id', 'is', null);
    return new Set((data || []).map(r => r.tmdb_id));
  },

  async getTopWatchedSeeds(limit = 6) {
    const { data } = await db.from('movies')
      .select('tmdb_id, gabriel_rating, bianca_rating')
      .eq('status', 'watched')
      .not('tmdb_id', 'is', null);

    const rated = (data || [])
      .map(m => {
        const ratings = [m.gabriel_rating, m.bianca_rating].filter(r => r != null);
        const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
        return { tmdb_id: m.tmdb_id, avg };
      })
      .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));

    return rated.slice(0, limit).map(m => m.tmdb_id);
  },

  async getRecommendations({ mode = 'personalized', genreId = '' } = {}) {
    const [libraryIds, genres] = await Promise.all([this.getLibraryTmdbIds(), this.getTMDBGenres()]);
    const genreMap = new Map(genres.map(g => [g.id, g.name]));

    const toCard = r => ({
      id: r.id,
      title: r.title,
      release_date: r.release_date,
      poster_path: r.poster_path,
      overview: r.overview,
      vote_average: r.vote_average,
      genre_ids: r.genre_ids || [],
      genreNames: (r.genre_ids || []).map(id => genreMap.get(id)).filter(Boolean),
    });

    let usedFallback = false;
    let candidates = [];

    if (mode === 'personalized') {
      const seeds = await this.getTopWatchedSeeds();
      if (!seeds.length) {
        usedFallback = true;
      } else {
        const seedResults = await Promise.all(seeds.map(id =>
          fetch(`${TMDB_BASE}/movie/${id}/recommendations?api_key=${CONFIG.TMDB_API_KEY}&language=pt-BR`)
            .then(r => r.json()).then(d => d.results || []).catch(() => [])
        ));
        const freq = new Map();
        seedResults.flat().forEach(r => {
          if (libraryIds.has(r.id)) return;
          const entry = freq.get(r.id);
          if (entry) entry.count++;
          else freq.set(r.id, { movie: r, count: 1 });
        });
        candidates = [...freq.values()]
          .sort((a, b) => b.count - a.count || b.movie.vote_average - a.movie.vote_average)
          .map(e => e.movie);
      }
    }

    if (mode === 'popular' || usedFallback) {
      const params = new URLSearchParams({
        api_key: CONFIG.TMDB_API_KEY,
        language: 'pt-BR',
        sort_by: 'popularity.desc',
        'vote_count.gte': '200',
      });
      if (genreId) params.set('with_genres', genreId);
      const res = await fetch(`${TMDB_BASE}/discover/movie?${params}`);
      const data = await res.json();
      candidates = (data.results || []).filter(r => !libraryIds.has(r.id));
    } else if (genreId) {
      candidates = candidates.filter(r => (r.genre_ids || []).includes(parseInt(genreId)));
    }

    return { movies: candidates.slice(0, 20).map(toCard), usedFallback };
  },

  async getOscarInfo(tmdbId) {
    const cache = loadOscarCache();
    if (cache[tmdbId]) return cache[tmdbId];

    let info = { won: false, nominated: false, imdb_id: null };
    try {
      const ext = await fetch(`${TMDB_BASE}/movie/${tmdbId}/external_ids?api_key=${CONFIG.TMDB_API_KEY}`).then(r => r.json());
      const imdbId = ext.imdb_id;
      if (imdbId && CONFIG.OMDB_API_KEY && CONFIG.OMDB_API_KEY !== 'YOUR_OMDB_API_KEY') {
        const omdb = await fetch(`${OMDB_BASE}?i=${imdbId}&apikey=${CONFIG.OMDB_API_KEY}`).then(r => r.json());
        const awards = omdb.Awards || '';
        const won = /won\s+\d+\s+oscars?/i.test(awards);
        const nominated = won || /nominated for\s+\d+\s+oscars?/i.test(awards);
        info = { won, nominated, imdb_id: imdbId };
      } else {
        info.imdb_id = imdbId || null;
      }
    } catch {}

    cache[tmdbId] = info;
    saveOscarCache(cache);
    return info;
  },

  async enrichWithOscar(movies) {
    const infos = await mapLimit(movies, 6, m => this.getOscarInfo(m.id));
    return movies.map((m, i) => ({ ...m, oscar_won: infos[i].won, oscar_nominated: infos[i].nominated, imdb_id: infos[i].imdb_id }));
  },
};
