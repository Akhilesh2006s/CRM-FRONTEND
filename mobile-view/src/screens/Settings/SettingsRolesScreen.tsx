import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../../theme/colors';
import { apiService } from '../../services/api';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, WebLabel } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';
import { useAuth } from '../../context/AuthContext';
import { getRoleFlags } from '../../utils/roles';
import { showConfirm } from '../../utils/showAlert';

type Role = {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  isSystem: boolean;
  isActive: boolean;
  permissionKeys?: string[];
};

type PermissionRow = {
  _id: string;
  key: string;
  module: string;
  resource: string;
  action: string;
  type: string;
  label: string;
  group?: string;
};

/** Copied from web lib/nav-permissions.ts MODULE_LABELS. */
const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  clients: 'Clients',
  leads: 'Leads',
  employees: 'Users / Employees',
  leaves: 'Leave Management',
  training: 'Trainings & Services',
  complaints: 'View Tickets',
  warehouse: 'Warehouse',
  returns: 'Stock Returns',
  payments: 'Payments',
  expenses: 'Expenses',
  reports: 'Reports',
  products: 'Products',
  settings: 'Settings',
  executive_managers: 'Zonal Managers',
  hierarchy: 'Hierarchy',
  product_managers: 'Product Managers',
  samples: 'Samples',
  vendor: 'Vendor',
};

/** Copied from web lib/roleLabels.ts (display only; stored role names are unchanged). */
const ROLE_LABELS: Record<string, string> = {
  'Executive Manager': 'Zonal Manager',
  Manager: 'Product Manager',
  Executive: 'BDE',
  'Sales BDE': 'BDE',
  Employee: 'BDE',
};

function displayRoleName(role?: string | null) {
  if (!role) return '';
  return ROLE_LABELS[role] || role;
}

function errMsg(e: any, fallback: string) {
  return e?.response?.data?.message || e?.message || fallback;
}

export default function SettingsRolesScreen({ navigation }: any) {
  const { user } = useAuth();
  const isSuperAdmin = getRoleFlags(user).isSuperAdmin;

  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<PermissionRow[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [cloneFromId, setCloneFromId] = useState('');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const selected = roles.find((r) => r._id === selectedId) || null;

  const loadRoles = useCallback(async () => {
    const data = await apiService.get('/roles');
    const list: Role[] = Array.isArray(data) ? data : data?.roles ?? [];
    setRoles(list);
    setSelectedId((prev) => {
      if (prev && list.some((r) => r._id === prev)) return prev;
      return list.length > 0 ? list[0]._id : null;
    });
    return list;
  }, []);

  const loadCatalog = useCallback(async () => {
    const data = await apiService.get('/roles/permissions/catalog');
    setCatalog(data?.permissions || []);
  }, []);

  useEffect(() => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        await Promise.all([loadRoles(), loadCatalog()]);
      } catch (e: any) {
        setBanner({ type: 'error', message: errMsg(e, 'Failed to load roles') });
      } finally {
        setLoading(false);
      }
    })();
  }, [isSuperAdmin, loadRoles, loadCatalog]);

  useEffect(() => {
    if (!selectedId || !isSuperAdmin) return;
    let cancelled = false;
    setLoadingPerms(true);
    apiService
      .get(`/roles/${selectedId}/permissions`)
      .then((data: { permissionKeys?: string[] }) => {
        if (!cancelled) setChecked(new Set(data?.permissionKeys || []));
      })
      .catch((e: any) => {
        if (!cancelled) setBanner({ type: 'error', message: errMsg(e, 'Failed to load permissions') });
      })
      .finally(() => {
        if (!cancelled) setLoadingPerms(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, isSuperAdmin]);

  const grouped = useMemo(() => {
    const map: Record<string, PermissionRow[]> = {};
    for (const p of catalog) {
      const g = p.group || p.module;
      if (!map[g]) map[g] = [];
      map[g].push(p);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [catalog]);

  const q = filter.trim().toLowerCase();

  const toggleKey = (key: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleModule = (module: string, on: boolean) => {
    const keys = catalog.filter((p) => p.module === module).map((p) => p.key);
    setChecked((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (on ? next.add(k) : next.delete(k)));
      return next;
    });
  };

  const savePermissions = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await apiService.put(`/roles/${selectedId}/permissions`, { permissionKeys: Array.from(checked) });
      setBanner({ type: 'success', message: 'Permissions saved' });
      await loadRoles();
    } catch (e: any) {
      setBanner({ type: 'error', message: errMsg(e, 'Save failed') });
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      setCreateError('Role name is required');
      return;
    }
    setCreating(true);
    try {
      const body: { name: string; cloneFromRoleId?: string } = { name: newName.trim() };
      if (cloneFromId) body.cloneFromRoleId = cloneFromId;
      const created: Role = await apiService.post('/roles', body);
      setBanner({ type: 'success', message: 'Role created' });
      setCreateOpen(false);
      setNewName('');
      setCloneFromId('');
      await loadRoles();
      if (created?._id) setSelectedId(created._id);
    } catch (e: any) {
      setCreateError(errMsg(e, 'Create failed'));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (role: Role) => {
    if (role.isSystem) {
      setBanner({ type: 'error', message: 'System roles cannot be deleted' });
      return;
    }
    showConfirm(
      'Delete role',
      `Delete role "${displayRoleName(role.name)}"?`,
      async () => {
        try {
          await apiService.delete(`/roles/${role._id}`);
          setBanner({ type: 'success', message: 'Role deleted' });
          if (selectedId === role._id) setSelectedId(null);
          await loadRoles();
        } catch (e: any) {
          setBanner({ type: 'error', message: errMsg(e, 'Delete failed') });
        }
      },
      'Delete'
    );
  };

  if (!isSuperAdmin) {
    return (
      <ScreenShell title="Roles & Permissions">
        <View style={styles.denied}>
          <Ionicons name="lock-closed-outline" size={36} color={colors.textMuted} />
          <Text style={styles.deniedText}>Super Admin access required</Text>
          <WebButton
            title="Go back"
            variant="outline"
            onPress={() => (navigation?.canGoBack?.() ? navigation.goBack() : navigation?.navigate?.('MainTabs'))}
          />
        </View>
      </ScreenShell>
    );
  }

  const checkedCount = checked.size;

  return (
    <ScreenShell
      title="Roles & Permissions"
      subtitle="Users inherit permissions from their assigned role."
      loading={loading}
    >
      {banner ? (
        <MessageBanner type={banner.type} message={banner.message} onDismiss={() => setBanner(null)} />
      ) : null}

      <Text style={styles.help}>
        After you save permissions, assign the role on Active Employees, then have that user sign out and sign in so
        their menu and pages update.
      </Text>

      <View style={styles.panel}>
        <WebSelect
          label="Role"
          value={selectedId || ''}
          onValueChange={(v) => setSelectedId(v || null)}
          placeholder={roles.length ? 'Select a role' : 'No roles'}
          items={roles.map((r) => ({
            value: r._id,
            label: `${displayRoleName(r.name)}${r.isSystem ? ' (System template)' : ''}`,
          }))}
        />
        <WebButton
          title="Create role"
          variant="outline"
          onPress={() => {
            setCreateError('');
            setCreateOpen(true);
          }}
        />
      </View>

      {!selected ? (
        <Text style={styles.empty}>Select a role to edit permissions.</Text>
      ) : (
        <>
          <View style={styles.roleHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.roleName}>{displayRoleName(selected.name)}</Text>
              <Text style={styles.roleSlug}>
                {selected.slug}
                {selected.isSystem ? ' · System template' : ''}
              </Text>
              <Text style={styles.roleSlug}>{checkedCount} permissions selected</Text>
            </View>
            {!selected.isSystem ? (
              <TouchableOpacity onPress={() => handleDelete(selected)} style={styles.deleteBtn} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={colors.error} />
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <WebInput placeholder="Filter permissions" value={filter} onChangeText={setFilter} autoCapitalize="none" />

          {loadingPerms ? <Text style={styles.empty}>Loading permissions…</Text> : null}

          {!loadingPerms &&
            grouped.map(([group, perms]) => {
              const module = perms[0]?.module || group;
              const moduleLabel = MODULE_LABELS[module] || module;
              const allOn = perms.every((p) => checked.has(p.key));
              const onCount = perms.filter((p) => checked.has(p.key)).length;
              const visible = q
                ? perms.filter(
                    (p) => p.label.toLowerCase().includes(q) || p.key.toLowerCase().includes(q)
                  )
                : perms;
              if (q && visible.length === 0) return null;
              const isOpen = q ? true : !!expanded[group];
              return (
                <View key={group} style={styles.group}>
                  <TouchableOpacity
                    style={styles.groupHead}
                    onPress={() => setExpanded((s) => ({ ...s, [group]: !s[group] }))}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={isOpen ? 'chevron-down' : 'chevron-forward'} size={18} color={colors.textSecondary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.groupTitle}>{moduleLabel}</Text>
                      <Text style={styles.groupCount}>
                        {onCount}/{perms.length} selected
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => toggleModule(module, !allOn)} hitSlop={8}>
                      <Text style={styles.groupAction}>{allOn ? 'Clear module' : 'Select module'}</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                  {isOpen
                    ? visible.map((p) => {
                        const on = checked.has(p.key);
                        return (
                          <TouchableOpacity
                            key={p.key}
                            style={styles.permRow}
                            onPress={() => toggleKey(p.key)}
                            activeOpacity={0.7}
                          >
                            <Ionicons
                              name={on ? 'checkbox' : 'square-outline'}
                              size={22}
                              color={on ? colors.primary : colors.textMuted}
                            />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.permLabel}>{p.label}</Text>
                              <Text style={styles.permKey}>{p.key}</Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })
                    : null}
                </View>
              );
            })}

          <View style={styles.saveBar}>
            <WebButton
              title={saving ? 'Saving…' : 'Save permissions'}
              onPress={savePermissions}
              disabled={saving || loadingPerms}
              loading={saving}
            />
          </View>
        </>
      )}

      <Modal visible={createOpen} transparent animationType="fade" onRequestClose={() => setCreateOpen(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Create role</Text>
            <Text style={styles.dialogDesc}>Optionally clone permissions from an existing system template.</Text>
            <WebLabel>Role name</WebLabel>
            <WebInput
              value={newName}
              onChangeText={(v) => {
                setNewName(v);
                if (createError) setCreateError('');
              }}
              placeholder="e.g. Finance Manager (Custom)"
            />
            <WebSelect
              label="Clone from (optional)"
              value={cloneFromId}
              onValueChange={setCloneFromId}
              placeholder="— None —"
              items={roles.map((r) => ({ value: r._id, label: r.name }))}
            />
            {cloneFromId ? (
              <TouchableOpacity onPress={() => setCloneFromId('')}>
                <Text style={styles.clearClone}>Clear clone selection</Text>
              </TouchableOpacity>
            ) : null}
            {roles.length === 0 ? (
              <Text style={styles.warn}>No roles loaded from API. Check that you are signed in as Super Admin.</Text>
            ) : null}
            {createError ? <Text style={styles.errorText}>{createError}</Text> : null}
            <View style={styles.actions}>
              <View style={{ flex: 1 }}>
                <WebButton title="Cancel" variant="outline" onPress={() => setCreateOpen(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <WebButton title="Create" onPress={handleCreate} loading={creating} disabled={creating} />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  help: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: spacing.md },
  panel: {
    backgroundColor: colors.backgroundLight,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  empty: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.lg },
  roleHead: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm, gap: 8 },
  roleName: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  roleSlug: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.errorLight,
    borderRadius: radii.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  deleteText: { color: colors.error, fontWeight: '600', fontSize: 13 },
  group: {
    backgroundColor: colors.backgroundLight,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  groupTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  groupCount: { fontSize: 12, color: colors.textTertiary, marginTop: 1 },
  groupAction: { fontSize: 13, fontWeight: '600', color: colors.primaryDark },
  permRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  permLabel: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  permKey: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  saveBar: { marginTop: spacing.sm },
  denied: { alignItems: 'center', paddingVertical: spacing.xl, gap: 12 },
  deniedText: { fontSize: 15, color: colors.textSecondary },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', padding: spacing.md },
  dialog: { backgroundColor: colors.backgroundLight, borderRadius: radii.lg, padding: spacing.md },
  dialogTitle: { fontSize: 17, fontWeight: '600', color: colors.textPrimary },
  dialogDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 4, marginBottom: 12 },
  clearClone: { fontSize: 13, color: colors.primaryDark, marginTop: -6, marginBottom: 8 },
  warn: { fontSize: 12, color: colors.warning, marginBottom: 8 },
  errorText: { color: colors.error, fontSize: 13, marginBottom: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
});
