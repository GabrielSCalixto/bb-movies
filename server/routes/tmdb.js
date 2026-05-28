const express = require('express');
const router = express.Router();
const axios = require('axios');

const BASE = 'https://api.themoviedb.org/3';
const KEY = process.env.TMDB_API_KEY;
const LANG = 'pt-BR';

const tmdb = (path, params = {}) =>
  axios.get(`${BASE}${path}`, { params: { api_key: KEY, language: LANG, ...params } });

router.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Query obrigatória' });
  try {
    const { data } = await tmdb('/search/movie', { query: q });
    res.json(data.results.slice(0, 10));
  } catch (e) {
    res.status(500).json({ error: 'Erro ao buscar no TMDB' });
  }
});

router.get('/movie/:id', async (req, res) => {
  try {
    const [details, credits, releases] = await Promise.all([
      tmdb(`/movie/${req.params.id}`, { append_to_response: 'external_ids,watch/providers' }),
      tmdb(`/movie/${req.params.id}/credits`),
      tmdb(`/movie/${req.params.id}/release_dates`),
    ]);

    const d = details.data;
    const providers = d['watch/providers']?.results?.BR || {};

    const allProviders = [
      ...(providers.flatrate || []),
      ...(providers.rent || []),
      ...(providers.buy || []),
    ];
    const uniqueProviders = [...new Map(allProviders.map(p => [p.provider_id, p.provider_name])).values()];

    const director = credits.data.crew.find(c => c.job === 'Director')?.name || null;

    res.json({
      tmdb_id: d.id,
      title: d.title,
      original_title: d.original_title,
      year: d.release_date ? parseInt(d.release_date.split('-')[0]) : null,
      poster_path: d.poster_path,
      backdrop_path: d.backdrop_path,
      overview: d.overview,
      runtime: d.runtime,
      imdb_id: d.external_ids?.imdb_id || null,
      tmdb_rating: d.vote_average,
      vote_count: d.vote_count,
      genres: d.genres.map(g => g.name),
      platforms: uniqueProviders,
      director,
    });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao buscar detalhes no TMDB' });
  }
});

module.exports = router;
