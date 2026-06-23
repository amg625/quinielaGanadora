/* ===========================================================
   api.js — comunicación con el backend PHP
   =========================================================== */
const API = {
  base: 'api',

  async _req(url, method = 'GET', data = null) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
    };
    if (data) opts.body = JSON.stringify(data);
    let res;
    try {
      res = await fetch(`${this.base}/${url}`, opts);
    } catch (e) {
      throw new Error('No hay conexión con el servidor. Revisa tu internet.');
    }
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      // El servidor devolvió algo que no es JSON (error PHP, HTML, etc.)
      console.error('Respuesta no-JSON del backend:', text.slice(0, 500));
      throw new Error('Error del servidor: ' + (text.slice(0, 120) || 'respuesta vacía'));
    }
    if (!json.ok) throw new Error(json.error || 'Ocurrió un error.');
    return json;
  },

  /* ---- Auth ---- */
  login:      (usuario) => API._req('auth.php?action=login', 'POST', { usuario }),
  adminLogin: (usuario, password) => API._req('auth.php?action=admin_login', 'POST', { usuario, password }),
  logout:   () => API._req('auth.php?action=logout', 'POST'),
  me:       () => API._req('auth.php?action=me'),
  changePassword: (password) => API._req('auth.php?action=change_password', 'POST', { password }),

  /* ---- Partidos ---- */
  listMatches: () => API._req('matches.php?action=list'),
  savePrediction: (partido_id, goles_local, goles_visita, desenlace = null) =>
    API._req('matches.php?action=save_prediction', 'POST', { partido_id, goles_local, goles_visita, desenlace }),
  othersPredictions: (partido_id) => API._req(`matches.php?action=others&partido_id=${partido_id}`),

  /* ---- Ranking ---- */
  ranking: (etapa = 'todos') => API._req(`ranking.php?etapa=${etapa}`),
  resumenJugador: (usuario) => API._req(`resumen.php?usuario=${encodeURIComponent(usuario)}`),

  /* ---- Quiniela general ---- */
  generalGet:    () => API._req('general.php?action=get'),
  generalSave:   (opcion1, opcion2) => API._req('general.php?action=save', 'POST', { opcion1, opcion2 }),
  generalPaises: () => API._req('general.php?action=paises'),

  /* ---- Admin ---- */
  adminSetResult: (partido_id, goles_local, goles_visita, desenlace = null) =>
    API._req('admin.php?action=set_result', 'POST', { partido_id, goles_local, goles_visita, desenlace }),
  adminEditMatch: (data) => API._req('admin.php?action=edit_match', 'POST', data),
  adminSetElimTeams: (data) => API._req('admin.php?action=set_elim_teams', 'POST', data),
  adminSetChampion: (campeon) => API._req('admin.php?action=set_champion', 'POST', { campeon }),
  adminListUsers: () => API._req('admin.php?action=list_users'),
  adminMakeAdmin: (usuario_id, is_admin) => API._req('admin.php?action=make_admin', 'POST', { usuario_id, is_admin }),
};
