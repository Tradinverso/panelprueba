// Vista "Protocolos" — protocolos del alumno en Markdown editable + enlace
// opcional a Drive. Misma mecánica que el Plan de trading, pero persistidos
// dentro del sub-objeto `protocolos` del doc del Plan (users/{uid}/tradingPlan/
// data) para no crear un doc nuevo ni tocar reglas/backups. Es la 3ª pestaña de
// Psicotrading.

import { state } from '../state.js';
import { renderMarkdown } from '../utils/markdown.js';
import { embedUrl, docBlock } from './plan.js';   // se reutilizan tal cual
import { psicotradingTabs } from '../components/psicotrading-tabs.js';

let editing = false;

function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function render(container) {
  const proto = (state.tradingPlan && state.tradingPlan.protocolos) || {};
  const hasContent = !!(proto.content && proto.content.trim());
  const hasUrl = !!proto.docUrl;

  if (editing) {
    container.innerHTML = `
      ${psicotradingTabs('protocolos')}
      <div class="page-header">
        <div><h1>Protocolos</h1><div class="sub">Edición · formato Markdown</div></div>
        <div class="page-actions">
          <button class="btn" id="protoCancel">Cancelar</button>
          <button class="btn primary" id="protoSave">Guardar</button>
        </div>
      </div>
      <div class="card" style="margin-bottom:16px;">
        <div class="form-field">
          <label class="form-label">Enlace a documento (opcional)</label>
          <input class="form-input" id="protoUrl" type="url" placeholder="https://drive.google.com/... o https://docs.google.com/..." value="${esc(proto.docUrl || '')}">
          <div style="font-size:10px;color:var(--muted);font-family:var(--mono);margin-top:4px;">Pega tu enlace de Google Drive/Docs. Compártelo como <strong>“Cualquiera con el enlace”</strong> para verlo aquí en grande sin salir de la app.</div>
        </div>
      </div>
      <div class="card">
        <div class="card-head">
          <div>
            <div class="card-title">Tus protocolos</div>
            <div class="card-sub"># Título · ## Subtítulo · **negrita** · *cursiva* · - lista · [texto](https://…)</div>
          </div>
        </div>
        <textarea class="form-textarea" id="protoText" style="min-height:440px;font-family:var(--mono);line-height:1.7;">${esc(proto.content || '')}</textarea>
      </div>
    `;
    const ta = container.querySelector('#protoText');
    container.querySelector('#protoCancel').addEventListener('click', () => { editing = false; render(container); });
    container.querySelector('#protoSave').addEventListener('click', () => {
      const content = ta.value;
      const docUrl = container.querySelector('#protoUrl').value.trim();
      state.saveProtocolos({ content, docUrl, updatedAt: Date.now() });
      editing = false;
      render(container);
    });
    ta.focus();
    return;
  }

  container.innerHTML = `
    ${psicotradingTabs('protocolos')}
    <div class="page-header">
      <div>
        <h1>Protocolos</h1>
        <div class="sub">${proto.updatedAt ? 'Actualizado ' + fmtDate(proto.updatedAt) : 'Tus protocolos de operativa y gestión mental'}</div>
      </div>
      <div class="page-actions">
        <button class="btn primary" id="protoEdit">${hasContent || hasUrl ? '✏️ Editar' : '+ Escribir protocolos'}</button>
      </div>
    </div>
    ${hasContent ? `<div class="card md-content" style="margin-bottom:16px;">${renderMarkdown(proto.content)}</div>` : ''}
    ${hasUrl ? docBlock(proto.docUrl, 'protocolos') : ''}
    ${(!hasContent && !hasUrl)
      ? `<div class="empty">
           <div class="big">📋</div>
           <div>Aún no has escrito tus protocolos.</div>
           <div style="margin-top:8px;font-size:11px;color:var(--muted);">Tus reglas de actuación: antes de operar, tras un SL, gestión del tilt, checklist de entrada… Escríbelos aquí (Markdown) o pega el <strong>enlace de tu Drive</strong>.</div>
         </div>`
      : ''}
  `;
  container.querySelector('#protoEdit').addEventListener('click', () => { editing = true; render(container); });
}

export function protocolosView(container) {
  editing = false;
  render(container);
  return state.on(() => { if (!editing) render(container); });
}
