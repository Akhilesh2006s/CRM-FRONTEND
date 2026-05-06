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

  // Get product names array (for backward compatibility)
  const getProductNames = (): string[] => {
    return products.map(p => p.productName)
  }

  // Get product levels for a specific product
  const getProductLevels = (productName: string): string[] => {
    const product = products.find(p => p.productName === productName)
    return product?.productLevels || ['L1'] // Default to L1 if not found
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
    getDefaultLevel,
    isProductActive,
    refetch: loadProducts,
    // Get product specs for a specific product
    getProductSpecs: (productName: string): string[] => {
      const product = products.find(p => p.productName === productName)
      if (product && product.hasSpecs && product.specs && Array.isArray(product.specs)) {
        return product.specs
      }
      return ['Regular', 'Single Level only', 'Class WorkBooks Only'] // Default specs
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
      const product = products.find(p => p.productName === productName)
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

