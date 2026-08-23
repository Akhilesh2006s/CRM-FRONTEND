import { useState, useEffect } from 'react'
import { apiRequest } from '@/lib/api'
import { normalizeCalculationType, type CalculationType } from '@/lib/paymentDivisor'

type Product = {
  _id: string
  productName: string
  productLevels: string[]
  hasSubjects: boolean
  subjects: string[]
  hasSpecs: boolean
  specs?: string | string[] // Support both old (string) and new (array) format
  hasCategory?: boolean
  categories?: string[]
  prodStatus: number
  calculationType?: 'normal' | 'none' | 'level_based' | 'subject_based'
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiRequest<Product[]>('/products/active')
      setProducts(data || [])
    } catch (err: any) {
      console.error('Failed to load products:', err)
      setError(err?.message || 'Failed to load products')
      // Fallback to empty array on error
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  const getProductNames = (): string[] => {
    return products.map(p => p.productName)
  }

  const findProduct = (productName: string): Product | undefined => {
    const n = String(productName || '').trim().toLowerCase()
    if (!n) return undefined
    return products.find(p => String(p.productName || '').trim().toLowerCase() === n)
  }

  const catalogSpecsFromProduct = (product: Product | undefined): string[] => {
    if (!product) return []
    if (product.hasSpecs === false) return []
    const raw = product.specs
    if (Array.isArray(raw)) {
      return raw.map((s) => String(s || '').trim()).filter(Boolean)
    }
    if (typeof raw === 'string' && raw.trim()) {
      return [raw.trim()]
    }
    return []
  }

  // Get product levels for a specific product
  const getProductLevels = (productName: string): string[] => {
    const product = products.find(p => p.productName === productName)
    if (!product) return ['L1']
    return Array.isArray(product.productLevels)
      ? product.productLevels.map((l) => String(l || '').trim()).filter(Boolean)
      : []
  }

  const hasProductLevels = (productName: string): boolean => {
    const product = products.find(p => p.productName === productName)
    return Array.isArray(product?.productLevels) && product.productLevels.some((l) => String(l || '').trim())
  }

  // Get default level for a product
  const getDefaultLevel = (productName: string): string => {
    const levels = getProductLevels(productName)
    return levels[0] || 'L1'
  }

  // Check if product exists and is active
  const isProductActive = (productName: string): boolean => {
    return products.some(p => p.productName === productName && p.prodStatus === 1)
  }

  return {
    products,
    productNames: getProductNames(),
    loading,
    error,
    getProductLevels,
    hasProductLevels,
    getDefaultLevel,
    isProductActive,
    refetch: loadProducts,
    // Get product specs for a specific product
    getProductSpecs: (productName: string): string[] => {
      return catalogSpecsFromProduct(findProduct(productName))
    },
    hasProductSpecs: (productName: string): boolean => {
      return catalogSpecsFromProduct(findProduct(productName)).length > 0
    },
    // Get product subjects for a specific product
    getProductSubjects: (productName: string): string[] => {
      const product = products.find(p => p.productName === productName)
      if (product && product.hasSubjects && product.subjects && Array.isArray(product.subjects)) {
        return product.subjects
      }
      return [] // No subjects if not configured
    },
    // Check if product has subjects
    hasProductSubjects: (productName: string): boolean => {
      const product = products.find(p => p.productName === productName)
      return product?.hasSubjects === true && product?.subjects && Array.isArray(product.subjects) && product.subjects.length > 0
    },
    // Get product categories for a specific product
    getProductCategories: (productName: string): string[] => {
      const product = products.find(p => p.productName === productName)
      if (product && product.hasCategory && product.categories && Array.isArray(product.categories)) {
        return product.categories
      }
      return [] // No categories if not configured
    },
    // Check if product has categories
    hasProductCategories: (productName: string): boolean => {
      const product = products.find(p => p.productName === productName)
      return product?.hasCategory === true && product?.categories && Array.isArray(product.categories) && product.categories.length > 0
    },
    // Get product _id by name (for API calls that need productId)
    getProductId: (productName: string): string | undefined => {
      const n = String(productName || '').trim().toLowerCase()
      const product = products.find(p => String(p.productName || '').trim().toLowerCase() === n)
      return product?._id
    },
    getCalculationType: (productName: string): CalculationType => {
      const product = products.find(p => p.productName === productName)
      return normalizeCalculationType(product?.calculationType)
    },
    getCatalogFallbackCount: (productName: string, ct: CalculationType): number => {
      const product = products.find(p => p.productName === productName)
      if (!product) return 0
      if (ct === 'level_based')
        return Array.isArray(product.productLevels) ? product.productLevels.length : 0
      if (ct === 'subject_based')
        return Array.isArray(product.subjects) ? product.subjects.length : 0
      return 0
    },
  }
}

