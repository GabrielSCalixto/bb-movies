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

    const user = session?.user;
    const nickname = user?.user_metadata?.nickname;
    const email = user?.email || '';
    const isGabriel = email.toLowerCase().includes('gabriel') || email === 'souutmaster@gmail.com';
    const defaultName = isGabriel ? 'Gabriel' : 'Bianca';
    const name = nickname || defaultName;
    document.getElementById('user-greeting').textContent = `Olá, ${name} 👋`;

    this.bindTabs();
    this.bindFilters();
    this.bindAddModal();
    this.bindModalClose();
    this.bindUserMenu();
    document.getElementById('btn-sortear').addEventListener('click', () => this.sortear());
    document.getElementById('btn-sidebar-toggle').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('collapsed');
    });

    // Preenche apelido atual no modal de conta
    if (nickname) document.getElementById('account-nickname').value = nickname;

    await this.loadGenres();
    await this.reload();
  },

  bindUserMenu() {
    const btn = document.getElementById('btn-user-menu');
    const dropdown = document.getElementById('user-dropdown');

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.hidden = !dropdown.hidden;
    });

    document.addEventListener('click', () => { dropdown.hidden = true; });

    document.getElementById('dd-add').addEventListener('click', () => {
      dropdown.hidden = true;
      document.getElementById('modal-add').hidden = false;
      document.getElementById('tmdb-results').innerHTML = '';
      document.getElementById('tmdb-search-input').value = '';
      setTimeout(() => document.getElementById('tmdb-search-input').focus(), 50);
    });

    document.getElementById('dd-account').addEventListener('click', () => {
      dropdown.hidden = true;
      document.getElementById('modal-account').hidden = false;
    });

    document.getElementById('dd-logout').addEventListener('click', () => {
      dropdown.hidden = true;
      this.logout();
    });

    // Salvar apelido
    document.getElementById('btn-save-nickname').addEventListener('click', async () => {
      const nickname = document.getElementById('account-nickname').value.trim();
      const fb = document.getElementById('nickname-feedback');
      if (!nickname) { fb.textContent = 'Digite um apelido.'; fb.className = 'account-feedback err'; return; }
      try {
        await API.updateProfile({ nickname });
        document.getElementById('user-greeting').textContent = `Olá, ${nickname} 👋`;
        fb.textContent = 'Apelido salvo!';
        fb.className = 'account-feedback ok';
      } catch (e) {
        fb.textContent = 'Erro ao salvar.';
        fb.className = 'account-feedback err';
      }
    });

    // Mudar senha
    document.getElementById('btn-save-password').addEventListener('click', async () => {
      const pwd = document.getElementById('account-password').value;
      const pwd2 = document.getElementById('account-password-confirm').value;
      const fb = document.getElementById('password-feedback');
      if (!pwd || pwd.length < 6) { fb.textContent = 'Mínimo 6 caracteres.'; fb.className = 'account-feedback err'; return; }
      if (pwd !== pwd2) { fb.textContent = 'As senhas não coincidem.'; fb.className = 'account-feedback err'; return; }
      try {
        await API.updatePassword(pwd);
        fb.textContent = 'Senha alterada com sucesso!';
        fb.className = 'account-feedback ok';
        document.getElementById('account-password').value = '';
        document.getElementById('account-password-confirm').value = '';
      } catch (e) {
        fb.textContent = 'Erro ao alterar senha.';
        fb.className = 'account-feedback err';
      }
    });
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
