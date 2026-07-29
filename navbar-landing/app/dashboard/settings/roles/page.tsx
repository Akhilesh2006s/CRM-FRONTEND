'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { apiRequest } from '@/lib/api'
import { usePermissions } from '@/components/permissions/PermissionsProvider'
import { MODULE_LABELS } from '@/lib/nav-permissions'
import { toast } from 'sonner'
import { Copy, Plus, RefreshCw, Trash2 } from 'lucide-react'

type Role = {
  _id: string
  name: string
  slug: string
  description?: string
  isSystem: boolean
  isActive: boolean
  permissionKeys?: string[]
}

type PermissionRow = {
  _id: string
  key: string
  module: string
  resource: string
  action: string
  type: string
  label: string
  group?: string
}

export default function RolesPermissionsPage() {
  const router = useRouter()
  const { isSuperAdmin, rbacActive, refreshPermissions } = usePermissions()
  const [refreshingPerms, setRefreshingPerms] = useState(false)
  const [roles, setRoles] = useState<Role[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [catalog, setCatalog] = useState<PermissionRow[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [cloneFromId, setCloneFromId] = useState<string>('')

  const selected = roles.find((r) => r._id === selectedId) || null

  const loadRoles = useCallback(async () => {
    const data = await apiRequest<Role[] | { roles?: Role[] }>('/roles')
    const list = Array.isArray(data) ? data : data?.roles ?? []
    setRoles(list)
    setSelectedId((prev) => prev ?? (list.length > 0 ? list[0]._id : null))
    return list
  }, [])

  const loadCatalog = useCallback(async () => {
    const data = await apiRequest<{ permissions: PermissionRow[] }>('/roles/permissions/catalog')
    setCatalog(data.permissions || [])
  }, [])

  const loadRolePermissions = useCallback(async (roleId: string) => {
    const data = await apiRequest<{ permissionKeys: string[] }>(`/roles/${roleId}/permissions`)
    setChecked(new Set(data.permissionKeys || []))
  }, [])

  useEffect(() => {
    if (!isSuperAdmin) {
      toast.error('Super Admin access required')
      router.replace('/dashboard')
      return
    }
    ;(async () => {
      setLoading(true)
      try {
        await Promise.all([loadRoles(), loadCatalog()])
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Failed to load roles')
      } finally {
        setLoading(false)
      }
    })()
  }, [isSuperAdmin, router, loadRoles, loadCatalog])

  useEffect(() => {
    if (!selectedId) return
    loadRolePermissions(selectedId).catch((e: unknown) => {
      toast.error(e instanceof Error ? e.message : 'Failed to load permissions')
    })
  }, [selectedId, loadRolePermissions])

  const grouped = useMemo(() => {
    const map: Record<string, PermissionRow[]> = {}
    for (const p of catalog) {
      const g = p.group || p.module
      if (!map[g]) map[g] = []
      map[g].push(p)
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [catalog])

  const toggleKey = (key: string, on: boolean) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })
  }

  const toggleModule = (module: string, on: boolean) => {
    const keys = catalog.filter((p) => p.module === module).map((p) => p.key)
    setChecked((prev) => {
      const next = new Set(prev)
      keys.forEach((k) => (on ? next.add(k) : next.delete(k)))
      return next
    })
  }

  const savePermissions = async () => {
    if (!selectedId) return
    setSaving(true)
    try {
      await apiRequest(`/roles/${selectedId}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissionKeys: Array.from(checked) }),
      })
      toast.success('Permissions saved')
      await loadRoles()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error('Role name is required')
      return
    }
    try {
      const body: { name: string; cloneFromRoleId?: string } = { name: newName.trim() }
      if (cloneFromId) body.cloneFromRoleId = cloneFromId
      const created = await apiRequest<Role>('/roles', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      toast.success('Role created')
      setCreateOpen(false)
      setNewName('')
      setCloneFromId('')
      await loadRoles()
      setSelectedId(created._id)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Create failed')
    }
  }

  const handleDelete = async (role: Role) => {
    if (role.isSystem) {
      toast.error('System roles cannot be deleted')
      return
    }
    if (!confirm(`Delete role "${role.name}"?`)) return
    try {
      await apiRequest(`/roles/${role._id}`, { method: 'DELETE' })
      toast.success('Role deleted')
      if (selectedId === role._id) setSelectedId(null)
      await loadRoles()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  if (!isSuperAdmin) {
    return null
  }

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Roles & Permissions</h1>
          <p className="text-neutral-600 mt-1">
            Manage role templates and permission keys. Users inherit permissions from their assigned role.
          </p>
          <p className="text-sm text-neutral-500 mt-2 max-w-2xl">
            After you save permissions, assign the role on Active Employees, then have that user{' '}
            <strong>sign out and sign in</strong> so their menu and pages update. You can refresh your
            own session below without signing out. See <code className="text-xs bg-neutral-100 px-1 rounded">docs/RBAC-ROADMAP.md</code> in the repo for rollout status.
          </p>
          {!rbacActive && (
            <p className="text-amber-700 text-sm mt-1">
              RBAC is inactive until users log in again with permissions loaded.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={refreshingPerms}
            onClick={async () => {
              setRefreshingPerms(true)
              try {
                await refreshPermissions()
                toast.success('Your permissions were refreshed from the server.')
              } catch (e: unknown) {
                toast.error(e instanceof Error ? e.message : 'Refresh failed')
              } finally {
                setRefreshingPerms(false)
              }
            }}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshingPerms ? 'animate-spin' : ''}`} />
            {refreshingPerms ? 'Refreshing…' : 'Refresh my permissions'}
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create role
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <Card className="p-3 h-fit max-h-[70vh] overflow-y-auto">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide px-2 py-2">Roles</p>
          {loading && <p className="px-2 text-sm text-neutral-500">Loading…</p>}
          {!loading &&
            roles.map((role) => (
              <button
                key={role._id}
                type="button"
                onClick={() => setSelectedId(role._id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 ${
                  selectedId === role._id
                    ? 'bg-neutral-900 text-white'
                    : 'hover:bg-neutral-100 text-neutral-800'
                }`}
              >
                <span className="font-medium">{role.name}</span>
                {role.isSystem && (
                  <span className={`block text-xs ${selectedId === role._id ? 'text-neutral-300' : 'text-neutral-500'}`}>
                    System template
                  </span>
                )}
              </button>
            ))}
        </Card>

        <Card className="p-4 md:p-6">
          {!selected ? (
            <p className="text-neutral-500">Select a role to edit permissions.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-semibold">{selected.name}</h2>
                  <p className="text-sm text-neutral-500">{selected.slug}</p>
                </div>
                <div className="flex gap-2">
                  {!selected.isSystem && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-200"
                      onClick={() => handleDelete(selected)}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  )}
                  <Button onClick={savePermissions} disabled={saving}>
                    {saving ? 'Saving…' : 'Save permissions'}
                  </Button>
                </div>
              </div>

              <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                {grouped.map(([group, perms]) => {
                  const module = perms[0]?.module || group
                  const moduleLabel = MODULE_LABELS[module] || module
                  const allOn = perms.every((p) => checked.has(p.key))
                  return (
                    <div key={group} className="border border-neutral-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium text-neutral-900">{moduleLabel}</h3>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleModule(module, !allOn)}
                        >
                          {allOn ? 'Clear module' : 'Select module'}
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {perms.map((p) => (
                          <label
                            key={p.key}
                            className="flex items-start gap-2 text-sm cursor-pointer rounded-md p-2 hover:bg-neutral-50"
                          >
                            <Checkbox
                              checked={checked.has(p.key)}
                              onCheckedChange={(v) => toggleKey(p.key, v === true)}
                            />
                            <span>
                              <span className="font-medium text-neutral-800">{p.label}</span>
                              <span className="block text-xs text-neutral-500 font-mono">{p.key}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </Card>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create role</DialogTitle>
            <DialogDescription>
              Optionally clone permissions from an existing system template.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Role name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Finance Manager (Custom)" />
            </div>
            <div>
              <Label>Clone from (optional)</Label>
              <select
                className="w-full mt-1 border rounded-md h-10 px-3 text-sm"
                value={cloneFromId}
                onChange={(e) => setCloneFromId(e.target.value)}
              >
                <option value="">— None —</option>
                {roles.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.name}
                  </option>
                ))}
              </select>
              {roles.length === 0 && (
                <p className="text-xs text-amber-700 mt-1">
                  No roles loaded from API. Check Network → GET /api/roles (Super Admin + backend on port 5001).
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>
              <Copy className="w-4 h-4 mr-2" />
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
