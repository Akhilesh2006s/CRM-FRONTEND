import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator, Linking, TouchableOpacity } from 'react-native';
import { apiService } from '../../services/api';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebSelect } from '../../ui/WebPrimitives';
import { useAuth } from '../../context/AuthContext';
import { getRoleFlags } from '../../utils/roles';
import { colors, radii, spacing } from '../../theme/colors';

type Zone = { _id: string; name: string };
type Cluster = { _id: string; name: string };
type School = {
  _id: string;
  schoolName: string;
  schoolCode?: string;
  contactName?: string;
  mobileNumber?: string;
  location?: string;
  zone?: string;
  cluster?: string;
};

export type ClusterSchoolsParams = { zoneId?: string; clusterId?: string } | undefined;

const errorMessage = (e: any, fallback: string) =>
  e?.response?.data?.message || e?.message || fallback;

/** Super Admin: pick a zone and cluster to list the schools under it. */
export default function ClusterSchoolsScreen({ navigation, route }: any) {
  const { user } = useAuth();
  const flags = getRoleFlags(user);
  const allowed = flags.isSuperAdmin || Boolean((user as any)?.isSuperAdmin);

  const [zones, setZones] = useState<Zone[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [zoneId, setZoneId] = useState<string>(route?.params?.zoneId || '');
  const [clusterId, setClusterId] = useState<string>(route?.params?.clusterId || '');
  const [schools, setSchools] = useState<School[]>([]);
  const [loadingZones, setLoadingZones] = useState(true);
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Pick up params when the screen is re-opened with a different cluster (e.g. from Move Schools).
  useEffect(() => {
    const p = route?.params || {};
    if (p.zoneId !== undefined) setZoneId(p.zoneId || '');
    if (p.clusterId !== undefined) setClusterId(p.clusterId || '');
  }, [route?.params?.zoneId, route?.params?.clusterId]);

  const loadZones = useCallback(async () => {
    try {
      const list = await apiService.get('/zones');
      setZones(Array.isArray(list) ? list : []);
    } catch {
      setZones([]);
    } finally {
      setLoadingZones(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    if (!allowed) {
      Alert.alert('Access Denied', 'Super Admin only');
      navigation?.goBack?.();
      return;
    }
    loadZones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id, allowed]);

  useEffect(() => {
    if (!zoneId) {
      setClusters([]);
      return;
    }
    let cancelled = false;
    apiService
      .get(`/zones/${zoneId}/clusters`)
      .then((list) => !cancelled && setClusters(Array.isArray(list) ? list : []))
      .catch(() => !cancelled && setClusters([]));
    return () => {
      cancelled = true;
    };
  }, [zoneId]);

  const zoneName = zones.find((z) => z._id === zoneId)?.name || '';
  const clusterName = clusters.find((c) => c._id === clusterId)?.name || '';

  useEffect(() => {
    if (!zoneName || !clusterName) {
      setSchools([]);
      setLoaded(false);
      setRefreshing(false);
      return;
    }
    let cancelled = false;
    setLoadingSchools(true);
    setLoaded(true);
    const qs = `zone=${encodeURIComponent(zoneName)}&cluster=${encodeURIComponent(clusterName)}`;
    apiService
      .get(`/schools?${qs}`)
      .then((list) => {
        if (!cancelled) setSchools(Array.isArray(list) ? list : []);
      })
      .catch((e: any) => {
        if (!cancelled) {
          setSchools([]);
          Alert.alert('Error', errorMessage(e, 'Failed to load schools'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingSchools(false);
          setRefreshing(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [zoneName, clusterName, reloadKey]);

  const chooseZone = (next: string) => {
    setZoneId(next);
    setClusterId('');
    setSchools([]);
    setLoaded(false);
  };

  return (
    <ScreenShell
      title="Cluster Schools"
      subtitle="Super Admin — select a cluster to see the schools under it."
      loading={loadingZones}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        loadZones();
        setReloadKey((k) => k + 1);
      }}
    >
      <PageSection title="Filter">
        <WebSelect
          label="Zone"
          value={zoneId}
          onValueChange={chooseZone}
          placeholder="Select zone"
          items={zones.filter((z) => z._id).map((z) => ({ label: z.name, value: z._id }))}
        />
        <WebSelect
          label="Cluster"
          value={clusterId}
          onValueChange={setClusterId}
          placeholder="Select cluster"
          disabled={!zoneId}
          items={clusters.filter((c) => c._id).map((c) => ({ label: c.name, value: c._id }))}
        />
      </PageSection>

      {!clusterId ? <Text style={styles.info}>Select a cluster to see its schools.</Text> : null}
      {clusterId && loadingSchools ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.info}>Loading schools...</Text>
        </View>
      ) : null}
      {clusterId && loaded && !loadingSchools && schools.length === 0 ? (
        <Text style={styles.info}>No schools under {clusterName}.</Text>
      ) : null}

      {clusterId && !loadingSchools && schools.length > 0 ? (
        <View>
          <Text style={styles.count}>
            {schools.length} school{schools.length === 1 ? '' : 's'} in {clusterName}
            {zoneName ? ` · ${zoneName}` : ''}
          </Text>
          {schools.map((s) => (
            <View key={s._id} style={styles.card}>
              <Text style={styles.cardTitle}>{s.schoolName || '—'}</Text>
              <Field label="School code" value={s.schoolCode} />
              <Field label="Contact" value={s.contactName} />
              <Field
                label="Mobile"
                value={s.mobileNumber}
                onPress={s.mobileNumber ? () => Linking.openURL(`tel:${s.mobileNumber}`) : undefined}
              />
              <Field label="Location" value={s.location} />
            </View>
          ))}
        </View>
      ) : null}
    </ScreenShell>
  );
}

function Field({ label, value, onPress }: { label: string; value?: string; onPress?: () => void }) {
  const text = <Text style={[styles.fieldValue, onPress && styles.fieldLink]}>{value || '—'}</Text>;
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {onPress ? <TouchableOpacity onPress={onPress}>{text}</TouchableOpacity> : text}
    </View>
  );
}

const styles = StyleSheet.create({
  info: { fontSize: 14, color: colors.textSecondary, paddingVertical: spacing.sm },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  count: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.sm },
  card: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.sm },
  field: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, gap: spacing.sm },
  fieldLabel: { fontSize: 13, color: colors.textSecondary },
  fieldValue: { fontSize: 13, color: colors.textPrimary, flexShrink: 1, textAlign: 'right' },
  fieldLink: { color: colors.primaryDark, fontWeight: '600' },
});
