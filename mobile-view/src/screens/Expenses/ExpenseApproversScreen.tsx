import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../../theme/colors';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { showConfirm } from '../../utils/showAlert';

type Scope = 'employee' | 'cluster' | 'zone' | 'all';

type UserRow = {
  _id: string;
  name: string;
  empCode?: string;
  role?: string;
  zone?: string;
  cluster?: string;
  executiveManagerId?: string | { _id?: string } | null;
};

type Zone = { _id: string; name: string };
type Cluster = { _id: string; name: string; zoneId?: { _id: string; name: string } | null };

type ApproverTag = {
  _id: string;
  scope: Scope;
  employeeId?: UserRow | null;
  cluster?: string;
  zone?: string;
  approverId?: UserRow | null;
  createdBy?: { name: string } | null;
  createdAt: string;
};

const SCOPE_LABELS: Record<Scope, string> = {
  employee: 'Single / selected employees',
  cluster: 'All employees in a cluster',
  zone: 'All employees in a zone',
  all: 'All employees',
};

const personLabel = (u?: UserRow | null) =>
  u ? `${u.name}${u.empCode ? ` (${u.empCode})` : ''}${u.role ? ` · ${u.role}` : ''}` : 'Unknown';

const targetLabel = (tag: ApproverTag) => {
  switch (tag.scope) {
    case 'employee':
      return personLabel(tag.employeeId);
    case 'cluster':
      return `Cluster: ${tag.cluster}`;
    case 'zone':
      return `Zone: ${tag.zone}`;
    default:
      return 'All employees';
  }
};

const asArray = (d: any) => (Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : []);

/** Web: app/dashboard/expenses/approvers/page.tsx — first-level expense approver tags. */
export default function ExpenseApproversScreen() {
  const { user } = useAuth();
  const [tags, setTags] = useState<ApproverTag[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [scope, setScope] = useState<Scope>('employee');
  const [employeeIds, setEmployeeIds] = useState<string[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [zone, setZone] = useState('');
  const [cluster, setCluster] = useState('');
  const [approverId, setApproverId] = useState('');

  const loadTags = useCallback(async () => {
    try {
      setTags(asArray(await apiService.get('/expenses/approver-tags')));
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.message || 'Failed to load approver tags' });
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [userData, zoneData, clusterData] = await Promise.all([
        apiService.get('/employees?isActive=true').catch(() => []),
        apiService.get('/zones').catch(() => []),
        apiService.get('/clusters').catch(() => []),
        loadTags(),
      ]);
      setUsers(
        asArray(userData)
          .slice()
          .sort((a: UserRow, b: UserRow) => String(a.name || '').localeCompare(String(b.name || '')))
      );
      setZones(asArray(zoneData));
      setClusters(asArray(clusterData));
      setLoading(false);
    })();
  }, [loadTags]);

  // A Zonal Manager assigns approvers only for the BDEs in their own team.
  const isZonalManager = user?.role === 'Executive Manager';
  const assignableEmployees = useMemo(() => {
    if (!isZonalManager) return users;
    const me = String((user as any)?._id || (user as any)?.id || '');
    return users.filter((u) => {
      const zm = u.executiveManagerId;
      return String(typeof zm === 'object' && zm ? zm._id : zm || '') === me;
    });
  }, [users, isZonalManager, user]);

  const filteredEmployees = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase();
    if (!q) return assignableEmployees;
    return assignableEmployees.filter((u) =>
      [u.name, u.empCode, u.role, u.zone, u.cluster].some((v) => String(v || '').toLowerCase().includes(q))
    );
  }, [assignableEmployees, employeeSearch]);

  const toggleEmployee = (id: string) =>
    setEmployeeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const resetForm = () => {
    setEmployeeIds([]);
    setEmployeeSearch('');
    setZone('');
    setCluster('');
    setApproverId('');
  };

  const handleSave = async () => {
    setMessage(null);
    if (!approverId) return setMessage({ type: 'error', text: 'Select the approver' });
    if (scope === 'employee' && employeeIds.length === 0) return setMessage({ type: 'error', text: 'Select at least one employee' });
    if (scope === 'cluster' && !cluster) return setMessage({ type: 'error', text: 'Select the cluster' });
    if (scope === 'zone' && !zone) return setMessage({ type: 'error', text: 'Select the zone' });
    setSaving(true);
    try {
      await apiService.post('/expenses/approver-tags', { scope, approverId, employeeIds, cluster, zone });
      setMessage({ type: 'success', text: 'Expense approver assigned' });
      resetForm();
      loadTags();
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.message || 'Failed to assign approver' });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = (tag: ApproverTag) => {
    showConfirm(
      'Remove approver',
      `Remove ${tag.approverId?.name || 'this approver'} for ${targetLabel(tag)}?`,
      async () => {
        try {
          await apiService.delete(`/expenses/approver-tags/${tag._id}`);
          setMessage({ type: 'success', text: 'Approver tag removed' });
          loadTags();
        } catch (e: any) {
          setMessage({ type: 'error', text: e?.response?.data?.message || e?.message || 'Failed to remove tag' });
        }
      },
      'Remove'
    );
  };

  const scopeOptions = (isZonalManager ? (['employee'] as Scope[]) : (Object.keys(SCOPE_LABELS) as Scope[])).map((s) => ({
    label: SCOPE_LABELS[s],
    value: s,
  }));

  return (
    <ScreenShell title="Expense Approvers" loading={loading}>
      <Text style={styles.intro}>
        By default, BDE expenses go to their Zonal Manager and everyone else's go to Admin for first-level approval, then
        to the Finance Manager for final approval. Tag any user to take over first-level approval for an employee, a
        cluster, a zone, or everyone. The most specific tag wins (employee, then cluster, then zone, then all employees);
        within the same level the newest tag wins.
      </Text>

      {message ? <MessageBanner type={message.type} message={message.text} onDismiss={() => setMessage(null)} /> : null}

      <View style={styles.card}>
        <WebSelect label="Route expenses of" value={scope} onValueChange={(v) => setScope((v || 'employee') as Scope)} items={scopeOptions} />
        <WebSelect
          label="To approver"
          value={approverId}
          onValueChange={setApproverId}
          placeholder="Select any user"
          items={users.map((u) => ({ label: personLabel(u), value: u._id }))}
        />

        {scope === 'cluster' && (
          <WebSelect
            label="Cluster"
            value={cluster}
            onValueChange={setCluster}
            placeholder="Select cluster"
            items={clusters.map((c) => ({ label: `${c.name}${c.zoneId?.name ? ` (${c.zoneId.name})` : ''}`, value: c.name }))}
          />
        )}
        {scope === 'zone' && (
          <WebSelect
            label="Zone"
            value={zone}
            onValueChange={setZone}
            placeholder="Select zone"
            items={zones.map((z) => ({ label: z.name, value: z.name }))}
          />
        )}

        {scope === 'employee' && (
          <View>
            <View style={styles.rowBetween}>
              <Text style={styles.label}>Employees ({employeeIds.length} selected)</Text>
              {employeeIds.length > 0 ? (
                <TouchableOpacity onPress={() => setEmployeeIds([])}>
                  <Text style={styles.link}>Clear selection</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <WebInput
              value={employeeSearch}
              onChangeText={setEmployeeSearch}
              placeholder="Search by name, code, role, zone or cluster"
            />
            <ScrollView style={styles.employeeList} nestedScrollEnabled>
              {filteredEmployees.length === 0 ? (
                <Text style={styles.emptySmall}>No matching employees</Text>
              ) : (
                filteredEmployees.map((u) => {
                  const checked = employeeIds.includes(u._id);
                  const disabled = u._id === approverId;
                  return (
                    <TouchableOpacity
                      key={u._id}
                      style={[styles.employeeRow, disabled && { opacity: 0.4 }]}
                      onPress={() => !disabled && toggleEmployee(u._id)}
                      disabled={disabled}
                    >
                      <Ionicons
                        name={checked ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={checked ? colors.primary : colors.textMuted}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.employeeName}>{personLabel(u)}</Text>
                        {u.zone || u.cluster ? (
                          <Text style={styles.employeeMeta}>{[u.cluster, u.zone].filter(Boolean).join(' · ')}</Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        )}

        <View style={{ marginTop: 12 }}>
          <WebButton title={saving ? 'Saving...' : 'Assign approver'} onPress={handleSave} loading={saving} disabled={saving} />
        </View>
      </View>

      <Text style={styles.sectionTitle}>Approver tags</Text>
      {tags.length === 0 ? (
        <Text style={styles.empty}>No approver tags. Default routing applies to everyone.</Text>
      ) : (
        tags.map((tag) => (
          <View key={tag._id} style={styles.tagCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.tagTarget}>{targetLabel(tag)}</Text>
              <Text style={styles.tagMeta}>First-level approver: {personLabel(tag.approverId)}</Text>
              <Text style={styles.tagMeta}>
                Assigned by {tag.createdBy?.name || '-'} on {new Date(tag.createdAt).toLocaleDateString('en-GB')}
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleRemove(tag)} hitSlop={10} accessibilityLabel={`Remove approver tag for ${targetLabel(tag)}`}>
              <Ionicons name="trash-outline" size={20} color={colors.error} />
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  label: { fontSize: 13, fontWeight: '500', color: colors.textPrimary },
  link: { fontSize: 12, color: colors.primary },
  employeeList: { maxHeight: 280, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md },
  employeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  employeeName: { fontSize: 14, color: colors.textPrimary },
  employeeMeta: { fontSize: 12, color: colors.textSecondary },
  emptySmall: { padding: 12, fontSize: 13, color: colors.textSecondary },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 },
  empty: { textAlign: 'center', color: colors.textSecondary, paddingVertical: 24 },
  tagCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 12,
    marginBottom: 8,
  },
  tagTarget: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  tagMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
