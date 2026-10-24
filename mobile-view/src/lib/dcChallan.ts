/**
 * Mobile port of web lib/dcChallanPdf.ts — the Delivery Challan with the columns and header blocks the
 * warehouse picked, rendered as HTML, turned into a PDF with expo-print and opened in the share / print sheet.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { dcRowCategoryOrDefault, isSpecimenRow } from './crm/dcRowCategory';

/** Columns the warehouse can choose for the Delivery Challan table (same keys/widths as web). */
export const DC_PRINT_COLUMNS = [
  { key: 'class', label: 'Class', width: 14 },
  { key: 'category', label: 'Category', width: 32 },
  { key: 'product', label: 'Product', width: 38 },
  { key: 'series', label: 'Series', width: 38 },
  { key: 'level', label: 'Term / Level', width: 24 },
  { key: 'deliverables', label: 'Deliverables', width: 38 },
  { key: 'specs', label: 'Specs', width: 30 },
  { key: 'qty', label: 'Quantity', width: 20 },
] as const;

/** Header blocks the warehouse can show or hide (DC No and Date always print). */
export const DC_PRINT_SECTIONS = [
  { key: 'school', label: 'School details (name, type, phone)' },
  { key: 'address', label: 'Delivery address' },
  { key: 'transit', label: 'Transit information (transport, LR, boxes)' },
  { key: 'transportTo', label: 'Transport To (who collects)' },
] as const;

export type DcPrintColumn = (typeof DC_PRINT_COLUMNS)[number]['key'];
export type DcPrintSection = (typeof DC_PRINT_SECTIONS)[number]['key'];
export type DcPrintOptions = { columns: DcPrintColumn[]; sections: DcPrintSection[] };

/** Default printout: Category, Series, Deliverables and Quantity, with the school and transit blocks. */
export const DEFAULT_DC_PRINT_OPTIONS: DcPrintOptions = {
  columns: ['category', 'series', 'deliverables', 'qty'],
  sections: ['school', 'address', 'transit', 'transportTo'],
};

const STORAGE_KEY = 'dcPrintOptions';

/** The last print choice (web keeps it in localStorage; the app in AsyncStorage). */
export async function loadDcPrintOptions(): Promise<DcPrintOptions> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const saved = raw ? JSON.parse(raw) : null;
    const columns = (saved?.columns || []).filter((c: string) => DC_PRINT_COLUMNS.some((d) => d.key === c)) as DcPrintColumn[];
    const sections = (saved?.sections || []).filter((c: string) => DC_PRINT_SECTIONS.some((d) => d.key === c)) as DcPrintSection[];
    if (!columns.length) return DEFAULT_DC_PRINT_OPTIONS;
    return { columns: columns.includes('qty') ? columns : [...columns, 'qty'], sections };
  } catch {
    return DEFAULT_DC_PRINT_OPTIONS;
  }
}

export async function saveDcPrintOptions(options: DcPrintOptions): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(options));
  } catch {
    /* preference only */
  }
}

export type DcTransit = {
  transport?: string;
  transportArea?: string;
  lrNo?: string;
  boxes?: string | number;
  lrDate?: string;
  remarks?: string;
};

type Line = Record<DcPrintColumn, string>;

/** Table lines for the challan: one per DC row, plus the Abacus kit items. */
export function dcChallanLines(fullDC: any): Line[] {
  const lines: Line[] = [];
  for (const p of fullDC?.productDetails || []) {
    const qty = Number(p.quantity) || 0;
    const product = p.productName || p.product || '';
    if (!product || qty <= 0) continue;
    const specimen = isSpecimenRow(p);
    lines.push({
      class: String(p.class || '-'),
      category: fullDC.dcType === 'shortage' ? 'Shortage' : specimen ? 'Training Material' : dcRowCategoryOrDefault(p.category),
      product,
      series: String(p.productCategory || '-'),
      level: String(p.level || p.term || '-'),
      deliverables: String(p.subject || (specimen ? p.specs : '') || p.stream || '-'),
      specs: String(p.specs || '-'),
      qty: String(qty),
    });
  }
  const kit = fullDC?.abacusMaterials || {};
  const kitItems: Array<[string, unknown]> = [
    ['Student Abacus', kit.studentAbacusQuantity],
    ['Master Abacus', kit.masterAbacusQuantity],
    ['Flash Cards', kit.flashCardSetsQuantity],
  ];
  for (const [name, q] of kitItems) {
    if (Number(q) > 0) {
      lines.push({
        class: 'NA',
        category: 'Training Material',
        product: `Abacus ${name}`,
        series: '-',
        level: '-',
        deliverables: name,
        specs: '-',
        qty: String(Number(q)),
      });
    }
  }
  return lines;
}

const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const ddmmyyyy = (v?: string) => {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB');
};

/** Delivery Challan HTML with only the chosen columns and header blocks (same content as the web PDF). */
export function buildDcChallanHtml(fullDC: any, transit: DcTransit, options: DcPrintOptions = DEFAULT_DC_PRINT_OPTIONS): string {
  const order = typeof fullDC?.dcOrderId === 'object' && fullDC.dcOrderId ? fullDC.dcOrderId : {};
  const show = (s: DcPrintSection) => options.sections.includes(s);
  const columns = DC_PRINT_COLUMNS.filter((c) => options.columns.includes(c.key));
  const lines = dcChallanLines(fullDC);
  const totalQty = lines.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);

  const dcNo = fullDC?.dc_code || fullDC?.dcNo || String(fullDC?._id || '').slice(-6);
  const dcDate = ddmmyyyy(fullDC?.dcDate) || new Date().toLocaleDateString('en-GB');
  const leftLines: string[] = [`DC No: ${dcNo}`, `DC Date: ${dcDate}`];
  if (show('school')) {
    const code = order.school_code ? ` (${order.school_code})` : '';
    leftLines.push(`School: ${order.school_name || fullDC?.customerName || ''}${code}`);
    leftLines.push(`School Type: ${order.school_type || 'Existing'}`);
    leftLines.push(`Phone: ${order.contact_mobile || fullDC?.customerPhone || ''}`);
  }
  if (show('address')) {
    const parts = [order.transport_location, order.transport_name, order.transportation_landmark, order.pincode].filter(Boolean);
    leftLines.push(`Address: ${parts.length ? parts.join(', ') : order.address || ''}`);
  }
  const rightLines: string[] = [];
  if (show('transit')) {
    rightLines.push(`Transport: ${transit.transport || ''}`);
    rightLines.push(`Transport Area: ${transit.transportArea || ''}`);
    rightLines.push(`LR No: ${transit.lrNo || ''}`);
    rightLines.push(`#Boxes: ${transit.boxes || ''}`);
    rightLines.push(`LR Date: ${ddmmyyyy(transit.lrDate)}`);
    if (transit.remarks) rightLines.push(`Remarks: ${transit.remarks}`);
  }
  if (show('transportTo') && (order.transport_to_name || order.transport_to)) {
    const kind = ({ BDE: 'BDE', School: 'School', Trainer: 'Trainer' } as Record<string, string>)[String(order.transport_to)] || '';
    rightLines.push(`Transport To: ${[kind, order.transport_to_name].filter(Boolean).join(' - ')}`);
    if (order.transport_to_mobile) rightLines.push(`Mobile: ${order.transport_to_mobile}`);
  }

  const block = (title: string, rows: string[]) =>
    `<div class="block"><div class="block-title">${esc(title)}</div>${rows.map((r) => `<div>${esc(r)}</div>`).join('')}</div>`;

  const natural = columns.reduce((s, c) => s + c.width, 0) || 1;
  const head = columns
    .map((c) => `<th style="width:${((c.width / natural) * 100).toFixed(1)}%">${esc(c.label)}</th>`)
    .join('');
  const body = lines.map((l) => `<tr>${columns.map((c) => `<td>${esc(l[c.key] || '-')}</td>`).join('')}</tr>`).join('');
  const qtyIndex = columns.findIndex((c) => c.key === 'qty');
  const totalLabelAt = Math.max(0, qtyIndex - 1);
  const totalRow = columns
    .map((_, i) => `<td>${i === qtyIndex ? totalQty : i === totalLabelAt ? 'Total' : ''}</td>`)
    .join('');

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  @page { size: A4; margin: 10mm; }
  body { font-family: Helvetica, Arial, sans-serif; font-size: 11px; color: #000; margin: 0; }
  .company { color: #646464; font-size: 9px; line-height: 1.5; margin-bottom: 10px; }
  .band { background: #0066cc; color: #fff; text-align: center; font-weight: bold; padding: 6px 0;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .title { font-size: 18px; margin-bottom: 14px; }
  .blocks { display: flex; gap: 20px; margin-bottom: 14px; }
  .block { flex: 1; line-height: 1.6; word-break: break-word; }
  .block-title { font-weight: bold; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th { background: #f0f0f0; text-align: left; padding: 6px 4px; font-size: 10px;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  td { padding: 4px; font-size: 9.5px; vertical-align: top; word-break: break-word; border-bottom: 1px solid #eee; }
  tr.total td { background: #f0f0f0; font-weight: bold; border-bottom: none;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .footer { font-size: 8px; margin-top: 30px; }
</style></head>
<body>
  <div class="company">II Floor, A.N.K Towers,<br/>KPHB Colony, Hyderabad-72<br/>Land line: 040-64592499<br/>Mobile: 09348 0999 33</div>
  <div class="band title">Delivery Challan</div>
  <div class="blocks">
    ${block('DC Information', leftLines)}
    ${rightLines.length ? block('Transit Information', rightLines) : ''}
  </div>
  <table>
    <thead><tr>${head}</tr></thead>
    <tbody>${body || `<tr><td colspan="${columns.length}">No lines</td></tr>`}<tr class="total">${totalRow}</tr></tbody>
  </table>
  <div class="band footer">CRM  update company address in settings before printing</div>
</body></html>`;
}

/** DC (with its school order populated) for the challan, as web loadDcForChallan. */
export async function loadDcForChallan(
  api: { get: (url: string) => Promise<any> },
  dcId: string
): Promise<any> {
  const fullDC = await api.get(`/dc/${dcId}`);
  if (!fullDC) throw new Error('DC not found');
  if (fullDC.dcOrderId && typeof fullDC.dcOrderId !== 'object') {
    fullDC.dcOrderId = await api.get(`/dc-orders/${fullDC.dcOrderId}`).catch(() => null);
  }
  return fullDC;
}

/**
 * Build the challan and open the native print / share sheet (Expo web: browser print dialog).
 * `beforeShare` runs once the PDF is ready, e.g. to close the options modal so iOS can present the sheet.
 */
export async function printDcChallan(
  fullDC: any,
  transit: DcTransit,
  options: DcPrintOptions,
  beforeShare?: () => void | Promise<void>
): Promise<void> {
  const html = buildDcChallanHtml(fullDC, transit, options);
  if (Platform.OS === 'web') {
    await beforeShare?.();
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  await beforeShare?.();
  const dcNo = fullDC?.dc_code || fullDC?.dcNo || String(fullDC?._id || '').slice(-6);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: `Delivery Challan ${dcNo}`.trim(),
    });
  } else {
    await Print.printAsync({ uri });
  }
}
