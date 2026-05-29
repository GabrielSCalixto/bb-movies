require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TMDB_KEY = process.env.TMDB_API_KEY;
const BASE = 'https://api.themoviedb.org/3';

const OSCAR_TERMS = ['oscar', 'academy award'];

function isOscarWinner(keywords) {
  return keywords.some(k =>
    OSCAR_TERMS.some(term => k.name.toLowerCase().includes(term))
  );
}

async function main() {
  const { data: movies } = await supabase
    .from('movies')
    .select('id, title, tmdb_id')
    .not('tmdb_id', 'is', null);

  console.log(`\n🔍 Verificando ${movies.length} filmes...\n`);

  let marked = 0;

  for (const movie of movies) {
    try {
      const { data } = await axios.get(`${BASE}/movie/${movie.tmdb_id}/keywords`, {
        params: { api_key: TMDB_KEY },
      });

      const keywords = data.keywords || [];

      if (isOscarWinner(keywords)) {
        await supabase.from('movies').update({ won_oscar: true }).eq('id', movie.id);
        console.log(`  🏆 ${movie.title}`);
        marked++;
      }

      await new Promise(r => setTimeout(r, 150));
    } catch (e) {
      console.log(`  ✗ Erro em "${movie.title}": ${e.message}`);
    }
  }

  console.log(`\n✅ ${marked} filme(s) marcado(s) como vencedor(es) do Oscar.`);
}

main();
