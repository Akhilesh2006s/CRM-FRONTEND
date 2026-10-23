/**
 * Active product catalog (GET /products/active) with the same getters as the web
 * `hooks/useProducts.ts`, so the shared CRM rules in `lib/crm` get identical inputs.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiService } from '../services/api';
import { normalizeCalculationType, type CalculationType } from '../lib/crm/paymentDivisor';
import type { ProductRelatedItem, ProductSpecimenItem } from '../lib/crm/dcRowCategory';
import { productStreamCombos, type StreamCombo } from '../lib/crm/iitStreams';

export type CatalogProduct = {
  _id: string;
  productName: string;
  productLevels: string[];
  classes?: string[];
  hasSubjects: boolean;
  subjects: string[];
  hasSpecs: boolean;
  specs?: string | string[];
  hasCategory?: boolean;
  categories?: string[];
  streams?: string[];
  streamCombos?: StreamCombo[];
  relatedItems?: ProductRelatedItem[];
  specimenItems?: ProductSpecimenItem[];
  prodStatus: number;
  calculationType?: 'normal' | 'none' | 'level_based' | 'subject_based';
};

function toList(data: any): CatalogProduct[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.products)) return data.products;
  return [];
}

export function useCatalogProducts() {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.get('/products/active');
      setProducts(toList(data));
    } catch (err: any) {
      setError(err?.message || 'Failed to load products');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  return useMemo(() => {
    const findProduct = (productName: string): CatalogProduct | undefined => {
      const n = String(productName || '').trim().toLowerCase();
      if (!n) return undefined;
      return products.find((p) => String(p.productName || '').trim().toLowerCase() === n);
    };

    const catalogSpecsFromProduct = (product: CatalogProduct | undefined): string[] => {
      if (!product) return [];
      if (product.hasSpecs === false) return [];
      const raw = product.specs;
      if (Array.isArray(raw)) return raw.map((s) => String(s || '').trim()).filter(Boolean);
      if (typeof raw === 'string' && raw.trim()) return [raw.trim()];
      return [];
    };

    const getProductLevels = (productName: string): string[] => {
      const product = findProduct(productName);
      if (!product) return [];
      return Array.isArray(product.productLevels)
        ? product.productLevels.map((l) => String(l || '').trim()).filter(Boolean)
        : [];
    };

    const getDefaultLevel = (productName: string): string => getProductLevels(productName)[0] || '';

    return {
      products,
      productNames: products.map((p) => p.productName),
      loading,
      error,
      refetch: loadProducts,
      findProduct,
      getProductLevels,
      hasProductLevels: (productName: string) => getProductLevels(productName).length > 0,
      getDefaultLevel,
      isProductActive: (productName: string) => findProduct(productName)?.prodStatus === 1,
      getProductClasses: (productName: string): string[] => {
        const classes = findProduct(productName)?.classes;
        return Array.isArray(classes) && classes.length > 0
          ? classes.map((value) => String(value).trim()).filter(Boolean)
          : Array.from({ length: 12 }, (_, index) => String(index + 1));
      },
      getProductSpecs: (productName: string): string[] => catalogSpecsFromProduct(findProduct(productName)),
      hasProductSpecs: (productName: string): boolean =>
        catalogSpecsFromProduct(findProduct(productName)).length > 0,
      getProductSubjects: (productName: string): string[] => {
        const product = findProduct(productName);
        if (product && product.hasSubjects && Array.isArray(product.subjects)) return product.subjects;
        return [];
      },
      hasProductSubjects: (productName: string): boolean => {
        const product = findProduct(productName);
        return Boolean(
          product?.hasSubjects === true && Array.isArray(product?.subjects) && product.subjects.length > 0,
        );
      },
      getProductStreamCombos: (productName: string): StreamCombo[] =>
        productStreamCombos(findProduct(productName)),
      getProductStreams: (productName: string): string[] => {
        const product = findProduct(productName);
        return Array.isArray(product?.streams) ? product!.streams!.filter(Boolean) : [];
      },
      getProductRelatedItems: (productName: string): ProductRelatedItem[] => {
        const items = findProduct(productName)?.relatedItems;
        return Array.isArray(items) ? items.filter((item) => item && String(item.name || '').trim()) : [];
      },
      getProductSpecimenItems: (productName: string): ProductSpecimenItem[] => {
        const items = findProduct(productName)?.specimenItems;
        return Array.isArray(items) ? items.filter((item) => item && String(item.product || '').trim()) : [];
      },
      getProductCategories: (productName: string): string[] => {
        const product = findProduct(productName);
        if (product && product.hasCategory && Array.isArray(product.categories)) return product.categories;
        return [];
      },
      hasProductCategories: (productName: string): boolean => {
        const product = findProduct(productName);
        return Boolean(
          product?.hasCategory === true && Array.isArray(product?.categories) && product.categories.length > 0,
        );
      },
      getProductId: (productName: string): string | undefined => findProduct(productName)?._id,
      getCalculationType: (productName: string): CalculationType =>
        normalizeCalculationType(findProduct(productName)?.calculationType),
      getCatalogFallbackCount: (productName: string, ct: CalculationType): number => {
        const product = findProduct(productName);
        if (!product) return 0;
        if (ct === 'level_based') return Array.isArray(product.productLevels) ? product.productLevels.length : 0;
        if (ct === 'subject_based') return Array.isArray(product.subjects) ? product.subjects.length : 0;
        return 0;
      },
    };
  }, [products, loading, error, loadProducts]);
}

export type CatalogProductsApi = ReturnType<typeof useCatalogProducts>;
