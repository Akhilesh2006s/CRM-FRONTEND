import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../../services/api';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, WebLabel } from '../../ui/WebPrimitives';
import { useAuth } from '../../context/AuthContext';
import { getRoleFlags } from '../../utils/roles';
import { colors, radii, spacing } from '../../theme/colors';

type ChainHead = { _id: string; name: string; role: string };
type ClientSchool = {
  id: string;
  name: string;
  code: string;
  location: string;
  status: string;
};

/** Same display names as web lib/roleLabels.ts. */
const ROLE_LABELS: Record<string, string> = {
  'Executive Manager': 'Zonal Manager',
  Manager: 'Product Manager',
  Executive: 'BDE',
  'Sales BDE': 'BDE',
  Employee: 'BDE',
};
const displayRoleName = (role?: string) => (role ? ROLE_LABELS[role] || role : '');

const errorMessage = (e: any, fallback: string) =>
  e?.response?.data?.message || e?.message || fallback;

/** Admin / Super Admin: map existing client schools into a chain under a BDE or Zonal Manager head. */
export default function ChainScreen({ navigation }: any) {
  const { user } = useAuth();
  const flags = getRoleFlags(user);
  const allowed = flags.isAdmin || flags.isSuperAdmin || Boolean((user as any)?.isSuperAdmin);

  const [assignedTo, setAssignedTo] = useState('');
  const [heads, setHeads] = useState<ChainHead[]>([]);
  const [loadingHeads, setLoadingHeads] = useState(true);
  const [schools, setSchools] = useState<ClientSchool[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadHeads = useCallback(async () => {
    setLoadingHeads(true);
    try {
      const [bdes, managers] = await Promise.all([
        apiService.get('/employees?isActive=true&role=Executive').catch(() => []),
        apiService.get('/employees?isActive=true&role=Executive%20Manager').catch(() => []),
      ]);
      const mapUser = (u: any, fallbackRole: string): ChainHead | null => {
        const id = u?._id || u?.id;
        if (!id) return null;
        return { _id: String(id), name: u.name || 'Unknown', role: u.role || fallbackRole };
      };
      const combined = [
        ...(Array.isArray(bdes) ? bdes : []).map((u: any) => mapUser(u, 'Executive')),
        ...(Array.isArray(managers) ? managers : []).map((u: any) => mapUser(u, 'Executive Manager')),
      ].filter((u): u is ChainHead => Boolean(u) && (u as ChainHead).name !== 'Unknown');
      const seen = new Set<string>();
      setHeads(combined.filter((u) => (seen.has(u._id) ? false : (seen.add(u._id), true))));
    } catch {
      setHeads([]);
    } finally {
      setLoadingHeads(false);
    }
  }, []);

  const loadSchools = useCallback(async () => {
    setLoadingSchools(true);
    try {
      const list = await apiService.get('/dc-orders/chain-candidates');
      setSchools(Array.isArray(list) ? list : []);
    } catch {
      setSchools([]);
    } finally {
      setLoadingSchools(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    if (!allowed) {
      Alert.alert('Access Denied', 'Admin only');
      navigation?.goBack?.();
      return;
    }
    loadHeads();
    loadSchools();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id, allowed]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return schools;
    return schools.filter((s) => `${s.name} ${s.code}`.toLowerCase().includes(q));
  }, [schools, query]);

  const toggleSchool = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const onSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      if (!assignedTo) throw new Error('Please assign a chain head.');
      if (selectedIds.length === 0) throw new Error('Select at least one existing client school.');
      const result = await apiService.post('/dc-orders/map-chain', {
        assigned_to: assignedTo,
        schoolIds: selectedIds,
      });
      Alert.alert('Success', result?.message || 'Schools mapped to the chain.');
      setAssignedTo('');
      setSelectedIds([]);
      setQuery('');
      await loadSchools();
    } catch (e: any) {
      const message = errorMessage(e, 'Failed to map schools to the chain');
      setError(message);
      Alert.alert('Error', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenShell
      title="Chain"
      subtitle="Map schools that are already saved as clients. Chain head can be a BDE or a Zonal Manager. No zone or cluster."
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await Promise.all([loadHeads(), loadSchools()]);
        setRefreshing(false);
      }}
    >
      <PageSection title="Chain head *">
        <WebSelect
          value={assignedTo}
          onValueChange={setAssignedTo}
          disabled={loadingHeads}
          placeholder={loadingHeads ? 'Loading...' : 'Select BDE or Zonal Manager'}
          items={heads.map((h) => ({ label: `${h.name} (${displayRoleName(h.role)})`, value: h._id }))}
        />
      </PageSection>

      <PageSection
        title="Existing client schools"
        description={`${selectedIds.length} selected. Search by school name or school code.`}
      >
        <WebLabel>Search</WebLabel>
        <WebInput value={query} onChangeText={setQuery} placeholder="School name or school code" />

        <View style={styles.list}>
          {loadingSchools ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.empty}>Loading client schools...</Text>
            </View>
          ) : filtered.length === 0 ? (
            <Text style={styles.empty}>No client schools available to map.</Text>
          ) : (
            filtered.map((s, i) => {
              const checked = selectedIds.includes(s.id);
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.row, checked && styles.rowChecked, i === filtered.length - 1 && styles.rowLast]}
                  onPress={() => toggleSchool(s.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={checked ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={checked ? colors.primary : colors.textMuted}
                  />
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle}>{s.code ? `${s.name} — ${s.code}` : s.name}</Text>
                    {s.location ? <Text style={styles.rowMeta}>{s.location}</Text> : null}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </PageSection>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <WebButton
        title={submitting ? 'Mapping schools...' : 'Map schools to chain'}
        onPress={() => void onSubmit()}
        loading={submitting}
        disabled={submitting || loadingSchools}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  list: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  loadingRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.md },
  empty: { padding: spacing.md, fontSize: 13, color: colors.textSecondary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  rowChecked: { backgroundColor: colors.accent },
  rowLast: { borderBottomWidth: 0 },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 14, color: colors.textPrimary },
  rowMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  error: { color: colors.error, fontSize: 13, marginBottom: spacing.sm },
});
