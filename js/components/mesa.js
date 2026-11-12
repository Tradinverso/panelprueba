// Columna "Hoy" (antes "Mesa"; el código conserva ese nombre): columna
// izquierda sticky (260 px) con lo que hay que tener a mano mientras se opera.
// Cada cosa en su propia caja: checklist · noticias de alto impacto · próximos
// directos · cuentas activas · regla del día · Formación.
// Se recoge en una barrita de 58 px con indicadores (mini-pastilla por cuenta,
// anillo del checklist, directo en curso, hora de la próxima noticia).
// El estado abierto/recogido se guarda en las preferencias (appearance.mesa).
// Sustituye a la barra lateral de navegación: la navegación va arriba (topbar.js).

import { state } from '../state.js';
import { auth } from '../auth.js';
import { appearance } from '../appearance.js';
import { accountStats, fmtUsd } from '../utils/account-stats.js';
import { reglaDelDia } from '../utils/reglas-del-dia.js';
import { checklistProgress } from '../utils/checklist-items.js';
import { todayLocal } from '../utils/timezone.js';
import { openChecklistModal } from './checklist-modal.js';
import { clockParts } from './topbar.js';
import { icon } from './icons.js';
import { getHoyData, onHoyData, noticiasDeHoy, noticiasDeLaSemana, proximosDirectos, horaEn, diaCortoEn } from '../utils/hoy-data.js';
import { tituloEs } from '../utils/noticias-es.js';
import { openDiarioModal } from './diario-modal.js';
import { hoy as hoyDiario, estadoDia, tradesDe, leccionDeHoy } from '../utils/diario.js';

const FORMACION_URL = 'https://tradinverso.thinkific.com/enrollments';
// Calendario económico completo (la lista de la caja sale de Forex Factory).
const INVESTING_URL = 'https://es.investing.com/economic-calendar';
// Canal de la comunidad en Discord (dirección directa, NO una invitación:
// solo abre a quien ya es miembro del servidor).
const DISCORD_URL = 'https://discord.com/channels/1306561566958817280/1426808153839767553';

const SHEET_SHORT = { ZONAS: 'Zonas', LIQUIDEZ: 'Liquidez', NASDAQ: 'Nasdaq' };

let unsubAuth = null;
let unsubState = null;
let unsubHoy = null;
let newsScope = 'hoy';   // 'hoy' | 'semana' (conmutador de la caja de noticias)

// La columna depende de la hora (directo en curso, noticia ya pasada): se
// repinta sola cada minuto mientras esté montada y no haya nada abierto encima.
setInterval(() => {
  const el = document.getElementById('mesa');
  if (el && el.firstChild && auth.currentUser && !document.hidden) renderMesa(el);
}, 60000);

// "Lucid 25K", "E2T 50K"
function shortName(c) {
  const cap = c.capital >= 1000 ? Math.round(c.capital / 1000) + 'K' : String(c.capital || '');
  return `${c.empresa || 'Cuenta'} ${cap}`.trim();
}
// "LUC", "E2T"
function abbr(c) {
  const s = String(c.empresa || 'CTA').replace(/[^A-Za-z0-9]/g, '');
  return (s.slice(0, 3) || 'CTA').toUpperCase();
}

// SL de HOY en esta cuenta (regla del plan: 1 SL por cuenta y día).
function slToday(c, trades, today) {
  let n = 0;
  for (const t of trades) {
    if (t.date !== today || t.result !== 'SL') continue;
    if (Array.isArray(t.accounts) && t.accounts.some(a => a.accountId === c.id)) n++;
  }
  return n;
}

// Estrategias que opera la cuenta (según los trades asignados).
function stratsOf(c, trades) {
  const set = new Set();
  for (const t of trades) {
    if (Array.isArray(t.accounts) && t.accounts.some(a => a.accountId === c.id) && SHEET_SHORT[t.sheet]) set.add(SHEET_SHORT[t.sheet]);
  }
  return [...set].join(' · ') || (c.tipo === 'Futuros' ? 'Futuros' : 'CFD');
}

function accountsData() {
  const trades = state.trades || [];
  const today = todayLocal(auth.timezone());
  return (state.cuentas || [])
    .filter(c => c.status === 'activa')
    .map(c => {
      const s = accountStats(c, trades);
      const objPct = c.targetPct > 0 ? c.targetPct : 0;
      const objUsd = objPct > 0 ? c.capital * objPct / 100 : (c.targetUsd || 0);
      const progress = objUsd > 0 ? Math.max(0, Math.min(100, s.profitTotalUsd / objUsd * 100)) : null;
      return {
        c, s, progress,
        name: shortName(c), abbr: abbr(c),
        pct: s.equityPct, balance: s.equityUsd,
        sl: slToday(c, trades, today),
        strats: stratsOf(c, trades),
      };
    });
}

function fmtPct(v) {
  const sign = v > 0 ? '+' : (v < 0 ? '−' : '');
  return `${sign}${Math.abs(v).toFixed(1)}%`;
}

// Estado de un directo respecto a ahora: en curso, empieza pronto (< 30 min) o futuro.
function estadoDirecto(d, ahora) {
  const ini = Date.parse(d.t);
  const fin = d.end ? Date.parse(d.end) : ini + 90 * 60000;
  if (ini <= ahora && fin > ahora) return { tipo: 'live' };
  const min = Math.round((ini - ahora) / 60000);
  if (min > 0 && min <= 30) return { tipo: 'soon', min };
  return { tipo: 'next' };
}
const safeUrl = u => (typeof u === 'string' && /^https:\/\//i.test(u)) ? u : '';

export function renderMesa(container) {
  if (!container) return;
  if (!unsubAuth)  unsubAuth  = auth.on(() => renderMesa(container));
  if (!unsubState) unsubState = state.on(() => renderMesa(container));
  if (!unsubHoy)   unsubHoy   = onHoyData(() => renderMesa(container));

  const open = appearance.get().mesa;
  document.body.classList.toggle('mesa-closed', !open);

  if (!auth.currentUser) { container.innerHTML = ''; return; }

  const accs = accountsData();
  const regla = reglaDelDia();
  const diaEst = estadoDia(hoyDiario());
  const diaTrades = tradesDe(hoyDiario()).length;
  const leccion = leccionDeHoy();
  const chk = checklistProgress();
  const clock = clockParts();
  const colorOf = v => v > 0 ? 'var(--green)' : (v < 0 ? 'var(--red)' : 'var(--muted)');

  // Noticias de alto impacto y próximos directos (datos públicos, ver hoy-data.js)
  const tz = auth.timezone();
  const hoyData = getHoyData();
  const { hoy: noticias, proxima } = noticiasDeHoy(hoyData, tz);
  const semana = noticiasDeLaSemana(hoyData, tz);
  const directos = proximosDirectos(hoyData, 3);
  const newsUrl = INVESTING_URL;
  const ahora = Date.now();
  const sigHoy = noticias.find(n => Date.parse(n.t) > ahora) || null;   // próxima de hoy aún por salir
  const enDirecto = directos.find(d => estadoDirecto(d, ahora).tipo === 'live') || null;

  const newsRow = n => `
    <div class="mesa-news ${Date.parse(n.t) <= ahora ? 'past' : ''}" title="${escapeHtml(n.cur + ' · ' + tituloEs(n.title) + (tituloEs(n.title) !== n.title ? ' — ' + n.title : ''))}${n.forecast ? ' · previsión ' + escapeHtml(n.forecast) : ''}${n.previous ? ' · anterior ' + escapeHtml(n.previous) : ''}">
      <span class="mesa-news-time">${horaEn(n.t, tz)}</span>
      <span class="mesa-news-dot"></span>
      <span class="mesa-news-txt"><b>${escapeHtml(n.cur)}</b> ${escapeHtml(tituloEs(n.title))}${n.forecast || n.previous ? `<small>${n.forecast ? 'prev. ' + escapeHtml(n.forecast) : ''}${n.forecast && n.previous ? ' · ' : ''}${n.previous ? 'ant. ' + escapeHtml(n.previous) : ''}</small>` : ''}</span>
    </div>`;

  let newsBody;
  if (newsScope === 'semana') {
    newsBody = semana.length
      ? semana.map(g => `<div class="mesa-news-day ${g.esHoy ? 'hoy' : ''}">${escapeHtml(g.label)}${g.esHoy ? ' · hoy' : ''}</div>${g.items.map(newsRow).join('')}`).join('')
      : `<div class="mesa-empty">Esta semana no quedan noticias de alto impacto.</div>`;
  } else {
    newsBody = noticias.length
      ? noticias.map(newsRow).join('') + `<div class="mesa-news-warn">Evita operar en la noticia</div>`
      : `<div class="mesa-empty">Hoy no hay noticias de alto impacto.${proxima ? ` Próxima: <b>${diaCortoEn(proxima.t, tz)} · ${horaEn(proxima.t, tz)}</b> ${escapeHtml(proxima.cur)} ${escapeHtml(tituloEs(proxima.title))}.` : ''}</div>`;
  }
  const newsBox = !hoyData ? '' : `
      <section class="card mesa-box">
        <div class="mesa-block-head">
          <h2>Alto impacto</h2>
          <div class="mesa-mini-seg" role="group" aria-label="Periodo de noticias">
            <button type="button" class="${newsScope === 'hoy' ? 'on' : ''}" data-news-scope="hoy">Hoy</button>
            <button type="button" class="${newsScope === 'semana' ? 'on' : ''}" data-news-scope="semana">Semana</button>
          </div>
        </div>
        <div class="mesa-source" title="Lista sacada del calendario de Forex Factory: solo carpeta roja (alto impacto) de USD, EUR y GBP, en tu hora."><span class="mesa-news-dot"></span>Forex Factory · carpeta roja</div>
        ${newsBody}
        <a class="mesa-link mesa-foot-link" href="${INVESTING_URL}" target="_blank" rel="noopener noreferrer" title="Calendario económico de Investing (3 estrellas = alto impacto)">Ver calendario de Investing ↗</a>
      </section>`;

  const directoRow = d => {
    const st = estadoDirecto(d, ahora);
    // El enlace para entrar solo se ofrece cuando el directo está en curso o
    // le faltan menos de 30 min (para poder entrar puntual). Antes, la fila
    // es solo informativa.
    const url = (st.tipo === 'live' || st.tipo === 'soon') ? safeUrl(d.url) : '';
    const cuando = st.tipo === 'live' ? '<span class="mesa-live-badge">● En directo</span>'
      : st.tipo === 'soon' ? `<span class="mesa-live-soon">Empieza en ${st.min} min</span> · ${horaEn(d.t, tz)}`
      : `${diaCortoEn(d.t, tz)} · ${horaEn(d.t, tz)}`;
    const inner = `
        <span class="mesa-live-when">${cuando}</span>
        <span class="mesa-live-title">${escapeHtml(d.title)}${url ? ' <span class="mesa-live-go">↗</span>' : ''}</span>`;
    return url
      ? `<a class="mesa-live ${st.tipo}" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" title="${st.tipo === 'live' ? 'Entrar al directo' : 'Abrir el enlace del directo'}">${inner}</a>`
      : `<div class="mesa-live ${st.tipo}"${safeUrl(d.url) ? ' title="El enlace para entrar aparece 30 min antes de empezar"' : ''}>${inner}</div>`;
  };
  const directosBox = !directos.length ? '' : `
      <section class="card mesa-box ${enDirecto ? 'has-live' : ''}">
        <div class="mesa-block-head"><h2>Próximos directos</h2><a class="mesa-link" href="${DISCORD_URL}" target="_blank" rel="noopener noreferrer" title="Comunidad de Tradinverso en Discord">Discord ↗</a></div>
        ${directos.map(directoRow).join('')}
      </section>`;

  if (open) {
    container.innerHTML = `
      <div class="mesa-head">
        <span class="mesa-title">Hoy · ${clock.ddmm}</span>
        <button type="button" class="mesa-toggle" id="mesaToggle" aria-label="Recoger la columna Hoy">‹ Recoger</button>
      </div>

      <section class="card mesa-box">
        <button type="button" class="mesa-chk" id="mesaChecklist" title="Abrir el checklist pre-sesión">
          <span class="mesa-chk-head"><b>Checklist pre-sesión</b><span class="${chk.done === chk.total ? 'ok' : ''}">${chk.done === chk.total ? '✓ completo' : `${chk.done}/${chk.total}`}</span></span>
          <span class="mesa-bar"><span style="width:${chk.total ? chk.done / chk.total * 100 : 0}%" class="${chk.done === chk.total ? 'ok' : ''}"></span></span>
        </button>
      </section>
      <section class="card mesa-box">
        <button type="button" class="mesa-chk mesa-dia" id="mesaDiario" title="Abrir el diario de hoy: plan, trades y revisión">
          <span class="mesa-chk-head"><b>Diario de hoy</b><span class="${diaEst.plan && diaEst.review ? 'ok' : ''}">${diaEst.plan && diaEst.review ? '✓ completo' : !diaEst.plan ? 'falta el plan' : 'falta revisar'}</span></span>
          <span class="mesa-dia-steps"><i class="${diaEst.plan ? 'ok' : ''}">Plan</i><i class="${diaTrades ? 'ok' : ''}">${diaTrades} trade${diaTrades === 1 ? '' : 's'}</i><i class="${diaEst.review ? 'ok' : ''}">Revisión</i></span>
        </button>
      </section>
      ${newsBox}
      ${directosBox}
      <section class="card mesa-box">
        <div class="mesa-block-head"><h2>Cuentas</h2><a href="#/cuentas" class="mesa-link">${accs.length} activa${accs.length === 1 ? '' : 's'} →</a></div>
        ${accs.length ? accs.map(a => `
          <div class="mesa-acc" title="${escapeHtml(a.name)} · ${fmtPct(a.pct)} · SL hoy ${a.sl}/1">
            <div class="mesa-acc-row">
              <span class="mesa-acc-name"><span class="mesa-dot ${a.sl > 0 ? 'bad' : 'ok'}" title="SL hoy ${a.sl}/1"></span>${escapeHtml(a.name)}</span>
              <span class="mesa-acc-pct pnl-value" style="color:${colorOf(a.pct)}">${fmtPct(a.pct)}</span>
            </div>
            ${a.progress != null ? `<div class="mesa-bar" title="Progreso hacia el objetivo de la fase: ${a.progress.toFixed(0)}%"><div style="width:${a.progress}%"></div></div>` : ''}
            <div class="mesa-acc-row sub"><span>${escapeHtml(a.strats)}</span><span class="pnl-value">${fmtUsd(a.balance)}</span></div>
          </div>`).join('')
        : `<div class="mesa-empty">Sin cuentas activas. <a href="#/cuentas">Añade una →</a></div>`}
      </section>
      <section class="card mesa-box">
        ${leccion ? `
        <div class="mesa-block-head"><div class="mesa-label">Una lección tuya</div></div>
        <div class="mesa-rule">${escapeHtml(leccion.texto)}</div>
        <div class="mesa-rule-sub">La escribiste el ${leccion.dia.split('-').reverse().join('/')}.</div>` : `
        <div class="mesa-block-head"><div class="mesa-label">Regla del día</div></div>
        <div class="mesa-rule">${escapeHtml(regla.main)}</div>
        <div class="mesa-rule-sub">${escapeHtml(regla.sub)}</div>`}
      </section>
      <a class="card mesa-cta" href="${FORMACION_URL}" target="_blank" rel="noopener noreferrer" title="Cursos y directos de Tradinverso">
        <span class="mesa-cta-ic">${icon('formacion')}</span>
        <span class="mesa-cta-text"><b>Formación</b><small>Cursos · directos</small></span>
        <span class="mesa-cta-arrow">↗</span>
      </a>
      ${hoyData ? '' : `<a class="card mesa-cta" href="${newsUrl}" target="_blank" rel="noopener noreferrer" title="Calendario económico de Investing">
        <span class="mesa-cta-ic alt">${icon('noticias')}</span>
        <span class="mesa-cta-text"><b>Noticias</b><small>Calendario económico</small></span>
        <span class="mesa-cta-arrow">↗</span>
      </a>`}
    `;
    container.querySelectorAll('[data-news-scope]').forEach(b => b.addEventListener('click', () => {
      newsScope = b.dataset.newsScope;
      renderMesa(container);
    }));
  } else {
    const deg = chk.total ? chk.done / chk.total * 360 : 0;
    const liveUrl = enDirecto ? safeUrl(enDirecto.url) : '';
    container.innerHTML = `
      <div class="card mesa-rail" aria-label="Columna Hoy recogida">
        <button type="button" class="mesa-rail-open" id="mesaToggle" aria-label="Abrir la columna Hoy" title="Abrir: checklist, noticias, directos y cuentas">›</button>
        <span class="mesa-rail-title">Hoy</span>
        ${enDirecto ? (liveUrl
          ? `<a class="mesa-rail-live" href="${escapeHtml(liveUrl)}" target="_blank" rel="noopener noreferrer" title="En directo ahora: ${escapeHtml(enDirecto.title)} · pulsa para entrar">LIVE</a>`
          : `<span class="mesa-rail-live" title="En directo ahora: ${escapeHtml(enDirecto.title)}">LIVE</span>`) : ''}
        ${accs.map(a => `
          <div class="mesa-pill" title="${escapeHtml(a.name)} · ${fmtPct(a.pct)} · SL hoy ${a.sl}/1">
            <span class="mesa-pill-abbr">${escapeHtml(a.abbr)}</span>
            <span class="mesa-pill-bar" style="background:${colorOf(a.pct)}"></span>
            <span class="mesa-pill-sl">${a.sl}/1</span>
          </div>`).join('')}
        <span class="mesa-sep"></span>
        <button type="button" class="mesa-ring" id="mesaChecklist" title="Checklist pre-sesión · ${chk.done}/${chk.total}" style="background:conic-gradient(${chk.done === chk.total ? 'var(--green)' : 'var(--accent)'} ${deg}deg, var(--line) ${deg}deg 360deg)"><span>${chk.done}/${chk.total}</span></button>
        <button type="button" class="mesa-rail-link mesa-rail-dia ${diaEst.plan && diaEst.review ? 'ok' : diaEst.plan ? 'half' : ''}" id="mesaDiario" title="Diario de hoy · ${!diaEst.plan ? 'falta el plan' : !diaEst.review ? 'falta revisar' : 'completo'}" aria-label="Diario de hoy">${icon('nota')}</button>
        <span class="mesa-sep"></span>
        <a class="mesa-rail-link" href="${FORMACION_URL}" target="_blank" rel="noopener noreferrer" title="Formación · cursos y directos" aria-label="Formación">${icon('formacion')}</a>
        ${sigHoy
          ? `<a class="mesa-rail-news" href="${newsUrl}" target="_blank" rel="noopener noreferrer" title="Noticia de alto impacto hoy a las ${horaEn(sigHoy.t, tz)}: ${escapeHtml(sigHoy.cur + ' ' + tituloEs(sigHoy.title))}">${horaEn(sigHoy.t, tz)}</a>`
          : `<a class="mesa-rail-link" href="${newsUrl}" target="_blank" rel="noopener noreferrer" title="${hoyData ? (noticias.length ? 'Las noticias de alto impacto de hoy ya han salido' : 'Hoy no hay noticias de alto impacto') : 'Noticias · calendario económico'}" aria-label="Noticias">${icon('noticias')}</a>`}
      </div>
    `;
  }
  // Checklist: anillo (columna recogida) o fila con barra (abierta)
  const chkBtn = container.querySelector('#mesaChecklist');
  if (chkBtn) chkBtn.addEventListener('click', () => openChecklistModal(() => renderMesa(container)));
  const diaBtn = container.querySelector('#mesaDiario');
  if (diaBtn) diaBtn.addEventListener('click', () => openDiarioModal());

  container.querySelector('#mesaToggle').addEventListener('click', () => {
    appearance.set({ mesa: !open });
    renderMesa(container);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
