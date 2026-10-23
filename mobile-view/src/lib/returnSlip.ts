/**
 * Mobile port of web lib/returnSlipPdf.ts — renders the Stock Return Slip as HTML,
 * turns it into a PDF with expo-print and opens the share / print sheet.
 */
import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export type ReturnSlipLine = {
  product?: string;
  class?: string;
  productCategory?: string;
  level?: string;
  subject?: string;
  specs?: string;
  soldQty?: number;
  returnQty?: number;
  receivedQty?: number;
  condition?: string;
  reason?: string;
  remarks?: string;
};

export type ReturnSlipData = {
  returnId?: string;
  saleId?: string;
  returnType?: string;
  status?: string;
  executiveName?: string;
  customerName?: string;
  schoolCode?: string;
  returnDate?: string;
  lrNumber?: string;
  transport?: string;
  products?: ReturnSlipLine[];
};

export type ReturnSlipOptions = {
  /** Warehouse layout: Return / Received / Condition columns (web `showReceived`). */
  showReceived?: boolean;
  /** Warehouse executive never sees the BDE's return qty — drop that column entirely. */
  hideReturnQty?: boolean;
};

const text = (v: unknown) => (v == null || v === '' ? '-' : String(v));

const esc = (v: unknown) =>
  text(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function buildReturnSlipHtml(ret: ReturnSlipData, opts: ReturnSlipOptions = {}): string {
  const products = ret.products || [];
  const showReceived = !!opts.showReceived;
  const hideReturn = showReceived && !!opts.hideReturnQty;

  const left: Array<[string, unknown]> = [
    ['Return ID', ret.returnId],
    ['Sale / DC', ret.saleId],
    ['Return Type', ret.returnType],
    ['Status', ret.status],
  ];
  const right: Array<[string, unknown]> = [
    ['School', ret.customerName],
    ['School Code', ret.schoolCode],
    ['BDE', ret.executiveName],
    ['Return Date', ret.returnDate ? new Date(ret.returnDate).toLocaleDateString('en-IN') : ''],
  ];
  const headerRows = left
    .map(
      (l, i) =>
        `<tr><th>${esc(l[0])}:</th><td>${esc(l[1])}</td><th>${esc(right[i]?.[0] ?? '')}:</th><td>${esc(right[i]?.[1])}</td></tr>`
    )
    .join('');
  const lrRow =
    ret.lrNumber || ret.transport
      ? `<tr><th>LR / Transport:</th><td colspan="3">${esc(ret.lrNumber)} / ${esc(ret.transport)}</td></tr>`
      : '';

  let cols: string[];
  let rowValues: (p: ReturnSlipLine, idx: number) => unknown[];
  if (showReceived) {
    cols = ['#', 'Product', 'Class', 'Series', 'Deliverables', ...(hideReturn ? [] : ['Return']), 'Received', 'Condition'];
    rowValues = (p, idx) => [
      idx + 1,
      p.product,
      p.class,
      p.productCategory,
      p.subject || p.specs,
      ...(hideReturn ? [] : [p.returnQty]),
      p.receivedQty,
      p.condition,
    ];
  } else {
    cols = ['#', 'Product', 'Class', 'Series', 'Term/Level', 'Deliverables', 'Return Qty', 'Reason'];
    rowValues = (p, idx) => [idx + 1, p.product, p.class, p.productCategory, p.level, p.subject || p.specs, p.returnQty, p.reason];
  }

  const body = products
    .map((p, idx) => `<tr>${rowValues(p, idx).map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`)
    .join('');
  const totalReturn = products.reduce((s, p) => s + (Number(p.returnQty) || 0), 0);
  const totalReceived = products.reduce((s, p) => s + (Number(p.receivedQty) || 0), 0);
  const totals = hideReturn
    ? `Total lines: ${products.length} &nbsp;&nbsp; Total received qty: ${totalReceived}`
    : `Total lines: ${products.length} &nbsp;&nbsp; Total return qty: ${totalReturn}${showReceived ? ` &nbsp;&nbsp; Total received qty: ${totalReceived}` : ''}`;

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  @page { size: A4; margin: 12mm; }
  body { font-family: Helvetica, Arial, sans-serif; font-size: 11px; color: #111; }
  h1 { text-align: center; font-size: 18px; margin: 0 0 12px; }
  table.meta { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  table.meta th { text-align: left; white-space: nowrap; padding: 3px 6px 3px 0; width: 1%; }
  table.meta td { padding: 3px 16px 3px 0; }
  table.lines { width: 100%; border-collapse: collapse; }
  table.lines th { background: #ebebeb; text-align: left; padding: 5px 4px; border: 1px solid #ccc; }
  table.lines td { padding: 4px; border: 1px solid #ddd; vertical-align: top; }
  .totals { font-weight: bold; margin-top: 10px; }
  .sign { display: flex; justify-content: space-between; margin-top: 48px; }
</style></head>
<body>
  <h1>Stock Return Slip</h1>
  <table class="meta">${headerRows}${lrRow}</table>
  <table class="lines">
    <thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${body || `<tr><td colspan="${cols.length}">No lines</td></tr>`}</tbody>
  </table>
  <div class="totals">${totals}</div>
  <div class="sign">
    <span>BDE signature: ____________________</span>
    <span>Warehouse signature: ____________________</span>
  </div>
</body></html>`;
}

/** Build the slip and open the native print / share sheet (web: browser print dialog). */
export async function printReturnSlip(ret: ReturnSlipData, opts: ReturnSlipOptions = {}): Promise<void> {
  const html = buildReturnSlipHtml(ret, opts);
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: `Stock Return Slip ${ret.returnId || ''}`.trim(),
    });
  } else {
    await Print.printAsync({ uri });
  }
}
