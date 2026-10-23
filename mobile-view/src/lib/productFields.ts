/**
 * Product form helpers shared by ProductNewScreen / ProductEditScreen.
 * Validation mirrors web components/products/ProductRelatedItemsField.tsx and ProductSpecimenItemsField.tsx.
 */
import type { ProductRelatedItem, ProductSpecimenItem } from './crm/dcRowCategory';
import { productStreamCombos, type StreamCombo } from './crm/iitStreams';

export type { ProductRelatedItem, ProductSpecimenItem, StreamCombo };

/** Web default when a product has no classes saved: 1..12. */
export const DEFAULT_PRODUCT_CLASSES = Array.from({ length: 12 }, (_, i) => String(i + 1));

export const emptyRelatedItem = (): ProductRelatedItem => ({
  name: '',
  billable: false,
  price: 0,
  basis: 'per_student',
  quantity: 1,
});

/** Validation message for the product form, or '' when the items are fine. */
export function relatedItemsError(items: ProductRelatedItem[]): string {
  const names = new Set<string>();
  for (const item of items) {
    const name = String(item.name || '').trim();
    if (!name) return 'Enter a name for every related item, or remove the empty row.';
    if (names.has(name.toLowerCase())) return `Related item "${name}" is listed twice.`;
    names.add(name.toLowerCase());
    if (item.billable && !(Number(item.price) > 0)) return `Enter a price for billable item "${name}".`;
  }
  return '';
}

/** Validation message for the product form, or '' when the specimen set is fine. */
export function specimenItemsError(items: ProductSpecimenItem[]): string {
  const names = new Set<string>();
  for (const item of items) {
    const name = String(item.product || '').trim();
    if (!name) return 'Select a product for every specimen row, or remove the empty row.';
    if (names.has(name.toLowerCase())) return `Specimen product "${name}" is listed twice.`;
    names.add(name.toLowerCase());
  }
  return '';
}

/** Product fields loaded into the edit form (web app/dashboard/products/page.tsx openEdit). */
export function productExtraFieldsFromApi(product: any) {
  return {
    classes:
      Array.isArray(product?.classes) && product.classes.length
        ? product.classes.map((c: any) => String(c))
        : [...DEFAULT_PRODUCT_CLASSES],
    streams: productStreamCombos(product) as StreamCombo[],
    relatedItems: ((product?.relatedItems || []) as ProductRelatedItem[]).map((item) => ({ ...item })),
    specimenItems: ((product?.specimenItems || []) as ProductSpecimenItem[]).map((item) => ({ ...item })),
  };
}

/** Payload fields for POST /products and PUT /products/:id. */
export function productExtraPayload(form: {
  classes: string[];
  streams: StreamCombo[];
  relatedItems: ProductRelatedItem[];
  specimenItems: ProductSpecimenItem[];
}) {
  return {
    classes: form.classes,
    streamCombos: form.streams,
    streams: form.streams.map((combo) => combo.name),
    relatedItems: form.relatedItems,
    specimenItems: form.specimenItems,
  };
}
