const App = {
  state: {
    status: 'want_to_watch',
    search: '',
    sort: 'added',
    genre: '',
    oscar: false,
    imdbMin: 0,
  },
  currentMovies: [],

  async init() {
    const session = await API.getSession();
    if (!session) {
      this.showLogin();
    } else {
      await this.startApp(session);
    }
  },

  showLogin() {
    document.getElementById('login-screen').hidden = false;
    document.getElementById('app').hidden = true;
    this.bindLogin();
  },

  async startApp(session) {
    document.getElementById('login-screen').hidden = true;
    document.getElementById('app').hidden = false;

    const email = session?.user?.email || '';
    const isGabriel = email.toLowerCase().includes('gabriel') || email === 'souutmaster@gmail.com';
    const name = isGabriel ? 'Gabriel' : 'Bianca';
    document.getElementById('user-greeting').textContent = `Olá, ${name} 👋`;

    this.bindTabs();
    this.bindFilters();
    this.bindAddModal();
    this.bindModalClose();
    document.getElementById('btn-logout').addEventListener('click', () => this.logout());
    document.getElementById('btn-sortear').addEventListener('click', () => this.sortear());
    await this.loadGenres();
    await this.reload();
  },

  bindLogin() {
    const doLogin = async () => {
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const errEl = document.getElementById('login-error');
      errEl.textContent = '';
      try {
        const { session } = await API.signIn(email, password);
        await this.startApp(session);
      } catch (e) {
        errEl.textContent = 'Email ou senha incorretos.';
      }
    };
    document.getElementById('btn-login').addEventListener('click', doLogin);
    document.getElementById('login-password').addEventListener('keydown', e => {
      if (e.key === 'Enter') doLogin();
    });
  },

  async logout() {
    if (!confirm('Deseja sair do B&B Movies?')) return;
    await API.signOut();
    document.getElementById('app').hidden = true;
    document.getElementById('login-screen').hidden = false;
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
  },

  bindTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.state.status = tab.dataset.status;
        this.reload();
      });
    });
  },

  bindFilters() {
    let debounce;
    document.getElementById('search').addEventListener('input', e => {
      clearTimeout(debounce);
      debounce = setTimeout(() => { this.state.search = e.target.value; this.reload(); }, 300);
    });
    document.getElementById('filter-sort').addEventListener('change', e => { this.state.sort = e.target.value; this.reload(); });
    document.getElementById('filter-genre').addEventListener('change', e => { this.state.genre = e.target.value; this.reload(); });
    document.getElementById('filter-oscar').addEventListener('change', e => { this.state.oscar = e.target.checked; this.reload(); });
    document.getElementById('filter-imdb-min').addEventListener('input', e => {
      this.state.imdbMin = parseFloat(e.target.value);
      document.getElementById('imdb-min-val').textContent = e.target.value;
      this.reload();
    });
  },

  bindAddModal() {
    document.getElementById('btn-add').addEventListener('click', () => {
      document.getElementById('modal-add').hidden = false;
      document.getElementById('tmdb-results').innerHTML = '';
      document.getElementById('tmdb-search-input').value = '';
      setTimeout(() => document.getElementById('tmdb-search-input').focus(), 50);
    });
    document.getElementById('btn-tmdb-search').addEventListener('click', () => this.doTMDBSearch());
    document.getElementById('tmdb-search-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') this.doTMDBSearch();
    });
  },

  bindModalClose() {
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => this.closeModal(btn.dataset.close));
    });
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => { if (e.target === overlay) overlay.hidden = true; });
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') document.querySelectorAll('.modal-overlay').forEach(o => o.hidden = true);
    });
  },

  closeModal(id) {
    document.getElementById(id).hidden = true;
  },

  async loadGenres() {
    const genres = await API.getAllGenres();
    const select = document.getElementById('filter-genre');
    const current = select.value;
    select.innerHTML = '<option value="">Todos os gêneros</option>' +
      genres.map(g => `<option value="${g}" ${g === current ? 'selected' : ''}>${g}</option>`).join('');
  },

  async reload() {
    const movies = await API.getMovies({
      status: this.state.status,
      search: this.state.search,
      sort: this.state.sort,
      genre: this.state.genre,
      won_oscar: this.state.oscar ? 'true' : '',
      min_imdb: this.state.imdbMin > 0 ? this.state.imdbMin : '',
    });
    this.currentMovies = movies;
    UI.renderGrid(movies, document.getElementById('movies-grid'), document.getElementById('stats'));
  },

  async openDetail(id) {
    const movie = await API.getMovie(id);
    UI.renderDetail(movie, document.getElementById('detail-body'), document.getElementById('detail-title'));
    document.getElementById('modal-detail').hidden = false;
  },

  sortear() {
    const lista = this.state.status === 'watched'
      ? this.currentMovies
      : this.currentMovies.filter(m => m.status === 'want_to_watch').length > 0
        ? this.currentMovies.filter(m => m.status === 'want_to_watch')
        : this.currentMovies;

    if (!lista.length) {
      alert('Nenhum filme disponível para sortear!');
      return;
    }

    const sorteado = lista[Math.floor(Math.random() * lista.length)];
    UI.renderSortear(sorteado, document.getElementById('sortear-body'));
    document.getElementById('modal-sortear').hidden = false;
  },

  async doTMDBSearch() {
    const q = document.getElementById('tmdb-search-input').value.trim();
    if (!q) return;
    const container = document.getElementById('tmdb-results');
    container.innerHTML = UI.spinner();
    const results = await API.searchTMDB(q);
    UI.renderTMDBResults(results, container);
  },

  async addFromTMDB(tmdbId, status) {
    const details = await API.getTMDBMovie(tmdbId);
    const result = await API.addMovie({ ...details, status });
    if (result.error) {
      alert('Esse filme já está na sua biblioteca!');
      return;
    }
    this.closeModal('modal-add');
    await this.loadGenres();
    this.reload();
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
