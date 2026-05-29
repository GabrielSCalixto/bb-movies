const { createClient } = supabase;
const db = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

const TMDB_BASE = 'https://api.themoviedb.org/3';

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

  // Movies
  async getMovies({ status, search, sort, genre, won_oscar, min_imdb } = {}) {
    let query = db.from('movies').select('*');

    if (status) query = query.eq('status', status);
    if (search) query = query.or(`title.ilike.%${search}%,original_title.ilike.%${search}%`);
    if (min_imdb) query = query.gte('tmdb_rating', parseFloat(min_imdb));
    if (won_oscar === 'true') query = query.eq('won_oscar', true);
    if (genre) query = query.filter('genres', 'cs', JSON.stringify([genre]));

    const sortMap = {
      title:       { column: 'title',           ascending: true  },
      year_desc:   { column: 'year',            ascending: false },
      year_asc:    { column: 'year',            ascending: true  },
      imdb_desc:   { column: 'tmdb_rating',     ascending: false },
      added:       { column: 'added_at',        ascending: false },
      rating_desc: { column: 'personal_rating', ascending: false },
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
    const [details, credits] = await Promise.all([
      fetch(`${TMDB_BASE}/movie/${id}?api_key=${CONFIG.TMDB_API_KEY}&language=pt-BR&append_to_response=external_ids,watch/providers`).then(r => r.json()),
      fetch(`${TMDB_BASE}/movie/${id}/credits?api_key=${CONFIG.TMDB_API_KEY}&language=pt-BR`).then(r => r.json()),
    ]);

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
};
