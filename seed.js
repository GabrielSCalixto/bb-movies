require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TMDB_KEY = process.env.TMDB_API_KEY;
const BASE = 'https://api.themoviedb.org/3';

const WANT_TO_WATCH = [
  'Meu eu do futuro', 'Oldboy', 'Bagagem de risco', 'Jurado número 2',
  'Anatomia de uma queda', 'Clube da luta', 'Sim senhor', 'A chegada',
  'Código de conduta', 'Até a última gota', 'Hitch', 'Segredo de sangue',
  'Fuja', 'Fica comigo', 'Vozes e vultos', 'Flight plan', 'O show da vida',
  'Um olhar do paraíso', 'Toc toc', 'A autópsia', 'Red rooms', 'Caddo lake',
  'Tempo de matar', 'Código preto', 'Vizinhos', 'Django', 'Um lugar silencioso',
  'Forrest gump', 'Até o último homem', 'Coach Carter', 'No limite do amanhã',
  'Distrito 9', 'Cemitério Maldito', 'Coringa', 'Para sempre Alice',
  'Um sonho possível', 'O protetor', 'A origem', 'Zodiac', 'Sem sentido',
  'Your name', 'Voz do silêncio', 'O tempo com você',
];

const WATCHED = [
  'Crepúsculo', 'Como se fosse a primeira vez', 'Um lugar chamado Notting Hill',
  'Nós', 'Pecadores', 'Questão de tempo', 'As branquelas', 'O poço', 'Parasita',
  'Eu sou a lenda', 'Click', 'Hancock', 'Guerra mundial Z', 'O diabo veste prada',
  'Esposa de mentirinha', 'O pequenino', 'Green book', 'Creed',
  'Atividade paranormal', 'Logan', 'Fratura', 'Suspeitos', 'Fragmentado',
  'Como perder um homem em 10 dias', 'Se beber não case', 'Sr e Sra Smith',
  'Juntos e misturados', 'Vidro', 'Capitão fantástico', 'Ilha do medo',
  'Tropa de elite', 'Coerência', 'Um senhor estagiário', 'Uma noite de crime',
  'Hereditário', 'Um príncipe em nova york', 'Sorria', 'Truque de mestre',
  'O lado bom da vida', 'Transformers', 'Ela dança eu danço',
  'A incrível história de Adaline', 'O limite da traição',
  'A gente precisa falar sobre Kevin', 'Aftersun', 'Todo poderoso', 'Avatar',
  'A empregada', 'Amores materialistas', 'Esqueceram de mim',
  'O advogado do diabo', 'Sobre meninos e lobos', 'Sem limites', 'Golpe duplo',
  'Seven', 'Little Nick', 'Planeta dos macacos', 'A hora do mal', 'King Richard',
  'Socorro', 'O contador', 'Duna', 'O paizão', 'Zohan', 'Pisque duas vezes',
  'Spotlight', 'A pior pessoa do mundo', 'Casa de cera', 'Speak no evil',
  'A vida secreta de walter mitty',
];

async function searchTMDB(title) {
  const { data } = await axios.get(`${BASE}/search/movie`, {
    params: { api_key: TMDB_KEY, query: title, language: 'pt-BR' },
  });
  return data.results[0] || null;
}

async function getDetails(tmdbId) {
  const [details] = await Promise.all([
    axios.get(`${BASE}/movie/${tmdbId}`, {
      params: { api_key: TMDB_KEY, language: 'pt-BR', append_to_response: 'external_ids,watch/providers' },
    }),
  ]);
  const d = details.data;
  const providers = d['watch/providers']?.results?.BR || {};
  const allProviders = [...(providers.flatrate || []), ...(providers.rent || []), ...(providers.buy || [])];
  const uniqueProviders = [...new Map(allProviders.map(p => [p.provider_id, p.provider_name])).values()];

  return {
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
  };
}

async function seedList(titles, status) {
  for (const title of titles) {
    try {
      const found = await searchTMDB(title);
      if (!found) { console.log(`  ✗ Não encontrado: ${title}`); continue; }
      const d = await getDetails(found.id);
      const { error } = await supabase.from('movies').upsert({ ...d, status }, { onConflict: 'tmdb_id' });
      if (error) throw error;
      console.log(`  ✓ ${d.title} (${d.year || '?'})`);
      await new Promise(r => setTimeout(r, 250));
    } catch (e) {
      console.log(`  ✗ Erro em "${title}": ${e.message}`);
    }
  }
}

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
    process.exit(1);
  }

  console.log('\n📋 Adicionando filmes "Para ver"...');
  await seedList(WANT_TO_WATCH, 'want_to_watch');

  console.log('\n✅ Adicionando filmes "Assistidos"...');
  await seedList(WATCHED, 'watched');

  console.log('\n🎬 Seed concluído!');
}

main();
