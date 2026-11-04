import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { apiService } from '../../services/api';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebSelect } from '../../ui/WebPrimitives';
import { Card, CardTitle, InfoRow, EmptyState, SectionTitle } from '../../ui/Kit';
import { useAuth } from '../../context/AuthContext';
import { getRoleFlags } from '../../utils/roles';
import { colors, spacing } from '../../theme/colors';

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

      {!clusterId ? <EmptyState icon="🗂️" title="Select a cluster" message="Pick a zone and cluster to see its schools." /> : null}
      {clusterId && loadingSchools ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.info}>Loading schools...</Text>
        </View>
      ) : null}
      {clusterId && loaded && !loadingSchools && schools.length === 0 ? (
        <EmptyState title={`No schools under ${clusterName}.`} />
      ) : null}

      {clusterId && !loadingSchools && schools.length > 0 ? (
        <View>
          <SectionTitle>{`${schools.length} school${schools.length === 1 ? '' : 's'} in ${clusterName}${zoneName ? ` · ${zoneName}` : ''}`}</SectionTitle>
          {schools.map((s) => (
            <Card key={s._id}>
              <CardTitle title={s.schoolName || '—'} subtitle={s.schoolCode} />
              <InfoRow label="Contact" value={s.contactName} />
              <InfoRow label="Mobile" value={s.mobileNumber} phone />
              <InfoRow label="Location" value={s.location} />
            </Card>
          ))}
        </View>
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  info: { fontSize: 14, color: colors.textSecondary, paddingVertical: spacing.sm },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: 16 },
});
