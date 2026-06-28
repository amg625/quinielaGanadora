/* ===========================================================
   app.js — lógica principal de la Quiniela Mundial 2026
   =========================================================== */

const State = {
  user: null,
  matches: [],
  groupFilter: 'todos',
  paises: [],
};

/* ===========================================================
   ARRANQUE
   =========================================================== */
document.addEventListener('DOMContentLoaded', init);

async function init() {
  try {
    const { user } = await API.me();
    if (user) { State.user = user; enterApp(); }
    else showAuth();
  } catch {
    showAuth();
  }
  bindAuth();
  bindNav();
}

/* ===========================================================
   AUTENTICACIÓN
   =========================================================== */
function showAuth() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

function bindAuth() {
  // Login de jugador (solo nombre)
  document.getElementById('player-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const usuario = document.getElementById('player-name').value.trim();
    const errEl = document.getElementById('auth-error');
    const btn = document.getElementById('player-submit');
    errEl.textContent = '';
    btn.disabled = true; btn.textContent = 'Entrando…';
    try {
      const { user } = await API.login(usuario);
      State.user = user;
      enterApp();
    } catch (err) {
      errEl.textContent = err.message;
      if (err.message.includes('administrador')) toggleAdmin(true);
    } finally {
      btn.disabled = false; btn.textContent = 'Entrar a mi quiniela';
    }
  });

  // Mostrar/ocultar acceso admin
  document.getElementById('show-admin').addEventListener('click', () => toggleAdmin(true));
  document.getElementById('hide-admin').addEventListener('click', () => toggleAdmin(false));

  // Login de admin
  document.getElementById('admin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const usuario = document.getElementById('admin-user').value.trim();
    const pass = document.getElementById('admin-pass').value;
    const errEl = document.getElementById('admin-error');
    errEl.textContent = '';
    try {
      const { user } = await API.adminLogin(usuario, pass);
      State.user = user;
      enterApp();
    } catch (err) {
      errEl.textContent = err.message;
    }
  });
}

function toggleAdmin(show) {
  document.getElementById('player-form').classList.toggle('hidden', show);
  document.getElementById('show-admin').classList.toggle('hidden', show);
  document.getElementById('admin-form').classList.toggle('hidden', !show);
}

function enterApp() {
  try {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    const esAdmin = Number(State.user.is_admin) === 1;
    const juega = State.user.juega === undefined ? 1 : Number(State.user.juega);
    const noJuega = esAdmin && juega === 0;
    document.getElementById('welcome').textContent =
      `Hola, ${State.user.usuario}${esAdmin ? ' · Admin 🔐' : ''}`;
    document.querySelectorAll('.admin-only')
      .forEach(el => el.classList.toggle('hidden', !esAdmin));
    document.querySelectorAll('[data-view="general"]')
      .forEach(el => el.classList.toggle('hidden', noJuega));
    renderReglas();
    switchView(esAdmin ? 'admin' : 'partidos');
  } catch (err) {
    UI.toast('Error al cargar la app: ' + err.message, 'err');
    console.error('enterApp error:', err);
  }
}

document.getElementById('btn-logout').addEventListener('click', async () => {
  await API.logout();
  State.user = null;
  location.reload();
});

/* ===========================================================
   NAVEGACIÓN
   =========================================================== */
function bindNav() {
  document.querySelectorAll('.nav-btn').forEach(btn =>
    btn.addEventListener('click', () => switchView(btn.dataset.view)));
}

function switchView(view) {
  document.querySelectorAll('.nav-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.view === view));
  document.querySelectorAll('.view').forEach(v =>
    v.classList.toggle('active', v.id === `view-${view}`));

  if (view === 'partidos') { State.autoScroll = true; loadMatches(); }
  if (view === 'general') loadGeneral();
  if (view === 'ranking') loadRanking('todos');
  if (view === 'admin') loadAdmin('resultados');
}

/* ===========================================================
   PARTIDOS
   =========================================================== */
async function loadMatches() {
  const list = document.getElementById('matches-list');
  UI.loading(list);
  try {
    const { partidos } = await API.listMatches();
    State.matches = partidos;
    renderGroupFilters();
    renderMatches();
  } catch (err) {
    list.innerHTML = `<div class="empty">No se pudieron cargar los partidos.<br>${UI.escape(err.message)}</div>`;
  }
}

function renderGroupFilters() {
  const cont = document.getElementById('group-filters');
  const grupos = [...new Set(State.matches.filter(m => m.grupo).map(m => m.grupo))].sort();

  // Orden oficial de las rondas de eliminatorias
  const ordenRondas = ['Dieciseisavos de final', 'Octavos de final', 'Cuartos de final', 'Semifinal', 'Tercer lugar', 'Final'];
  const etiquetas = {
    'Dieciseisavos de final': '🏆 16vos',
    'Octavos de final': '🏆 8vos',
    'Cuartos de final': '🏆 4tos',
    'Semifinal': '🏆 Semis',
    'Tercer lugar': '🥉 3er lugar',
    'Final': '🏆 Final',
  };
  // Una ronda aparece solo si tiene al menos un partido YA definido (no 'pendiente')
  const rondasActivas = ordenRondas.filter(r =>
    State.matches.some(m => m.etapa === 'eliminatorias' && m.ronda === r && m.estado !== 'pendiente'));

  // Construir chips: Todos · [rondas de elim, la más avanzada primero] · Grupos A-L
  // .reverse() pone la fase más nueva (ej. 8vos) a la izquierda de la anterior (16vos).
  const chips = [['todos', 'Todos']];
  rondasActivas.slice().reverse().forEach(r => chips.push([`r:${r}`, etiquetas[r] || r]));
  grupos.forEach(g => chips.push([`g:${g}`, `Grupo ${g}`]));

  cont.innerHTML = chips.map(([val, label]) =>
    `<button class="filter-chip ${State.groupFilter === val ? 'active' : ''}" data-g="${val}">${label}</button>`
  ).join('');
  cont.querySelectorAll('.filter-chip').forEach(chip =>
    chip.addEventListener('click', () => {
      State.groupFilter = chip.dataset.g;
      renderGroupFilters();
      renderMatches();
    }));
}

function renderMatches() {
  const list = document.getElementById('matches-list');
  let items = State.matches;
  const f = State.groupFilter;
  if (f === 'todos') {
    // todos
  } else if (f.startsWith('g:')) {
    items = items.filter(m => m.grupo === f.slice(2));
  } else if (f.startsWith('r:')) {
    items = items.filter(m => m.etapa === 'eliminatorias' && m.ronda === f.slice(2));
  } else if (f === 'eliminatorias') {
    items = items.filter(m => m.etapa === 'eliminatorias');
  } else {
    items = items.filter(m => m.grupo === f); // compat con valores viejos
  }

  if (!items.length) { list.innerHTML = `<div class="empty">No hay partidos en este filtro.</div>`; return; }

  // Identificar el último partido jugado (finalizado más reciente por fecha)
  let ancla = null;
  items.forEach(m => {
    if (m.estado === 'finalizado') {
      if (!ancla || m.fecha_cdmx > ancla.fecha_cdmx) ancla = m;
    }
  });

  list.innerHTML = items.map((m, i) => matchCard(m, i, ancla && m.id === ancla.id)).join('');
  bindMatchEvents();

  // Scroll suave hasta el último partido jugado (solo la 1ª vez por carga)
  if (ancla && State.autoScroll !== false) {
    const el = document.getElementById('ancla-partido');
    if (el) {
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 350);
    }
  }
}

function matchCard(m, idx, esAncla = false) {
  const esElim = m.etapa === 'eliminatorias';
  const finalizado = m.estado === 'finalizado';
  const pendiente = esElim && m.estado === 'pendiente';
  const pred = m.mi_pred;

  // Estado visual
  let dot, estadoTxt;
  if (finalizado) { dot = 'done'; estadoTxt = 'Finalizado'; }
  else if (m.bloqueado) { dot = 'locked'; estadoTxt = 'Cerrado'; }
  else { dot = 'open'; estadoTxt = 'Abierto'; }

  const tag = esElim
    ? `<span class="match-tag elim">${UI.escape(m.ronda)}</span>`
    : `<span class="match-tag">Grupo ${m.grupo}</span>`;

  // Cuerpo
  let foot = '';
  if (pendiente) {
    foot = `<div class="match-foot"><div class="pending-note">⏳ Cruce por definir. Se abrirá cuando terminen los grupos.</div></div>`;
  } else if (finalizado) {
    let badge = '';
    if (pred) {
      const cls = pred.puntos > 0 ? '' : 'zero';
      badge = `<div class="my-pred">Tu pronóstico: ${pred.goles_local}–${pred.goles_visita}
        <span class="pts-badge ${cls}">${pred.puntos > 0 ? '+' + pred.puntos : '0'} pts</span></div>`;
    } else {
      badge = `<div class="my-pred" style="color:var(--text-dim)">No pronosticaste este partido</div>`;
    }
    foot = `<div class="match-foot">${badge}
      <div class="match-actions"><button class="btn-see" data-others="${m.id}">👁 Ver pronósticos de todos</button></div></div>`;
  } else if (m.bloqueado) {
    const myTxt = pred
      ? `<div class="my-pred">Tu pronóstico: ${pred.goles_local}–${pred.goles_visita}</div>`
      : `<div class="my-pred" style="color:var(--danger)">⚠ No alcanzaste a pronosticar</div>`;
    foot = `<div class="match-foot">
      ${myTxt}
      <div class="locked-note">🔒 Partido por iniciar — apuestas cerradas.</div>
      ${pred ? `<div class="match-actions"><button class="btn-see" data-others="${m.id}">👁 Ver pronósticos de todos</button></div>` : ''}
    </div>`;
  } else {
    // Abierto: inputs de marcador (+ quién clasifica y cómo termina si es eliminatoria)
    const lv = pred ? pred.goles_local : '';
    const vv = pred ? pred.goles_visita : '';
    const restante = UI.tiempoRestante(m.fecha_cdmx);
    const dsel = pred && pred.desenlace ? pred.desenlace : '';
    const csel = pred && pred.clasifica ? pred.clasifica : '';
    const elimUI = esElim ? `
      <div class="elim-box">
        <span class="elim-label">✅ ¿Quién clasifica?</span>
        <div class="clasifica-opts">
          <button type="button" class="clas-opt ${csel===m.local?'active':''}" data-clas="${UI.escape(m.local)}" data-mid="${m.id}">
            ${UI.flag(m.local_flag,true)} ${UI.escape(m.local)} ${csel===m.local?'✓':''}</button>
          <button type="button" class="clas-opt ${csel===m.visita?'active':''}" data-clas="${UI.escape(m.visita)}" data-mid="${m.id}">
            ${UI.flag(m.visita_flag,true)} ${UI.escape(m.visita)} ${csel===m.visita?'✓':''}</button>
        </div>
      </div>
      <div class="elim-box">
        <span class="elim-label">⏱ ¿Cómo termina?</span>
        <div class="desenlace-opts">
          <button type="button" class="des-opt ${dsel==='regular'?'active':''}" data-des="regular" data-mid="${m.id}">90 min</button>
          <button type="button" class="des-opt ${dsel==='prorroga'?'active':''}" data-des="prorroga" data-mid="${m.id}">Prórroga</button>
          <button type="button" class="des-opt ${dsel==='penales'?'active':''}" data-des="penales" data-mid="${m.id}">Penales</button>
        </div>
      </div>` : '';
    foot = `<div class="match-foot">
      <div class="score-inputs">
        <input type="number" min="0" max="99" class="score-in" data-side="l" data-mid="${m.id}" value="${lv}" placeholder="-">
        <span class="score-sep">:</span>
        <input type="number" min="0" max="99" class="score-in" data-side="v" data-mid="${m.id}" value="${vv}" placeholder="-">
      </div>
      ${elimUI}
      ${restante ? `<div class="my-pred" style="color:var(--text-dim);font-weight:500">${restante}</div>` : ''}
      <div class="match-actions">
        <button class="btn-primary" data-save="${m.id}">${pred ? 'Actualizar' : 'Guardar'} marcador</button>
        <button class="btn-see" data-others="${m.id}">👁 Ver</button>
      </div>
    </div>`;
  }

  // Cabecera de marcador final (+ desenlace si lo hubo)
  const desenInfo = (finalizado && m.desenlace && m.desenlace !== 'regular')
    ? `<div class="final-label" style="color:var(--text-dim)">Definido en ${UI.desenlaceLabel(m.desenlace)}</div>` : '';
  const centerScore = finalizado
    ? `<div class="final-score"><div class="big">${m.goles_local} - ${m.goles_visita}</div><div class="final-label">Resultado final</div>${desenInfo}</div>`
    : `<div class="vs">VS</div>`;

  return `
  <div class="match-card${esAncla ? ' es-ancla' : ''}"${esAncla ? ' id="ancla-partido"' : ''} style="animation-delay:${idx * 35}ms">
    <div class="match-top">
      ${tag}
      <span class="match-when">${UI.fmtFecha(m.fecha_cdmx)}</span>
      <span class="match-state"><span class="dot ${dot}"></span>${estadoTxt}</span>
    </div>
    ${esElim ? '' : `<div class="match-venue">📍 <b>${UI.escape(m.estadio)}</b> · ${UI.escape(m.ciudad)}, ${UI.escape(m.pais)}</div>`}
    <div class="match-body">
      <div class="match-teams">
        <div class="team"><span class="flag">${UI.flag(m.local_flag)}</span><span class="tname">${UI.escape(m.local)}</span></div>
        ${centerScore}
        <div class="team"><span class="flag">${UI.flag(m.visita_flag)}</span><span class="tname">${UI.escape(m.visita)}</span></div>
      </div>
    </div>
    ${foot}
  </div>`;
}

function bindMatchEvents() {
  // Selección de desenlace (90 min / prórroga / penales)
  const desenSel = {}; // mid -> desenlace
  document.querySelectorAll('.des-opt').forEach(btn =>
    btn.addEventListener('click', () => {
      const mid = btn.dataset.mid;
      document.querySelectorAll(`.des-opt[data-mid="${mid}"]`).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      desenSel[mid] = btn.dataset.des;
    }));
  document.querySelectorAll('.des-opt.active').forEach(b => { desenSel[b.dataset.mid] = b.dataset.des; });

  // Selección de quién clasifica
  const clasSel = {}; // mid -> equipo
  document.querySelectorAll('.clas-opt').forEach(btn =>
    btn.addEventListener('click', () => {
      const mid = btn.dataset.mid;
      document.querySelectorAll(`.clas-opt[data-mid="${mid}"]`).forEach(b => {
        b.classList.remove('active');
        b.innerHTML = b.innerHTML.replace(' ✓', '');
      });
      btn.classList.add('active');
      if (!btn.innerHTML.includes('✓')) btn.innerHTML += ' ✓';
      clasSel[mid] = btn.dataset.clas;
    }));
  document.querySelectorAll('.clas-opt.active').forEach(b => { clasSel[b.dataset.mid] = b.dataset.clas; });

  // Guardar pronóstico
  document.querySelectorAll('[data-save]').forEach(btn =>
    btn.addEventListener('click', async () => {
      const mid = btn.dataset.save;
      const l = document.querySelector(`.score-in[data-side="l"][data-mid="${mid}"]`).value;
      const v = document.querySelector(`.score-in[data-side="v"][data-mid="${mid}"]`).value;
      if (l === '' || v === '') { UI.toast('Ingresa ambos marcadores ⚽', 'err'); return; }

      const m = State.matches.find(x => x.id == mid);
      let desenlace = desenSel[mid] || null;
      let clasifica = clasSel[mid] || null;
      // En eliminatorias: exigir quién clasifica y cómo termina
      if (m && m.etapa === 'eliminatorias') {
        if (!clasifica) { UI.toast('Elige qué equipo clasifica ✅', 'err'); return; }
        if (!desenlace) { UI.toast('Elige cómo termina: 90 min, prórroga o penales ⏱', 'err'); return; }
      }
      btn.disabled = true;
      const scrollY = window.scrollY;
      State.autoScroll = false;
      try {
        await API.savePrediction(Number(mid), Number(l), Number(v), desenlace, clasifica);
        UI.toast('¡Pronóstico guardado! 🎯', 'ok');
        await loadMatches();
        window.scrollTo({ top: scrollY });
      } catch (err) {
        UI.toast(err.message, 'err');
        btn.disabled = false;
      }
    }));

  // Ver pronósticos de otros
  document.querySelectorAll('[data-others]').forEach(btn =>
    btn.addEventListener('click', () => verOtros(btn.dataset.others)));
}

async function verOtros(mid) {
  const m = State.matches.find(x => x.id == mid);
  try {
    const resp = await API.othersPredictions(mid);
    const pronosticos = resp.pronosticos;
    const oculto = resp.oculto;

    let rows;
    if (oculto) {
      // Eliminatorias antes de empezar: solo "ya pronosticó", sin marcadores
      rows = pronosticos.map(p => `
        <div class="others-row">
          <span class="others-name">${p.usuario === State.user.usuario ? '⭐ ' : ''}${UI.escape(p.usuario)}</span>
          <span class="others-hidden">🔒 Ya puso su pronóstico</span>
        </div>`).join('');
    } else {
      rows = pronosticos.map(p => {
        const des = p.desenlace && p.desenlace !== 'regular' ? ` <small style="color:var(--text-dim)">(${UI.desenlaceLabel(p.desenlace)})</small>` : '';
        const clas = p.clasifica ? `<br><small style="color:var(--grass)">✅ pasa: ${UI.escape(p.clasifica)}</small>` : '';
        return `
        <div class="others-row">
          <span class="others-name">${p.usuario === State.user.usuario ? '⭐ ' : ''}${UI.escape(p.usuario)}</span>
          <span class="others-score">${p.goles_local} - ${p.goles_visita}${des}${clas}
            ${p.puntos > 0 ? `<span class="pts-badge">+${p.puntos}</span>` : ''}</span>
        </div>`;
      }).join('');
    }
    if (!rows) rows = `<p class="empty">Nadie ha pronosticado este partido aún.</p>`;

    const nota = oculto
      ? `<p style="color:var(--gold);font-size:12.5px;margin-bottom:14px">🔒 En eliminatorias los pronósticos de los demás se revelan cuando el partido empieza.</p>`
      : `<p style="color:var(--text-dim);font-size:13px;margin-bottom:14px">Pronósticos de todos los jugadores:</p>`;

    UI.openModal(`
      <h3>${UI.flag(m.local_flag)} ${UI.escape(m.local)} vs ${UI.escape(m.visita)} ${UI.flag(m.visita_flag)}</h3>
      ${nota}
      ${rows}`);
  } catch (err) {
    UI.toast(err.message, 'err');
  }
}

/* ===========================================================
   QUINIELA GENERAL
   =========================================================== */
async function loadGeneral() {
  const sel1 = document.getElementById('pais1');
  const sel2 = document.getElementById('pais2');
  const status = document.getElementById('general-status');
  const btn = document.getElementById('save-general');

  try {
    if (!State.paises.length) {
      const { paises } = await API.generalPaises();
      State.paises = paises;
    }
    const opts = '<option value="">— elige país —</option>' +
      State.paises.map(p => `<option value="${UI.escape(p.pais)}">${UI.escape(p.pais)}</option>`).join('');
    sel1.innerHTML = opts; sel2.innerHTML = opts;

    const { pick, cerrada } = await API.generalGet();
    if (pick) { sel1.value = pick.pais_opcion1 || ''; sel2.value = pick.pais_opcion2 || ''; }

    if (cerrada) {
      status.textContent = '🔒 La quiniela general ya cerró (el Mundial inició).';
      status.style.color = 'var(--gold)';
      sel1.disabled = sel2.disabled = btn.disabled = true;
    } else {
      status.textContent = pick ? '✅ Ya tienes tu campeón elegido. Puedes cambiarlo hasta que inicie el Mundial.' : '⚡ Aún no eliges. ¡Hazlo desde ahora!';
      status.style.color = pick ? 'var(--grass)' : 'var(--text-dim)';
      sel1.disabled = sel2.disabled = btn.disabled = false;
    }
  } catch (err) {
    status.textContent = err.message;
  }
}

document.getElementById('save-general').addEventListener('click', async () => {
  const o1 = document.getElementById('pais1').value;
  const o2 = document.getElementById('pais2').value;
  const msg = document.getElementById('general-msg');
  msg.className = 'inline-msg';
  try {
    await API.generalSave(o1, o2);
    msg.textContent = '¡Guardado! 🏆 Tu apuesta de campeón quedó registrada.';
    msg.classList.add('ok');
    UI.toast('Quiniela general guardada 🌎', 'ok');
  } catch (err) {
    msg.textContent = err.message;
    msg.classList.add('err');
  }
});

/* ===========================================================
   RANKING
   =========================================================== */
function bindRankTabs() {
  document.querySelectorAll('.rank-tab').forEach(tab =>
    tab.addEventListener('click', () => {
      document.querySelectorAll('.rank-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      loadRanking(tab.dataset.rank);
    }));
}
bindRankTabs();

async function loadRanking(etapa) {
  const list = document.getElementById('ranking-list');
  UI.loading(list);
  try {
    const { ranking } = await API.ranking(etapa);
    if (!ranking.length) { list.innerHTML = `<div class="empty">Aún no hay jugadores en el ranking.</div>`; return; }

    list.innerHTML = ranking.map((r, i) => {
      const pos = i + 1;
      const medal = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : pos;
      const topCls = pos <= 3 ? `top${pos}` : '';
      let meta = '';
      if (etapa === 'general') {
        meta = `🥇 ${UI.escape(r.pais_opcion1 || '—')} · 🥈 ${UI.escape(r.pais_opcion2 || '—')}`;
      } else {
        meta = `${r.jugados || 0} pronósticos`;
      }
      return `
      <div class="rank-row ${topCls} clickable" data-jugador="${UI.escape(r.usuario)}" style="animation-delay:${i * 30}ms">
        <div class="rank-pos">${medal}</div>
        <div>
          <div class="rank-name">${UI.escape(r.usuario)}${r.usuario === State.user.usuario ? ' <span style="color:var(--gold);font-size:12px">(tú)</span>' : ''}</div>
          <div class="rank-meta">${meta} · 👁 ver detalle</div>
        </div>
        <div class="rank-pts">${r.puntos}<small> pts</small></div>
      </div>`;
    }).join('');
    // Clic en jugador → abrir resumen
    list.querySelectorAll('[data-jugador]').forEach(row =>
      row.addEventListener('click', () => verResumenJugador(row.dataset.jugador)));
  } catch (err) {
    list.innerHTML = `<div class="empty">${UI.escape(err.message)}</div>`;
  }
}

/* Modal con el resumen de puntos de un jugador */
async function verResumenJugador(usuario) {
  UI.openModal(`<div class="loading"><div class="spinner"></div>Cargando resumen…</div>`);
  try {
    const r = await API.resumenJugador(usuario);
    const filas = r.partidos.map(p => `
      <div class="res-row">
        <div class="res-match">
          <span class="res-teams">${UI.escape(p.local)} <b>${p.pred_l}-${p.pred_v}</b> ${UI.escape(p.visita)}</span>
          <span class="res-fase">${UI.escape(p.fase)} · resultado ${p.real_l}-${p.real_v}${p.exacto ? ' · 🎯 exacto' : ''}</span>
        </div>
        <span class="res-pts">+${p.puntos}</span>
      </div>`).join('');

    const general = r.pts_general > 0
      ? `<div class="res-row">
          <div class="res-match">
            <span class="res-teams">🌎 Campeón: ${UI.escape(r.campeon_pick || '—')}</span>
            <span class="res-fase">Quiniela general</span>
          </div>
          <span class="res-pts">+${r.pts_general}</span>
        </div>` : '';

    UI.openModal(`
      <h3>📊 Resumen de ${UI.escape(r.usuario)}</h3>
      <div class="res-stats">
        <div class="res-stat"><span class="res-num">${r.total}</span><span class="res-lbl">Puntos totales</span></div>
        <div class="res-stat"><span class="res-num">${r.aciertos}</span><span class="res-lbl">Aciertos</span></div>
        <div class="res-stat"><span class="res-num">${r.exactos}</span><span class="res-lbl">Marcadores exactos</span></div>
      </div>
      <div class="res-list-title">Partidos donde sumó puntos:</div>
      <div class="res-list">${filas || '<p class="empty">Aún no ha sumado puntos.</p>'}${general}</div>
    `);
  } catch (err) {
    UI.openModal(`<h3>Resumen</h3><p class="empty">${UI.escape(err.message)}</p>`);
  }
}

/* ===========================================================
   REGLAS
   =========================================================== */
function renderReglas() {
  document.querySelector('.rules').innerHTML = `
    <div class="rule-card">
      <h3>🎯 ¿Cómo funciona?</h3>
      <p>Pronostica el <b>marcador</b> de cada partido antes de que inicie. Ganas puntos por atinarle al ganador (o empate) y puntos extra si clavas el marcador exacto. El que más puntos acumule, gana. Hay <b>dos quinielas</b>: la de partidos y la del país campeón.</p>
    </div>

    <div class="rule-card">
      <h3>⚽ Fase de Grupos — puntos</h3>
      <table class="pts-table">
        <tr><th>Acierto</th><th></th><th>Puntos</th></tr>
        <tr><td>Atinas al <b>resultado</b> (gana / empata / pierde)</td><td></td><td>3</td></tr>
        <tr><td>Atinas el <b>marcador exacto</b> (ya incluye los 3 anteriores)</td><td></td><td>5</td></tr>
      </table>
      <div class="ejemplos">
        <p class="ej-title">📌 Ejemplos (resultado real: <b>México 2–0 Corea</b>)</p>
        <ul>
          <li>Pronosticaste <b>2–0</b> → marcador exacto = <span class="pts-win">5 pts</span> 🎯</li>
          <li>Pronosticaste <b>3–1</b> → acertaste que ganaba México, no el marcador = <span class="pts-win">3 pts</span></li>
          <li>Pronosticaste <b>1–1</b> → empate, fallaste el resultado = <span class="pts-zero">0 pts</span></li>
        </ul>
      </div>
    </div>

    <div class="rule-card">
      <h3>🏆 Eliminatorias — puntos</h3>
      <p>Desde dieciseisavos respondes <b>tres cosas</b> por partido. Cada acierto vale 3 puntos (máximo 9):</p>
      <table class="pts-table">
        <tr><th>Pregunta</th><th></th><th>Puntos</th></tr>
        <tr><td>1️⃣ <b>Marcador a los 90'</b> (aquí sí puede haber empate)</td><td></td><td>3</td></tr>
        <tr><td>2️⃣ <b>Quién clasifica</b> (qué equipo avanza, sin empate)</td><td></td><td>3</td></tr>
        <tr><td>3️⃣ <b>Cómo termina</b> (90 min / prórroga / penales)</td><td></td><td>3</td></tr>
      </table>
      <div class="ejemplos">
        <p class="ej-title">📌 Ejemplo (real: <b>Brasil 1–1 Francia a los 90', clasifica Brasil por penales</b>)</p>
        <ul>
          <li>Pusiste <b>1–1</b>, clasifica <b>Brasil</b>, <b>penales</b> → 3+3+3 = <span class="pts-win">9 pts</span> 🔥</li>
          <li>Pusiste <b>1–1</b>, clasifica <b>Brasil</b>, <b>prórroga</b> → 3+3 = <span class="pts-win">6 pts</span></li>
          <li>Pusiste <b>2–0</b> Brasil, clasifica <b>Brasil</b>, <b>90 min</b> → solo quién clasifica = <span class="pts-win">3 pts</span></li>
          <li>Pusiste <b>0–2</b>, clasifica <b>Francia</b> → fallaste todo = <span class="pts-zero">0 pts</span></li>
        </ul>
      </div>
      <p style="margin-top:10px">🔒 <b>Importante:</b> en eliminatorias <b>no puedes ver el pronóstico de los demás</b> hasta que el partido empiece. Antes solo verás "ya puso su pronóstico" — así nadie se copia.</p>
    </div>

    <div class="rule-card">
      <h3>🌎 Quiniela General (campeón)</h3>
      <p>Desde el inicio eliges <b>dos países</b> que crees que serán campeones:</p>
      <table class="pts-table">
        <tr><th>Si el campeón estaba en…</th><th></th><th>Puntos</th></tr>
        <tr><td>🥇 Tu <b>opción 1</b></td><td></td><td>15</td></tr>
        <tr><td>🥈 Tu <b>opción 2</b></td><td></td><td>8</td></tr>
      </table>
      <div class="ejemplos">
        <p class="ej-title">📌 Ejemplo (campeón real: <b>Argentina</b>)</p>
        <ul>
          <li>Pusiste Argentina como opción 1 = <span class="pts-win">15 pts</span></li>
          <li>Pusiste Argentina como opción 2 = <span class="pts-win">8 pts</span></li>
        </ul>
      </div>
      <p style="margin-top:10px">⚖ <b>Desempate:</b> si tú pusiste un país como opción 1 y otro lo puso como opción 2, ganas más tú por arriesgarte con tu favorito.</p>
      <p>🔒 Editable hasta <b>1 día antes</b> de que inicien las eliminatorias (28 jun). Después se cierra.</p>
    </div>

    <div class="rule-card">
      <h3>🏆 Un solo premio (suma total)</h3>
      <p>Hay <b>un único ganador</b>: quien acumule <b>más puntos en total</b>, sumando todo a lo largo del Mundial:</p>
      <ul>
        <li>Puntos de la <b>fase de grupos</b> (72 partidos).</li>
        <li>Puntos de las <b>eliminatorias</b> (32 partidos, valen más).</li>
        <li>Puntos de la <b>quiniela del campeón</b>.</li>
      </ul>
      <p>El ranking principal muestra esa suma total. Las pestañas de "detalle" son solo para ver cómo se reparten los puntos, pero el premio se decide por el total. 🥇</p>
    </div>

    <div class="rule-card">
      <h3>🔒 Juego limpio</h3>
      <ul>
        <li>Cada partido se <b>cierra 1 hora antes</b> de iniciar. Después ya no puedes pronosticar ni cambiar.</li>
        <li>En <b>grupos</b>: ves los pronósticos de los demás después de guardar el tuyo.</li>
        <li>En <b>eliminatorias</b>: solo ves los de los demás cuando el partido ya empezó (antes nadie ve nada, para que no se copien).</li>
        <li>El administrador sube los resultados oficiales y los puntos se suman solos.</li>
        <li>Todos los horarios están en hora de <b>Ciudad de México (CDMX)</b>.</li>
      </ul>
    </div>

    <div class="rule-card">
      <h3>🎁 El premio</h3>
      <p>El campeón se lleva <b>una entrada al cine + golosinas a elección</b>. ¡A romperla! ⚽🍿</p>
    </div>`;
}

/* ===========================================================
   ADMIN
   =========================================================== */
function bindAdminTabs() {
  document.querySelectorAll('.admin-tab').forEach(tab =>
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      loadAdmin(tab.dataset.admin);
    }));
}
bindAdminTabs();

async function loadAdmin(section) {
  const cont = document.getElementById('admin-content');
  UI.loading(cont);
  if (!State.matches.length) {
    try { const { partidos } = await API.listMatches(); State.matches = partidos; } catch {}
  }

  if (section === 'resultados') adminResultados(cont);
  else if (section === 'eliminatorias') adminEliminatorias(cont);
  else if (section === 'campeon') adminCampeon(cont);
  else if (section === 'usuarios') adminUsuarios(cont);
}

/* --- Subir resultados --- */
function adminResultados(cont) {
  const grupos = [...new Set(State.matches.filter(m => m.grupo).map(m => m.grupo))].sort();
  const filtro = `<div class="admin-filter">
    <select id="admin-mfilter">
      <option value="todos">Todos los partidos</option>
      ${grupos.map(g => `<option value="g${g}">Grupo ${g}</option>`).join('')}
      <option value="elim">Eliminatorias</option>
    </select></div>`;

  const render = (f = 'todos') => {
    let items = State.matches.filter(m => !(m.etapa === 'eliminatorias' && m.estado === 'pendiente'));
    if (f.startsWith('g')) items = items.filter(m => m.grupo === f.slice(1));
    else if (f === 'elim') items = items.filter(m => m.etapa === 'eliminatorias');

    const rows = items.map(m => {
      const esElim = m.etapa === 'eliminatorias';
      const desUI = esElim ? `
        <select class="admin-input" id="r-c-${m.id}" style="width:auto;margin-right:6px">
          <option value="">¿Clasifica?</option>
          <option value="${UI.escape(m.local)}" ${m.clasifica===m.local?'selected':''}>${UI.escape(m.local)}</option>
          <option value="${UI.escape(m.visita)}" ${m.clasifica===m.visita?'selected':''}>${UI.escape(m.visita)}</option>
        </select>
        <select class="admin-input" id="r-d-${m.id}" style="width:auto;margin-right:6px">
          <option value="regular" ${m.desenlace==='regular'?'selected':''}>90 min</option>
          <option value="prorroga" ${m.desenlace==='prorroga'?'selected':''}>Prórroga</option>
          <option value="penales" ${m.desenlace==='penales'?'selected':''}>Penales</option>
        </select>` : '';
      return `
      <div class="admin-match">
        <div class="admin-match-info">
          <b>${UI.flag(m.local_flag,true)} ${UI.escape(m.local)} vs ${UI.escape(m.visita)} ${UI.flag(m.visita_flag,true)}</b>
          <small>${esElim ? m.ronda : 'Grupo ' + m.grupo} · ${UI.fmtFecha(m.fecha_cdmx)}${m.estado === 'finalizado' ? ' · ✅ Finalizado' : ''}</small>
        </div>
        <div class="admin-score">
          <input type="number" min="0" id="r-l-${m.id}" value="${m.goles_local ?? ''}" placeholder="-">
          <span>:</span>
          <input type="number" min="0" id="r-v-${m.id}" value="${m.goles_visita ?? ''}" placeholder="-">
          ${desUI}
          <button data-result="${m.id}">Guardar</button>
        </div>
      </div>`;
    }).join('');
    document.getElementById('admin-rows').innerHTML = rows || `<div class="empty">Sin partidos.</div>`;
    document.querySelectorAll('[data-result]').forEach(b =>
      b.addEventListener('click', async () => {
        const id = b.dataset.result;
        const l = document.getElementById(`r-l-${id}`).value;
        const v = document.getElementById(`r-v-${id}`).value;
        const dEl = document.getElementById(`r-d-${id}`);
        const cEl = document.getElementById(`r-c-${id}`);
        const des = dEl ? dEl.value : null;
        const clas = cEl ? cEl.value : null;
        if (l === '' || v === '') { UI.toast('Marcador incompleto', 'err'); return; }
        if (cEl && !clas) { UI.toast('Indica qué equipo clasificó', 'err'); return; }
        b.disabled = true;
        const scrollY = window.scrollY;
        try {
          const { msg } = await API.adminSetResult(Number(id), Number(l), Number(v), des, clas);
          UI.toast(msg, 'ok');
          const { partidos } = await API.listMatches(); State.matches = partidos;
          render(document.getElementById('admin-mfilter')?.value || 'todos');
          window.scrollTo({ top: scrollY });
        } catch (err) { UI.toast(err.message, 'err'); b.disabled = false; }
      }));
  };

  cont.innerHTML = filtro + `<div id="admin-rows"></div>`;
  render();
  document.getElementById('admin-mfilter').addEventListener('change', e => render(e.target.value));
}

/* --- Definir cruces de eliminatorias (escalable: dropdown de los 48 países) --- */
async function adminEliminatorias(cont) {
  // Cargar países (nombre + código ISO de bandera) una sola vez
  if (!State.paises.length) {
    try { const { paises } = await API.generalPaises(); State.paises = paises; } catch {}
  }
  const optsPaises = '<option value="">— equipo —</option>' +
    State.paises.map(p => `<option value="${UI.escape(p.pais)}" data-flag="${p.flag}">${UI.escape(p.pais)}</option>`).join('');

  const items = State.matches.filter(m => m.etapa === 'eliminatorias');
  const yaDef = (s) => !(/^[0-9]|Ganador|Perdedor/.test(s));

  cont.innerHTML = `<p style="color:var(--text-dim);font-size:13px;margin-bottom:14px">
    Elige los equipos reales de cada cruce desde la lista. Al guardar, el cruce se abre para pronósticos y la bandera se asigna sola. 💡 Repite esto al cerrar cada ronda.</p>` +
    items.map(m => `
    <div class="admin-match" style="grid-template-columns:1fr">
      <div class="admin-match-info"><b>${UI.escape(m.ronda)}</b>
        <small>${m.estado==='pendiente' ? `Cruce: ${UI.escape(m.local)} vs ${UI.escape(m.visita)}` : `${UI.flag(m.local_flag,true)} ${UI.escape(m.local)} vs ${UI.escape(m.visita)} ${UI.flag(m.visita_flag,true)}`} · ${m.estado}</small></div>
      <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;margin-top:8px">
        <select class="admin-input" id="el-${m.id}">${optsPaises}</select>
        <span style="color:var(--text-dim);font-weight:700">VS</span>
        <select class="admin-input" id="ev-${m.id}">${optsPaises}</select>
      </div>
      <button class="btn-primary" style="margin-top:10px;padding:9px" data-elim="${m.id}">Definir y abrir cruce</button>
    </div>`).join('');

  // Pre-seleccionar si ya están definidos
  items.forEach(m => {
    if (yaDef(m.local)) { const s = document.getElementById(`el-${m.id}`); if (s) s.value = m.local; }
    if (yaDef(m.visita)) { const s = document.getElementById(`ev-${m.id}`); if (s) s.value = m.visita; }
  });

  document.querySelectorAll('[data-elim]').forEach(b =>
    b.addEventListener('click', async () => {
      const id = b.dataset.elim;
      const selL = document.getElementById(`el-${id}`);
      const selV = document.getElementById(`ev-${id}`);
      const local = selL.value, visita = selV.value;
      if (!local || !visita) { UI.toast('Elige ambos equipos', 'err'); return; }
      if (local === visita) { UI.toast('No puede jugar contra sí mismo 😅', 'err'); return; }
      const data = {
        partido_id: Number(id),
        equipo_local: local,
        local_flag: selL.options[selL.selectedIndex].dataset.flag,
        equipo_visita: visita,
        visita_flag: selV.options[selV.selectedIndex].dataset.flag,
      };
      b.disabled = true;
      try {
        const { msg } = await API.adminSetElimTeams(data);
        UI.toast(msg, 'ok');
        const { partidos } = await API.listMatches(); State.matches = partidos;
      } catch (err) { UI.toast(err.message, 'err'); }
      finally { b.disabled = false; }
    }));
}

/* --- Definir campeón --- */
async function adminCampeon(cont) {
  if (!State.paises.length) {
    try { const { paises } = await API.generalPaises(); State.paises = paises; } catch {}
  }
  cont.innerHTML = `
    <p style="color:var(--text-dim);font-size:13px;margin-bottom:14px">
      Cuando termine la final, elige el país campeón. Se calcularán automáticamente los puntos de la Quiniela General.</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <select id="champion-sel" class="admin-input" style="max-width:280px">
        <option value="">— país campeón —</option>
        ${State.paises.map(p => `<option value="${UI.escape(p.pais)}">${UI.escape(p.pais)}</option>`).join('')}
      </select>
      <button class="btn-primary" id="set-champ">Coronar campeón 🏆</button>
    </div>`;
  document.getElementById('set-champ').addEventListener('click', async () => {
    const c = document.getElementById('champion-sel').value;
    if (!c) { UI.toast('Elige un país', 'err'); return; }
    try { const { msg } = await API.adminSetChampion(c); UI.toast(msg, 'ok'); }
    catch (err) { UI.toast(err.message, 'err'); }
  });
}

/* --- Usuarios --- */
async function adminUsuarios(cont) {
  try {
    const { users } = await API.adminListUsers();
    cont.innerHTML = users.map(u => `
      <div class="user-row">
        <div><b>${UI.escape(u.usuario)}</b>${u.is_admin == 1 ? '<span class="badge-admin">ADMIN</span>' : ''}</div>
        <button class="btn-ghost" data-uid="${u.id}" data-admin="${u.is_admin == 1 ? 0 : 1}">
          ${u.is_admin == 1 ? 'Quitar admin' : 'Hacer admin'}
        </button>
      </div>`).join('');
    cont.querySelectorAll('[data-uid]').forEach(b =>
      b.addEventListener('click', async () => {
        try {
          await API.adminMakeAdmin(Number(b.dataset.uid), Number(b.dataset.admin));
          UI.toast('Permisos actualizados ✅', 'ok');
          adminUsuarios(cont);
        } catch (err) { UI.toast(err.message, 'err'); }
      }));
  } catch (err) {
    cont.innerHTML = `<div class="empty">${UI.escape(err.message)}</div>`;
  }
}
