// "Elegir y exportar" (pop-up de la cuenta → Datos y privacidad): exporta una
// selección de trades por estrategia y periodo en Excel, CSV o PDF.
//   · Excel → el mismo libro de siempre (una pestaña por estrategia, SheetJS)
//   · CSV   → un único archivo con ; y BOM UTF-8 (se abre bien en Excel en español)
//   · PDF   → informe con cabecera, resumen y tabla (jsPDF + autotable, del CDN)

import { exportXlsx, stampNow, slug } from './sheet-export.js';
import { downloadFile } from './csv.js';
import { STRATEGIES } from './strategy-config.js';
import { winrate, pnlPct } from './calculations.js';
import { todayLocal } from './timezone.js';
import { auth } from '../auth.js';

export const EXPORT_SHEETS = ['ZONAS', 'NASDAQ', 'LIQUIDEZ'];
export const sheetLabel = s => (STRATEGIES[s] && STRATEGIES[s].label) || s;

const JSPDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
const AUTOTABLE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('No se pudo descargar una librería del CDN. Comprueba tu conexión.'));
    document.head.appendChild(s);
  });
}

// Rango de fechas (YYYY-MM-DD, inclusive) de un periodo. null = sin límite.
export function periodRange(period, desde, hasta) {
  const hoy = todayLocal(auth.timezone());
  if (period === 'mes') return { from: hoy.substring(0, 8) + '01', to: hoy };
  if (period === 'semana') {
    const d = new Date(hoy + 'T12:00:00');
    const dow = (d.getDay() + 6) % 7;            // lunes = 0
    d.setDate(d.getDate() - dow);
    const p = n => String(n).padStart(2, '0');
    return { from: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, to: hoy };
  }
  if (period === 'custom') return { from: desde || null, to: hasta || null };
  return { from: null, to: null };
}

export function periodLabel(period, desde, hasta) {
  if (period === 'mes') return 'Este mes';
  if (period === 'semana') return 'Esta semana';
  if (period === 'custom') return `${desde || 'inicio'} → ${hasta || 'hoy'}`;
  return 'Todo el historial';
}

export function filterTrades(trades, { sheets, period, desde, hasta }) {
  const { from, to } = periodRange(period, desde, hasta);
  return trades
    .filter(t => sheets.includes(t.sheet))
    .filter(t => (!from || t.date >= from) && (!to || t.date <= to))
    .sort((a, b) => (a.date + (a.open_str || '')).localeCompare(b.date + (b.open_str || '')));
}

const lista = v => Array.isArray(v) ? v.join(' + ') : (v || '');
const num = (v, d = 2) => (typeof v === 'number' && isFinite(v)) ? v.toFixed(d).replace('.', ',') : '';

function filas(trades) {
  return trades.map(t => [
    t.date, sheetLabel(t.sheet), t.pair || '', String(t.setup || '').toUpperCase(), t.model || '',
    lista(t.zone), lista(t.entry), t.open_str || '', t.close_str || '', t.result || '',
    num(t.pnl_pct), num(t.risk_real_pct), num((t.pnl_pct || 0) * (t.risk_real_pct ?? 1)),
    t.sensacion || '', t.plan_followed === true ? 'Sí' : t.plan_followed === false ? 'No' : '',
    String(t.reflexion || '').replace(/\s+/g, ' ').trim(),
  ]);
}
const CABECERA = ['Fecha', 'Estrategia', 'Par', 'Setup', 'Modelo', 'Zona', 'Entrada', 'Apertura', 'Cierre', 'Resultado',
  '% P&L sistema', 'Riesgo real %', '% P&L real', 'Sensación', 'Plan', 'Reflexión'];

function nombreArchivo(nombre, ext) {
  return `tradinverso-${slug(nombre || 'trades')}-${stampNow()}.${ext}`;
}

export function exportCsv(trades, nombre) {
  const esc = v => { const s = String(v ?? ''); return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [CABECERA, ...filas(trades)].map(r => r.map(esc).join(';')).join('\r\n');
  downloadFile(nombreArchivo(nombre, 'csv'), '﻿' + csv, 'text/csv;charset=utf-8');
}

export async function exportExcel(trades, nombre) {
  await exportXlsx(trades, nombreArchivo(nombre, 'xlsx'));
}

export async function exportPdf(trades, nombre, { sheets, period, desde, hasta }) {
  await loadScript(JSPDF_CDN);
  await loadScript(AUTOTABLE_CDN);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  // Cabecera
  doc.setFillColor(15, 23, 42); doc.rect(0, 0, W, 64, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
  doc.text('Tradinverso', 40, 30);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.text('Trading Journal · informe de trades', 40, 47);
  doc.text(new Date().toLocaleDateString('es-ES'), W - 40, 30, { align: 'right' });

  // Quién, qué y resumen
  doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text(nombre || 'Trades', 40, 92);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(71, 85, 105);
  doc.text(`${sheets.map(sheetLabel).join(' · ')}  ·  ${periodLabel(period, desde, hasta)}`, 40, 108);
  const tp = trades.filter(t => t.result === 'TP').length, sl = trades.filter(t => t.result === 'SL').length;
  const be = trades.length - tp - sl;
  const pnl = pnlPct(trades);
  const cajas = [['Trades', String(trades.length)], ['TP / SL / BE', `${tp} / ${sl} / ${be}`],
    ['Winrate', (tp + sl) ? winrate(trades).toFixed(1) + ' %' : '–'], ['P&L sistema', (pnl >= 0 ? '+' : '') + pnl.toFixed(2) + ' %']];
  cajas.forEach(([k, v], i) => {
    const x = 40 + i * 150;
    doc.setDrawColor(226, 232, 240); doc.setFillColor(248, 250, 252); doc.roundedRect(x, 122, 138, 44, 6, 6, 'FD');
    doc.setFontSize(8); doc.setTextColor(100, 116, 139); doc.text(k.toUpperCase(), x + 10, 138);
    doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 23, 42); doc.text(v, x + 10, 156);
    doc.setFont('helvetica', 'normal');
  });

  // Tabla (sin la reflexión: no cabe en una fila)
  const cols = [0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  doc.autoTable({
    startY: 184,
    head: [cols.map(i => CABECERA[i])],
    body: filas(trades).map(r => cols.map(i => r[i])),
    styles: { fontSize: 7.5, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 40, right: 40 },
    didParseCell: d => {
      if (d.section !== 'body' || d.column.index !== 8) return;
      const v = d.cell.raw;
      d.cell.styles.textColor = v === 'TP' ? [5, 150, 105] : v === 'SL' ? [220, 38, 38] : [180, 110, 0];
      d.cell.styles.fontStyle = 'bold';
    },
    didDrawPage: () => {
      doc.setFontSize(8); doc.setTextColor(148, 163, 184);
      doc.text(`Tradinverso · página ${doc.internal.getNumberOfPages()}`, W - 40, doc.internal.pageSize.getHeight() - 18, { align: 'right' });
    },
  });
  doc.save(nombreArchivo(nombre, 'pdf'));
}
