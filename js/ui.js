/* ===========================================================
   ui.js — helpers de interfaz
   =========================================================== */
const UI = {

  toast(msg, type = '') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show ' + type;
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.className = 'toast ' + type, 3200);
  },

  openModal(html) {
    document.getElementById('modal-content').innerHTML = html;
    document.getElementById('modal').classList.remove('hidden');
  },
  closeModal() {
    document.getElementById('modal').classList.add('hidden');
  },

  loading(container) {
    container.innerHTML = `<div class="loading"><div class="spinner"></div>Cargando…</div>`;
  },

  /* Formatea "2026-06-12 11:00:00" → "vie 12 jun, 11:00 hrs CDMX" */
  fmtFecha(f) {
    const dias = ['dom','lun','mar','mié','jue','vie','sáb'];
    const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    // parse manual para evitar zona horaria del navegador
    const [fecha, hora] = f.split(' ');
    const [y, m, d] = fecha.split('-').map(Number);
    const [hh, mm] = hora.split(':');
    const dt = new Date(y, m - 1, d);
    return `${dias[dt.getDay()]} ${d} ${meses[m - 1]}, ${hh}:${mm} hrs CDMX`;
  },

  /* Cuenta regresiva hasta el bloqueo (30 min antes) */
  tiempoRestante(f) {
    const [fecha, hora] = f.split(' ');
    const [y, m, d] = fecha.split('-').map(Number);
    const [hh, mm] = hora.split(':').map(Number);
    const inicio = new Date(y, m - 1, d, hh, mm);
    const limite = inicio.getTime() - 30 * 60 * 1000;
    const diff = limite - Date.now();
    if (diff <= 0) return null;
    const dias = Math.floor(diff / 86400000);
    const horas = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (dias > 0) return `Cierra en ${dias}d ${horas}h`;
    if (horas > 0) return `Cierra en ${horas}h ${mins}m`;
    return `⏱ Cierra en ${mins} min`;
  },

  escape(s) {
    const div = document.createElement('div');
    div.textContent = s ?? '';
    return div.innerHTML;
  },

  /* Renderiza una bandera como imagen. code = ISO-2 (mx, br) o gb-eng/gb-sct */
  flag(code, small = false) {
    if (!code || code === 'tbd' || code === 'xx') {
      return `<span class="flag-tbd">🏳️</span>`;
    }
    // flagcdn usa códigos especiales para subdivisiones del Reino Unido
    const map = { 'gb-eng': 'gb-eng', 'gb-sct': 'gb-sct', 'gb-wls': 'gb-wls', 'gb-nir': 'gb-nir' };
    const c = map[code] || code;
    const cls = small ? 'flag-img small' : 'flag-img';
    return `<img class="${cls}" src="https://flagcdn.com/w80/${c}.png" alt="" loading="lazy" onerror="this.style.display='none'">`;
  },

  /* Etiqueta legible del desenlace */
  desenlaceLabel(d) {
    return { regular: '90 min', prorroga: 'Prórroga', penales: 'Penales' }[d] || '';
  },
};

/* Cerrar modal con botón / clic afuera / Esc */
document.getElementById('modal-close').addEventListener('click', () => UI.closeModal());
document.getElementById('modal').addEventListener('click', (e) => {
  if (e.target.id === 'modal') UI.closeModal();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') UI.closeModal(); });
