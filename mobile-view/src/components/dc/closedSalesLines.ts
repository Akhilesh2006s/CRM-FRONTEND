/** Closed Sales product-line helpers (mirror of web app/dashboard/dc/closed/page.tsx). */
import { keepMyClientsOwnedProductRows } from '../../lib/crm/clientDcProductRows';
import { CLOSE_LEAD_DESTINATION } from '../../lib/crm/closeLeadTermRouting';

/** Term-Wise / Term 2 DC — never a Closed Sales Raise DC source (web isTermWiseDcRecord). */
export function isTermWiseDcRecord(dc?: any): boolean {
  if (!dc) return false;
  if (dc.status === 'scheduled_for_later') return true;
  const details = Array.isArray(dc.productDetails) ? dc.productDetails : [];
  if (!details.length) return false;
  return details.every(
    (p: any) => String(p?.closeLeadDestination || '').trim() === CLOSE_LEAD_DESTINATION.TERM_WISE_DC,
  );
}

/** Closed Sales Raise DC is the My Clients / Term 1 DC only (web closedSalesOwnedLines). */
function closedSalesOwnedLines(rows: any[], siblingRows: any[] = []): any[] {
  const input = Array.isArray(rows) ? rows : [];
  const withoutExplicitTermWise = input.filter(
    (p) => String(p?.closeLeadDestination || '').trim() !== CLOSE_LEAD_DESTINATION.TERM_WISE_DC,
  );
  return keepMyClientsOwnedProductRows(withoutExplicitTermWise, siblingRows);
}

/** Once a My Clients DC exists, use that DC's lines; else the request / order lines (web resolveClosedSalesProductLines). */
export function resolveClosedSalesProductLines(deal?: any, dc?: any, siblingRows: any[] = []): any[] {
  if (dc?.grid && Array.isArray(dc.productDetails)) return dc.productDetails;
  const sources: any[][] = [];
  if (!isTermWiseDcRecord(dc) && Array.isArray(dc?.productDetails) && dc.productDetails.length > 0) {
    sources.push(dc.productDetails);
  }
  const requested = deal?.dcRequestData?.productDetails;
  if (Array.isArray(requested) && requested.length > 0) sources.push(requested);
  const pe = deal?.pendingEdit;
  if (pe?.status === 'approved' && Array.isArray(pe.products) && pe.products.length > 0) sources.push(pe.products);
  if (Array.isArray(deal?.products) && deal.products.length > 0) sources.push(deal.products);
  for (const src of sources) {
    const owned = closedSalesOwnedLines(src, siblingRows);
    if (owned.length > 0) return owned;
  }
  return [];
}
