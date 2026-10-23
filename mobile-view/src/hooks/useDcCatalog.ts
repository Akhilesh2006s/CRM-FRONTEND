/**
 * Product catalogue getters for the DC screens. Delegates to the shared useCatalogProducts hook
 * (mirror of the web hooks/useProducts.ts: GET /products/active).
 */
import { useCatalogProducts, type CatalogProductsApi } from './useCatalogProducts';

export const useDcCatalog = useCatalogProducts;
export type DcCatalog = CatalogProductsApi;
