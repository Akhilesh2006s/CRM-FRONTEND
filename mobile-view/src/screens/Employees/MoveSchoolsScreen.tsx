import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../../services/api';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, WebLabel } from '../../ui/WebPrimitives';
import { useAuth } from '../../context/AuthContext';
import { getRoleFlags } from '../../utils/roles';
import { colors, radii, spacing } from '../../theme/colors';

type Zone = { _id: string; name: string };
type Cluster = { _id: string; name: string };
type School = {
  _id: string;
  schoolName: string;
  schoolCode?: string;
  zone?: string;
  cluster?: string;
};
type MoveResult = {
  message?: string;
  leadsUpdated?: number;
  ordersUpdated?: number;
  removedFromClusters?: string[];
  targetCluster?: string;
  targetZone?: string;
};

const errorMessage = (e: any, fallback: string) =>
  e?.response?.data?.message || e?.message || fallback;

/** Admin / Super Admin: move client schools from a source zone + cluster to a target zone + cluster. */
export default function MoveSchoolsScreen({ navigation }: any) {
  const { user } = useAuth();
  const flags = getRoleFlags(user);
  const isSuperAdmin = flags.isSuperAdmin || Boolean((user as any)?.isSuperAdmin);
  const allowed = flags.isAdmin || isSuperAdmin;

  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceClusters, setSourceClusters] = useState<Cluster[]>([]);
  const [targetClusters, setTargetClusters] = useState<Cluster[]>([]);
  const [schoolCode, setSchoolCode] = useState('');
  const [sourceZoneId, setSourceZoneId] = useState('');
  const [sourceClusterId, setSourceClusterId] = useState('');
  const [targetZoneId, setTargetZoneId] = useState('');
  const [targetClusterId, setTargetClusterId] = useState('');
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadZones = useCallback(async () => {
    try {
      const z = await apiService.get('/zones');
      setZones(Array.isArray(z) ? z : []);
    } catch {
      setZones([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    if (!allowed) {
      Alert.alert('Access Denied', 'Admin only');
      navigation?.goBack?.();
      return;
    }
    loadZones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id, allowed]);

  useEffect(() => {
    if (!sourceZoneId) {
      setSourceClusters([]);
      return;
    }
    let cancelled = false;
    apiService
      .get(`/zones/${sourceZoneId}/clusters`)
      .then((c) => !cancelled && setSourceClusters(Array.isArray(c) ? c : []))
      .catch(() => !cancelled && setSourceClusters([]));
    return () => {
      cancelled = true;
    };
  }, [sourceZoneId]);

  useEffect(() => {
    if (!targetZoneId) {
      setTargetClusters([]);
      return;
    }
    let cancelled = false;
    apiService
      .get(`/zones/${targetZoneId}/clusters`)
      .then((c) => !cancelled && setTargetClusters(Array.isArray(c) ? c : []))
      .catch(() => !cancelled && setTargetClusters([]));
    return () => {
      cancelled = true;
    };
  }, [targetZoneId]);

  const sourceZoneName = zones.find((z) => z._id === sourceZoneId)?.name || '';
  const sourceClusterName = sourceClusters.find((c) => c._id === sourceClusterId)?.name || '';
  const samePlace =
    Boolean(sourceZoneId && sourceClusterId && targetZoneId && targetClusterId) &&
    sourceZoneId === targetZoneId &&
    sourceClusterId === targetClusterId;
  const canMove = Boolean(
    sourceZoneId && sourceClusterId && targetZoneId && targetClusterId && selectedIds.length > 0 && !samePlace
  );

  const clearSearch = () => {
    setSchools([]);
    setSelectedIds([]);
    setSearched(false);
  };

  const searchBySchoolCode = async () => {
    const code = schoolCode.trim();
    if (!sourceZoneId || !sourceClusterId) {
      Alert.alert('Validation', 'Select the source zone and source cluster first');
      return;
    }
    if (!code) {
      Alert.alert('Validation', 'Enter a school code');
      return;
    }
    setSearching(true);
    setSearched(true);
    try {
      const qs = [
        `schoolCode=${encodeURIComponent(code)}`,
        `zone=${encodeURIComponent(sourceZoneName)}`,
        `cluster=${encodeURIComponent(sourceClusterName)}`,
      ].join('&');
      const data = await apiService.get(`/schools?${qs}`);
      const list: School[] = Array.isArray(data) ? data : [];
      setSchools(list);
      setSelectedIds(list.map((s) => s._id));
      if (list.length === 0) Alert.alert('Not found', 'No school found for that school code in the source cluster');
    } catch (e: any) {
      setSchools([]);
      setSelectedIds([]);
      Alert.alert('Error', errorMessage(e, 'Failed to search schools'));
    } finally {
      setSearching(false);
    }
  };

  const onMove = async () => {
    if (!sourceZoneId || !sourceClusterId) {
      Alert.alert('Validation', 'Select the source zone and source cluster');
      return;
    }
    if (!targetZoneId || !targetClusterId) {
      Alert.alert('Validation', 'Select the target zone and target cluster');
      return;
    }
    if (samePlace) {
      Alert.alert('Validation', 'Source and target must be different');
      return;
    }
    if (selectedIds.length === 0) {
      Alert.alert('Validation', 'Search and select a school by school code');
      return;
    }
    setSaving(true);
    try {
      const result: MoveResult = await apiService.post('/schools/move', {
        mode: 'selection',
        schoolIds: selectedIds,
        targetZoneId,
        targetClusterId,
      });
      const from =
        result?.removedFromClusters && result.removedFromClusters.length > 0
          ? ` Removed from: ${result.removedFromClusters.join(', ')}.`
          : '';
      Alert.alert(
        'Success',
        `Moved to ${result?.targetCluster ?? ''} (${result?.targetZone ?? ''}).${from} Leads: ${
          result?.leadsUpdated ?? 0
        }, DCs: ${result?.ordersUpdated ?? 0}`
      );
      setSelectedIds([]);
      setSchools([]);
      setSchoolCode('');
      setSearched(false);
    } catch (e: any) {
      Alert.alert('Error', errorMessage(e, 'Move failed'));
    } finally {
      setSaving(false);
    }
  };

  const toggleSchool = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const zoneItems = zones.filter((z) => z._id).map((z) => ({ label: z.name, value: z._id }));

  return (
    <ScreenShell
      title="Move Schools"
      subtitle="Admin only — choose the source and the target, then search by school code to move."
      loading={loading}
    >
      <PageSection title="Source">
        <WebSelect
          label="Source zone *"
          value={sourceZoneId}
          onValueChange={(v) => {
            setSourceZoneId(v);
            setSourceClusterId('');
            clearSearch();
          }}
          placeholder="Select zone"
          items={zoneItems}
        />
        <WebSelect
          label="Source cluster *"
          value={sourceClusterId}
          onValueChange={(v) => {
            setSourceClusterId(v);
            clearSearch();
          }}
          placeholder="Select cluster"
          disabled={!sourceZoneId}
          items={sourceClusters.filter((c) => c._id).map((c) => ({ label: c.name, value: c._id }))}
        />
        {isSuperAdmin && sourceZoneId && sourceClusterId ? (
          <TouchableOpacity
            onPress={() =>
              navigation?.navigate?.('EmployeesClusterSchools', {
                zoneId: sourceZoneId,
                clusterId: sourceClusterId,
              })
            }
          >
            <Text style={styles.link}>View schools in this cluster</Text>
          </TouchableOpacity>
        ) : null}
      </PageSection>

      <PageSection title="Target">
        <WebSelect
          label="Target zone *"
          value={targetZoneId}
          onValueChange={(v) => {
            setTargetZoneId(v);
            setTargetClusterId('');
          }}
          placeholder="Select zone"
          items={zoneItems}
        />
        <WebSelect
          label="Target cluster *"
          value={targetClusterId}
          onValueChange={setTargetClusterId}
          placeholder="Select cluster"
          disabled={!targetZoneId}
          items={targetClusters.filter((c) => c._id).map((c) => ({ label: c.name, value: c._id }))}
        />
        {samePlace ? <Text style={styles.warn}>Source and target must be different.</Text> : null}
      </PageSection>

      <PageSection title="School">
        <WebLabel>School code *</WebLabel>
        <WebInput
          value={schoolCode}
          onChangeText={setSchoolCode}
          placeholder="Enter school code"
          autoCapitalize="characters"
          returnKeyType="search"
          onSubmitEditing={() => void searchBySchoolCode()}
        />
        <WebButton
          title={searching ? 'Searching…' : 'Search'}
          variant="outline"
          loading={searching}
          disabled={searching || !sourceZoneId || !sourceClusterId}
          onPress={() => void searchBySchoolCode()}
        />

        {searched && !searching ? (
          <View style={styles.list}>
            {schools.length === 0 ? (
              <Text style={styles.empty}>No school found for that school code in the source cluster.</Text>
            ) : (
              schools.map((s, i) => {
                const checked = selectedIds.includes(s._id);
                return (
                  <TouchableOpacity
                    key={s._id}
                    style={[styles.row, i === schools.length - 1 && styles.rowLast]}
                    onPress={() => toggleSchool(s._id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={checked ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={checked ? colors.primary : colors.textMuted}
                    />
                    <View style={styles.rowBody}>
                      <Text style={styles.rowTitle}>
                        {s.schoolCode || '—'}
                        {s.schoolName ? ` · ${s.schoolName}` : ''}
                      </Text>
                      {s.zone || s.cluster ? (
                        <Text style={styles.rowMeta}>{[s.zone, s.cluster].filter(Boolean).join(' · ')}</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        ) : null}
      </PageSection>

      <WebButton
        title={saving ? 'Moving…' : 'Move schools'}
        onPress={() => void onMove()}
        loading={saving}
        disabled={saving || !canMove}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  link: { color: colors.primaryDark, fontSize: 14, fontWeight: '600', paddingVertical: spacing.xs },
  warn: { color: colors.error, fontSize: 13 },
  list: {
    marginTop: spacing.md,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
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
  rowLast: { borderBottomWidth: 0 },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 14, color: colors.textPrimary, fontWeight: '500' },
  rowMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
