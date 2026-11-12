// Bloque "Firmas que usamos en Tradinverso" de la vista Cuentas: la destacada
// en grande y el resto en rejilla, con las herramientas al final.
// Los datos están en js/utils/firmas.js.

import { ic } from './icons.js';
import { renderPills } from './pills.js';
import { firmasDe, mercadoLabel } from '../utils/firmas.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let filtro = 'all';          // 'all' | 'Futuros' | 'CFD' — propio del bloque
let irAlBloque = false;      // lo pide el botón "Prop firms" de la columna Hoy

// Botón "Prop firms": lleva a Cuentas y baja hasta el bloque.
export function irAFirmas() {
  const el = document.getElementById('firmas');
  if (el && location.hash.startsWith('#/cuentas') && !location.hash.startsWith('#/cuentas/')) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  irAlBloque = true;
  location.hash = '#/cuentas';
}

function codigosHtml(f) {
  if (!f.codigos || !f.codigos.length) return '';
  return `<div class="firma-codes">${f.codigos.map(c => `
    <button type="button" class="firma-code" data-copiar="${esc(c.codigo)}" title="Copiar el código">
      <span class="firma-code-l">Código${c.nota ? ` · ${esc(c.nota)}` : ''}</span>
      <span class="firma-code-v">${esc(c.codigo)}</span>
      <span class="firma-code-a">Copiar</span>
    </button>`).join('')}</div>`;
}

function tarjeta(f) {
  const tags = f.mercados.map(m => `<span class="firma-tag">${mercadoLabel(m)}</span>`).join('');
  if (f.destacada) return `
    <div class="firma destacada">
      <span class="firma-logo" style="background:${f.fondo || '#fff'}"><img src="${esc(f.logo)}" alt=""></span>
      <div class="firma-id">
        ${f.insignia ? `<span class="firma-badge">${ic('ok')} ${esc(f.insignia)}</span>` : ''}
        <div class="firma-name">${esc(f.nombre)}</div>
        <div class="firma-lema">${esc(f.lema || 'La que recomendamos')}</div>
        <div class="firma-tags">${tags}</div>
      </div>
      <div class="firma-side">
        ${codigosHtml(f)}
        <a class="btn primary firma-go" href="${esc(f.url)}" target="_blank" rel="noopener sponsored">Ir a ${esc(f.nombre)} ${ic('enlace')}</a>
      </div>
    </div>`;
  return `
    <div class="firma">
      <div class="firma-top">
        <span class="firma-logo" style="background:${f.fondo || '#fff'}"><img src="${esc(f.logo)}" alt="" loading="lazy"></span>
        <div class="firma-id">
          <div class="firma-name">${esc(f.nombre)}</div>
          <div class="firma-tags">${f.descripcion ? `<span class="firma-desc">${esc(f.descripcion)}</span>` : ''}${tags}</div>
        </div>
      </div>
      ${codigosHtml(f)}
      <a class="btn firma-go" href="${esc(f.url)}" target="_blank" rel="noopener sponsored">Ir a la web ${ic('enlace')}</a>
    </div>`;
}

export function firmasHtml() {
  const lista = firmasDe(filtro);
  const firmas = lista.filter(f => f.tipo !== 'herramienta');
  const herramientas = lista.filter(f => f.tipo === 'herramienta');
  const destacada = firmas.find(f => f.destacada);
  const resto = firmas.filter(f => f !== destacada);
  return `
    <section class="firmas" id="firmas">
      <div class="section-title-row">
        <div class="section-title" style="margin:0;">Firmas que usamos en Tradinverso</div>
        <div class="type-tabs" id="firmasTabs"></div>
      </div>
      ${destacada ? tarjeta(destacada) : ''}
      ${resto.length || herramientas.length ? `<div class="firmas-grid">${[...resto, ...herramientas].map(tarjeta).join('')}</div>` : ''}
      ${lista.length ? '' : '<div class="empty">Ninguna firma en este mercado.</div>'}
      <p class="firmas-nota">Son enlaces de afiliado: a ti no te cuesta más y a nosotros nos ayuda.</p>
    </section>`;
}

// `repintar` vuelve a pintar la vista que contiene el bloque.
export function wireFirmas(container, repintar) {
  if (irAlBloque) {
    irAlBloque = false;
    // El router sube arriba al cambiar de vista y la vista puede repintarse al
    // llegar: se baja al bloque después, y otra vez por si algo lo ha movido.
    const bajar = () => document.getElementById('firmas')?.scrollIntoView({ block: 'start' });
    setTimeout(bajar, 60);
    setTimeout(bajar, 450);
  }
  const tabs = container.querySelector('#firmasTabs');
  if (tabs) {
    renderPills(tabs, {
      name: 'firmasMercado',
      options: [{ value: 'all', label: 'Todas' }, { value: 'Futuros', label: 'Futuros' }, { value: 'CFD', label: 'CFDs' }],
      value: filtro,
      onChange: v => {
        filtro = v;
        repintar();
        // El repintado devuelve el scroll arriba en algunas vistas: volver al bloque.
        document.getElementById('firmas')?.scrollIntoView({ block: 'nearest' });
      },
    });
  }
  container.querySelectorAll('[data-copiar]').forEach(b => {
    b.addEventListener('click', async () => {
      const a = b.querySelector('.firma-code-a');
      try {
        await navigator.clipboard.writeText(b.dataset.copiar);
        a.textContent = 'Copiado';
      } catch (e) {
        // Sin permiso de portapapeles: se deja el código seleccionado para copiarlo a mano.
        const r = document.createRange(); r.selectNodeContents(b.querySelector('.firma-code-v'));
        const s = getSelection(); s.removeAllRanges(); s.addRange(r);
        a.textContent = 'Ctrl+C';
      }
      b.classList.add('ok');
      setTimeout(() => { a.textContent = 'Copiar'; b.classList.remove('ok'); }, 1800);
    });
  });
}
