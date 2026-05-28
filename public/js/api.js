const API = {
  async getMovies(params = {}) {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null)));
    const res = await fetch(`/api/movies?${qs}`);
    return res.json();
  },

  async getMovie(id) {
    const res = await fetch(`/api/movies/${id}`);
    return res.json();
  },

  async addMovie(data) {
    const res = await fetch('/api/movies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async updateMovie(id, data) {
    const res = await fetch(`/api/movies/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async deleteMovie(id) {
    const res = await fetch(`/api/movies/${id}`, { method: 'DELETE' });
    return res.json();
  },

  async getAllGenres() {
    const res = await fetch('/api/movies/genres/all');
    return res.json();
  },

  async searchTMDB(q) {
    const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(q)}`);
    return res.json();
  },

  async getTMDBMovie(id) {
    const res = await fetch(`/api/tmdb/movie/${id}`);
    return res.json();
  },
};
