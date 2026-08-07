require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TMDB_KEY = process.env.TMDB_API_KEY;
const OMDB_KEY = process.env.OMDB_API_KEY;
const TMDB_BASE = 'https://api.themoviedb.org/3';
const OMDB_BASE = 'https://www.omdbapi.com/';

function parseAwards(awards) {
  const won = /won\s+\d+\s+oscars?/i.test(awards || '');
  const nominated = won || /nominated for\s+\d+\s+oscars?/i.test(awards || '');
  return { won, nominated };
}

async function main() {
  if (!OMDB_KEY) {
    console.log('✗ Falta OMDB_API_KEY no .env');
    process.exit(1);
  }

  const { data: movies, error } = await supabase
    .from('movies')
    .select('id, title, tmdb_id, imdb_id');
  if (error) throw error;

  console.log(`\n🔍 Verificando ${movies.length} filmes na OMDb...\n`);

  let won = 0, nominated = 0, errors = 0;

  for (const movie of movies) {
    try {
      let imdbId = movie.imdb_id;

      if (!imdbId && movie.tmdb_id) {
        const { data } = await axios.get(`${TMDB_BASE}/movie/${movie.tmdb_id}/external_ids`, {
          params: { api_key: TMDB_KEY },
        });
        imdbId = data.imdb_id;
        if (imdbId) await supabase.from('movies').update({ imdb_id: imdbId }).eq('id', movie.id);
      }

      if (!imdbId) {
        console.log(`  ⚠ Sem imdb_id: ${movie.title}`);
        continue;
      }

      const { data: omdb } = await axios.get(OMDB_BASE, { params: { i: imdbId, apikey: OMDB_KEY } });
      const { won: didWin, nominated: wasNominated } = parseAwards(omdb.Awards);

      await supabase.from('movies').update({ won_oscar: didWin, oscar_nominated: wasNominated }).eq('id', movie.id);

      if (didWin) { console.log(`  🏆 ${movie.title}`); won++; }
      else if (wasNominated) { console.log(`  🎗 ${movie.title}`); nominated++; }

      await new Promise(r => setTimeout(r, 150));
    } catch (e) {
      console.log(`  ✗ Erro em "${movie.title}": ${e.message}`);
      errors++;
    }
  }

  console.log(`\n✅ ${won} vencedor(es) do Oscar, ${nominated} indicado(s), ${errors} erro(s).`);
}

main();
