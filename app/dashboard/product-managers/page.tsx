'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'

type Manager = {
  _id: string
  name: string
  email: string
  phone?: string
  productIds: string[]
}
type Product = {
  _id: string
  name: string
  assignedTo: { _id: string; name: string } | null
}
type Overview = { managers: Manager[]; products: Product[] }

export default function AssignProductsPage() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [manager, setManager] = useState<Manager | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiRequest<Overview>('/product-manager/overview')
      setOverview(data)
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load product assignments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const managers = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const rows = overview?.managers || []
    if (!needle) return rows
    return rows.filter((row) => `${row.name} ${row.email}`.toLowerCase().includes(needle))
  }, [overview, search])

  const productName = (id: string) => overview?.products.find((product) => product._id === id)?.name || id

  const openAssign = (row: Manager) => {
    setManager(row)
    setSelected(row.productIds)
  }

  const toggle = (id: string) => {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  const save = async () => {
    if (!manager) return
    setSaving(true)
    try {
      await apiRequest('/product-manager/assignments', {
        method: 'PUT',
        body: JSON.stringify({ managerId: manager._id, productIds: selected }),
      })
      toast.success('Products assigned')
      setManager(null)
      await load()
    } catch (error: any) {
      toast.error(error?.message || 'Failed to assign products')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Assign products</h1>
        <p className="text-sm text-neutral-500">
          Create the person under Users / Employees with the Product Manager role, then assign their products here. Each product stays with one Product Manager. Saving moves it off the previous manager.
        </p>
      </div>
      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Product Manager" className="max-w-sm" />
      {loading ? <div className="text-neutral-500">Loading…</div> : null}
      <div className="grid gap-3">
        {managers.map((row) => (
          <Card key={row._id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <div className="font-medium">{row.name}</div>
              <div className="text-sm text-neutral-500">{row.email}{row.phone ? ` · ${row.phone}` : ''}</div>
              <div className="mt-1 text-sm text-neutral-700">
                {row.productIds.length ? row.productIds.map(productName).join(', ') : 'No products assigned'}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href={`/dashboard/product-manager/${row._id}`}>View</Link>
              </Button>
              <Button onClick={() => openAssign(row)}>Assign</Button>
            </div>
          </Card>
        ))}
        {!loading && managers.length === 0 ? (
          <Card className="p-4 text-sm text-neutral-500">No Product Managers yet. Add one from New Employee.</Card>
        ) : null}
      </div>

      <Dialog open={Boolean(manager)} onOpenChange={(open) => !open && setManager(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign products to {manager?.name}</DialogTitle>
            <DialogDescription>Only these products will be visible to this Product Manager.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {(overview?.products || []).map((product) => {
              const taken = product.assignedTo && product.assignedTo._id !== manager?._id
              return (
                <label key={product._id} className="flex items-start gap-3 rounded-md border border-neutral-200 p-3 text-sm">
                  <Checkbox checked={selected.includes(product._id)} onCheckedChange={() => toggle(product._id)} />
                  <span>
                    <span className="font-medium">{product.name}</span>
                    {taken ? <span className="block text-xs text-neutral-500">Currently with {product.assignedTo?.name}. Saving moves it here.</span> : null}
                  </span>
                </label>
              )
            })}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setManager(null)}>Cancel</Button>
            <Button disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
