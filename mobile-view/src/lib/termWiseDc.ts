/**
 * Term-Wise DC helpers, mirrored from the web page app/dashboard/dc/client-dc/term-wise/page.tsx.
 * A Term-Wise DC (status scheduled_for_later) holds only the rows Close Lead routed to TERM_WISE_DC.
 * Never fall back to the full DcOrder product list: it still has the Term 1 rows.
 */
import { persistProductTerm } from './crm/productTerm';

export type TermWiseRow = {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  term: string;
  level?: string;
  class?: string;
  specs?: string;
  subject?: string;
  category?: string;
  productCategory?: string;
};

export type TermWiseOrderForm = {
  school_name: string;
  contact_person: string;
  contact_mobile: string;
  contact_person2: string;
  contact_mobile2: string;
  email: string;
  address: string;
  school_type: string;
  zone: string;
  location: string;
  pod_proof_url: string;
  remarks: string;
  total_amount: number;
  transport_name: string;
  transport_location: string;
  transportation_landmark: string;
  pincode: string;
  transport_to: string;
  transport_to_name: string;
  transport_to_mobile: string;
};

export function dcOrderIdOf(dc: any): string | null {
  if (!dc) return null;
  if (dc.dcOrderId && typeof dc.dcOrderId === 'object' && dc.dcOrderId._id) return String(dc.dcOrderId._id);
  if (typeof dc.dcOrderId === 'string' && dc.dcOrderId) return dc.dcOrderId;
  return null;
}

/** Rows on this DC that Close Lead routed to Term-Wise DC (all rows on older DCs without routing). */
export function routedTermWiseDetails(details: unknown): any[] {
  const rows = Array.isArray(details) ? details : [];
  return rows.some((p: any) => p?.closeLeadDestination)
    ? rows.filter((p: any) => p?.closeLeadDestination === 'TERM_WISE_DC')
    : rows;
}

/** Comma-separated product names for the list card. */
export function termWiseProductLabel(dc: any): string {
  const names = routedTermWiseDetails(dc?.productDetails)
    .map((p: any) => p.product || p.productName || '')
    .filter(Boolean);
  if (names.length) return names.join(', ');
  return dc?.product || dc?.saleId?.product || '-';
}

/** Order form values; transport reads the pending Edit PO copy first, like the web. */
export function orderToForm(order: any, dc?: any): TermWiseOrderForm {
  const o = order || {};
  const pe = o.pendingEdit || {};
  return {
    school_name: o.school_name || '',
    contact_person: o.contact_person || '',
    contact_mobile: o.contact_mobile || '',
    contact_person2: o.contact_person2 || '',
    contact_mobile2: o.contact_mobile2 || '',
    email: o.email || '',
    address: o.address || '',
    school_type: o.school_type || '',
    zone: o.zone || '',
    location: o.location || '',
    pod_proof_url: o.pod_proof_url || dc?.poPhotoUrl || '',
    remarks: o.remarks || '',
    total_amount: Number(o.total_amount) || 0,
    transport_name: pe.transport_name || o.transport_name || '',
    transport_location: pe.transport_location || o.transport_location || '',
    transportation_landmark: pe.transportation_landmark || o.transportation_landmark || '',
    pincode: pe.pincode || o.pincode || '',
    transport_to: o.transport_to || '',
    transport_to_name: o.transport_to_name || '',
    transport_to_mobile: o.transport_to_mobile || '',
  };
}

const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();

/**
 * Product rows for the Term-Wise DC, priced from the matching order line (same product, and same
 * level / class when both sides have one). `matchClass` is on for Edit PO, off for Request DC (as on the web).
 */
export function termWiseRows(dc: any, order: any, matchClass: boolean): TermWiseRow[] {
  const orderProducts: any[] = Array.isArray(order?.products) ? order.products : [];
  return routedTermWiseDetails(dc?.productDetails).map((p: any, idx: number) => {
    const name = norm(p.product || p.product_name);
    const match = orderProducts.find((op: any) => {
      if (norm(op.product_name) !== name) return false;
      const dl = norm(p.level);
      const ol = norm(op.level);
      if (dl && ol && dl !== ol) return false;
      if (matchClass) {
        const dcClass = norm(p.class);
        const oc = norm(op.class);
        if (dcClass && oc && dcClass !== oc) return false;
      }
      return true;
    });
    return {
      id: String(idx + 1),
      product_name: p.product || p.product_name || '',
      quantity: Number(p.quantity) || Number(p.strength) || 0,
      unit_price: Number(match?.unit_price || p.unit_price || p.price) || 0,
      term: persistProductTerm(p),
      level: p.level,
      class: p.class,
      specs: p.specs,
      subject: p.subject,
      category: p.category,
      productCategory: p.productCategory,
    };
  });
}

export const rowsTotal = (rows: TermWiseRow[]) =>
  rows.reduce((sum, r) => sum + (Number(r.quantity) || 0) * (Number(r.unit_price) || 0), 0);

/** Same check as TransportDetailsSection on the web, plus the fields the app's Request DC gate needs. */
export function termWiseTransportError(form: TermWiseOrderForm, transportToProblem: string): string {
  if (!form.transport_name.trim()) return 'Select the Transport Name.';
  if (!form.transport_location.trim()) return 'Enter the Transport Location.';
  if (!form.transportation_landmark.trim()) return 'Enter the Transportation Landmark (needed before Request DC).';
  const pin = form.pincode.trim();
  if (!pin) return 'Enter the Pincode.';
  if (!/^\d{6}$/.test(pin)) return 'Pincode must be 6 digits.';
  return transportToProblem;
}
