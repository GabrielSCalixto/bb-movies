const POSTER_BASE = 'https://image.tmdb.org/t/p/w342';
const BACKDROP_BASE = 'https://image.tmdb.org/t/p/w780';

const UI = {
  renderGrid(movies, container, statsEl) {
    container.innerHTML = '';
    if (statsEl) statsEl.textContent = `${movies.length} filme${movies.length !== 1 ? 's' : ''}`;

    if (!movies.length) {
      document.getElementById('empty').hidden = false;
      return;
    }
    document.getElementById('empty').hidden = true;
    movies.forEach(movie => container.appendChild(UI.buildCard(movie)));
  },

  buildCard(movie) {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = movie.id;

    const posterHTML = movie.poster_path
      ? `<img class="card-poster" src="${POSTER_BASE}${movie.poster_path}" alt="${movie.title}" loading="lazy" />`
      : `<div class="card-poster-placeholder">🎬</div>`;

    const tmdbBadge = movie.tmdb_rating
      ? `<span class="badge badge-imdb">★ ${movie.tmdb_rating.toFixed(1)}</span>` : '';
    const oscarBadge = movie.won_oscar ? `<span class="badge badge-oscar">🏆</span>` : '';
    const statusBadge = movie.status === 'watched'
      ? `<span class="badge badge-watched">Visto</span>`
      : `<span class="badge badge-want">Para ver</span>`;

    const gRating = movie.gabriel_rating
      ? `<span class="card-rating-mini">G ${'★'.repeat(movie.gabriel_rating)}<span>${'☆'.repeat(5 - movie.gabriel_rating)}</span></span>` : '';
    const bRating = movie.bianca_rating
      ? `<span class="card-rating-mini">B ${'★'.repeat(movie.bianca_rating)}<span>${'☆'.repeat(5 - movie.bianca_rating)}</span></span>` : '';

    card.innerHTML = `
      <div class="card-status">${statusBadge}</div>
      ${posterHTML}
      <div class="card-info">
        <div class="card-title">${movie.title}</div>
        <div class="card-meta">
          ${movie.year ? `<span>${movie.year}</span>` : ''}
          ${movie.runtime ? `<span>${movie.runtime}min</span>` : ''}
          ${tmdbBadge}${oscarBadge}
        </div>
        <div class="card-ratings">${gRating}${bRating}</div>
      </div>`;

    card.addEventListener('click', () => App.openDetail(movie.id));
    return card;
  },

  renderDetail(movie, container, titleEl) {
    titleEl.textContent = movie.title;

    const backdropHTML = movie.backdrop_path
      ? `<img class="detail-backdrop" src="${BACKDROP_BASE}${movie.backdrop_path}" alt="" />`
      : '';

    const posterHTML = movie.poster_path
      ? `<img class="detail-poster" src="${POSTER_BASE}${movie.poster_path}" alt="${movie.title}" />`
      : `<div class="detail-poster-placeholder">🎬</div>`;

    const genres = (movie.genres || []).map(g => `<span class="platform-tag">${g}</span>`).join('');
    const platforms = (movie.platforms || []).length
      ? `<div class="detail-platforms"><h4>Onde assistir</h4><div class="platform-tags">${movie.platforms.map(p => `<span class="platform-tag">${p}</span>`).join('')}</div></div>`
      : '';

    const tmdbBadge = movie.tmdb_rating
      ? `<span class="badge badge-imdb">TMDB ★ ${movie.tmdb_rating.toFixed(1)}</span>` : '';
    const oscarBadge = movie.won_oscar ? `<span class="badge badge-oscar">🏆 Oscar</span>` : '';

    const buildStars = (fieldKey, currentVal) =>
      [1,2,3,4,5].map(n =>
        `<span class="star ${currentVal >= n ? 'active' : ''}" data-field="${fieldKey}" data-val="${n}">★</span>`
      ).join('');

    const isWatched = movie.status === 'watched';
    const watchBtn = isWatched
      ? `<button class="btn btn-ghost btn-sm" id="detail-unwatch">↩ Não assistido</button>`
      : `<button class="btn btn-primary btn-sm" id="detail-watch">✓ Marcar como visto</button>`;

    container.innerHTML = `
      ${backdropHTML}
      <div class="detail-layout">
        ${posterHTML}
        <div class="detail-info">
          <h3>${movie.title}</h3>
          <div class="detail-sub">${[movie.original_title !== movie.title ? movie.original_title : '', movie.year, movie.runtime ? movie.runtime + ' min' : ''].filter(Boolean).join(' · ')}</div>
          <div class="detail-badges">${tmdbBadge}${oscarBadge}</div>
          ${genres ? `<div class="platform-tags" style="margin-bottom:12px">${genres}</div>` : ''}
          ${movie.overview ? `<p class="detail-overview">${movie.overview}</p>` : ''}
          ${platforms}

          <div class="ratings-section">
            <div class="rating-block">
              <div class="rating-block-label">⭐ Gabriel</div>
              <div class="rating-stars">${buildStars('gabriel_rating', movie.gabriel_rating)}</div>
            </div>
            <div class="rating-block">
              <div class="rating-block-label">⭐ Bianca</div>
              <div class="rating-stars">${buildStars('bianca_rating', movie.bianca_rating)}</div>
            </div>
          </div>

          <div class="detail-actions">
            ${watchBtn}
            <button class="btn btn-ghost btn-sm" id="detail-oscar">${movie.won_oscar ? '✗ Remover Oscar' : '🏆 Ganhou Oscar'}</button>
            <button class="btn btn-ghost btn-sm" style="color:#e63946" id="detail-delete">Remover</button>
          </div>
          <textarea class="notes-area" id="detail-notes" placeholder="Notas sobre o filme...">${movie.notes || ''}</textarea>
          <button class="btn btn-secondary btn-sm" id="detail-save-notes" style="margin-top:8px">Salvar notas</button>
        </div>
      </div>`;

    container.querySelectorAll('.star').forEach(star => {
      star.addEventListener('click', async () => {
        const field = star.dataset.field;
        const val = parseInt(star.dataset.val);
        await API.updateMovie(movie.id, { [field]: val });
        container.querySelectorAll(`.star[data-field="${field}"]`).forEach((s, i) => s.classList.toggle('active', i < val));
        App.reload();
      });
    });

    container.querySelector('#detail-watch')?.addEventListener('click', async () => {
      await API.updateMovie(movie.id, { status: 'watched' });
      App.closeModal('modal-detail');
      App.reload();
    });

    container.querySelector('#detail-unwatch')?.addEventListener('click', async () => {
      await API.updateMovie(movie.id, { status: 'want_to_watch', watched_at: null });
      App.closeModal('modal-detail');
      App.reload();
    });

    container.querySelector('#detail-oscar').addEventListener('click', async () => {
      await API.updateMovie(movie.id, { won_oscar: !movie.won_oscar });
      App.closeModal('modal-detail');
      App.reload();
    });

    container.querySelector('#detail-delete').addEventListener('click', async () => {
      if (!confirm(`Remover "${movie.title}"?`)) return;
      await API.deleteMovie(movie.id);
      App.closeModal('modal-detail');
      App.reload();
    });

    container.querySelector('#detail-save-notes').addEventListener('click', async () => {
      const notes = container.querySelector('#detail-notes').value;
      await API.updateMovie(movie.id, { notes });
      App.reload();
    });
  },

  renderSortear(movie, container) {
    const posterHTML = movie.poster_path
      ? `<img class="sortear-poster" src="${POSTER_BASE}${movie.poster_path}" alt="${movie.title}" />`
      : `<div class="sortear-poster-placeholder">🎬</div>`;

    const meta = [movie.year, movie.runtime ? movie.runtime + ' min' : '', movie.tmdb_rating ? '★ ' + movie.tmdb_rating.toFixed(1) : ''].filter(Boolean).join(' · ');

    container.innerHTML = `
      <div class="sortear-card">
        ${posterHTML}
        <div class="sortear-info">
          <h3>${movie.title}</h3>
          <p>${meta}</p>
          ${(movie.genres || []).length ? `<div class="platform-tags">${movie.genres.map(g => `<span class="platform-tag">${g}</span>`).join('')}</div>` : ''}
        </div>
      </div>
      <div class="sortear-actions">
        <button class="btn btn-primary" id="sortear-ver-detalhes">Ver detalhes</button>
        <button class="btn btn-secondary" id="sortear-outro">🎲 Outro</button>
      </div>`;

    container.querySelector('#sortear-ver-detalhes').addEventListener('click', () => {
      App.closeModal('modal-sortear');
      App.openDetail(movie.id);
    });

    container.querySelector('#sortear-outro').addEventListener('click', () => App.sortear());
  },

  renderTMDBResults(results, container) {
    container.innerHTML = '';
    if (!results.length) {
      container.innerHTML = '<p style="color:var(--text-muted);margin-top:12px">Nenhum resultado encontrado.</p>';
      return;
    }
    const list = document.createElement('div');
    list.className = 'tmdb-result-list';
    results.forEach(r => {
      const item = document.createElement('div');
      item.className = 'tmdb-result-item';
      const year = r.release_date ? r.release_date.slice(0, 4) : '';
      item.innerHTML = `
        ${r.poster_path
          ? `<img class="tmdb-result-poster" src="${POSTER_BASE}${r.poster_path}" alt="" />`
          : `<div class="tmdb-result-poster" style="background:var(--bg);display:flex;align-items:center;justify-content:center">🎬</div>`}
        <div class="tmdb-result-info">
          <div class="tmdb-result-title">${r.title}</div>
          ${year ? `<div class="tmdb-result-year">${year}</div>` : ''}
        </div>
        <div class="tmdb-result-actions">
          <button class="btn btn-primary btn-sm" data-action="watched">Visto</button>
          <button class="btn btn-secondary btn-sm" data-action="want">Para ver</button>
        </div>`;
      item.querySelector('[data-action="watched"]').addEventListener('click', () => App.addFromTMDB(r.id, 'watched'));
      item.querySelector('[data-action="want"]').addEventListener('click', () => App.addFromTMDB(r.id, 'want_to_watch'));
      list.appendChild(item);
    });
    container.appendChild(list);
  },

  spinner() {
    return '<div class="spinner"></div>';
  },
};
