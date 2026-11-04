import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { apiService } from '../../services/api';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, WebLabel } from '../../ui/WebPrimitives';
import { colors, spacing } from '../../theme/colors';

type Zone = { _id?: string; name: string };
type Cluster = { _id?: string; name: string };
type ZoneCluster = { _id?: string; zone: string; cluster: string; zoneId?: string; clusterId?: string };
type PincodeMapping = {
  _id?: string;
  pincode: string;
  city?: string;
  district?: string;
  state?: string;
  zone: string;
  cluster: string;
};

export default function EmployeesZonesScreen() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [pairs, setPairs] = useState<ZoneCluster[]>([]);
  const [mappings, setMappings] = useState<PincodeMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingZone, setSavingZone] = useState(false);
  const [savingPair, setSavingPair] = useState(false);
  const [savingPincode, setSavingPincode] = useState(false);
  const [loadingPincode, setLoadingPincode] = useState(false);

  const [zoneName, setZoneName] = useState('');
  const [pairZoneId, setPairZoneId] = useState('');
  const [pairClusterId, setPairClusterId] = useState('');
  const [pincodeForm, setPincodeForm] = useState({
    pincode: '',
    zoneId: '',
    clusterId: '',
    city: '',
    district: '',
    state: '',
  });

  const loadAll = useCallback(async () => {
    try {
      const [zonesRaw, clustersRaw, pairsRaw, mappingsRaw] = await Promise.all([
        apiService.get('/zones'),
        apiService.get('/clusters'),
        apiService.get('/zones-clusters'),
        apiService.get('/zones/pincode-mappings'),
      ]);
      setZones(Array.isArray(zonesRaw) ? zonesRaw : []);
      setClusters(Array.isArray(clustersRaw) ? clustersRaw : []);
      setPairs(Array.isArray(pairsRaw) ? pairsRaw : []);
      setMappings(Array.isArray(mappingsRaw) ? mappingsRaw : []);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onAddZone = async () => {
    const trimmed = zoneName.trim();
    if (!trimmed) {
      Alert.alert('Validation', 'Zone is required');
      return;
    }
    if (zones.some((z) => z.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      Alert.alert('Validation', 'Zone already exists');
      return;
    }
    setSavingZone(true);
    try {
      await apiService.post('/zones', { name: trimmed });
      setZoneName('');
      loadAll();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save zone');
    } finally {
      setSavingZone(false);
    }
  };

  const onDeleteZone = (id?: string) => {
    if (!id) return;
    Alert.alert('Delete zone?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiService.delete(`/zones/${id}`);
            loadAll();
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to delete');
          }
        },
      },
    ]);
  };

  const onAddPair = async () => {
    if (!pairZoneId || !pairClusterId) {
      Alert.alert('Validation', 'Select zone and cluster');
      return;
    }
    setSavingPair(true);
    try {
      await apiService.post('/zones-clusters', { zoneId: pairZoneId, clusterId: pairClusterId });
      setPairZoneId('');
      setPairClusterId('');
      loadAll();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to link');
    } finally {
      setSavingPair(false);
    }
  };

  const onDeletePair = (id?: string) => {
    if (!id) return;
    Alert.alert('Remove link?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiService.delete(`/zones-clusters/${id}`);
            loadAll();
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed');
          }
        },
      },
    ]);
  };

  const handlePincodeLookup = async (pincode: string) => {
    const digits = pincode.replace(/\D/g, '').slice(0, 6);
    setPincodeForm((f) => ({ ...f, pincode: digits }));
    if (digits.length !== 6) return;
    setLoadingPincode(true);
    try {
      const res = await apiService.get(`/location/resolve?pincode=${digits}`);
      const zoneMatch = zones.find((z) => z.name === res.zone);
      const clusterMatch = clusters.find((c) => c.name === res.cluster);
      setPincodeForm((f) => ({
        ...f,
        city: res.city || res.town || f.city,
        district: res.district || f.district,
        state: res.state || f.state,
        zoneId: zoneMatch?._id || f.zoneId,
        clusterId: clusterMatch?._id || f.clusterId,
      }));
    } catch {
      /* manual entry */
    } finally {
      setLoadingPincode(false);
    }
  };

  const clustersForPincodeZone = clusters.filter((c) => {
    if (!pincodeForm.zoneId) return true;
    const zone = zones.find((z) => z._id === pincodeForm.zoneId);
    if (!zone) return true;
    return pairs.some((p) => p.zone === zone.name && p.cluster === c.name);
  });

  const onAddPincodeMapping = async () => {
    const pincode = pincodeForm.pincode.replace(/\D/g, '').slice(0, 6);
    if (pincode.length !== 6 || !pincodeForm.zoneId || !pincodeForm.clusterId) {
      Alert.alert('Validation', 'Pincode, zone, and cluster are required');
      return;
    }
    setSavingPincode(true);
    try {
      await apiService.post('/zones/pincode-mappings', {
        pincode,
        zoneId: pincodeForm.zoneId,
        clusterId: pincodeForm.clusterId,
        city: pincodeForm.city,
        district: pincodeForm.district,
        state: pincodeForm.state,
      });
      setPincodeForm({ pincode: '', zoneId: '', clusterId: '', city: '', district: '', state: '' });
      loadAll();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save mapping');
    } finally {
      setSavingPincode(false);
    }
  };

  const onDeleteMapping = (id?: string) => {
    if (!id) return;
    Alert.alert('Delete mapping?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiService.delete(`/zones/pincode-mappings/${id}`);
            loadAll();
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed');
          }
        },
      },
    ]);
  };

  return (
    <ScreenShell
      title="Zones"
      loading={loading}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        loadAll();
      }}
    >
      <PageSection title="Add Zone">
        <WebLabel>Zone name *</WebLabel>
        <WebInput placeholder="Enter zone" value={zoneName} onChangeText={setZoneName} />
        <View style={styles.row}>
          <View style={styles.grow}>
            <WebButton title={savingZone ? 'Saving…' : 'Add Zone'} onPress={onAddZone} loading={savingZone} />
          </View>
          <WebButton title="Refresh" variant="outline" onPress={loadAll} />
        </View>
        {zones.length === 0 ? (
          <Text style={styles.empty}>No zones yet.</Text>
        ) : (
          <View style={styles.list}>
            {zones.map((z, i) => (
              <ListRow
                key={z._id || `${z.name}-${i}`}
                title={z.name}
                last={i === zones.length - 1}
                actionLabel={z._id ? 'Delete' : undefined}
                onAction={() => onDeleteZone(z._id)}
              />
            ))}
          </View>
        )}
      </PageSection>

      <PageSection
        title="Zone → Cluster links"
        description="Link clusters to zones so Add Employee shows the correct cluster list per zone."
      >
        <WebSelect
          label="Zone"
          value={pairZoneId}
          onValueChange={setPairZoneId}
          placeholder="Select zone"
          items={zones.filter((z) => z._id).map((z) => ({ label: z.name, value: z._id! }))}
        />
        <WebSelect
          label="Cluster"
          value={pairClusterId}
          onValueChange={setPairClusterId}
          placeholder="Select cluster"
          items={clusters.filter((c) => c._id).map((c) => ({ label: c.name, value: c._id! }))}
        />
        <WebButton
          title={savingPair ? 'Linking…' : 'Link cluster to zone'}
          onPress={onAddPair}
          loading={savingPair}
          disabled={clusters.length === 0}
        />
        {pairs.length > 0 && (
          <View style={styles.list}>
            {pairs.map((p, i) => (
              <ListRow
                key={p._id || `${p.zone}-${p.cluster}-${i}`}
                title={p.cluster}
                meta={`Zone: ${p.zone}`}
                last={i === pairs.length - 1}
                actionLabel={p._id ? 'Remove' : undefined}
                onAction={() => onDeletePair(p._id)}
              />
            ))}
          </View>
        )}
      </PageSection>

      <PageSection
        title="Pincode mappings"
        description="Map pincode to city, district, state, zone, and cluster for automatic fill on Add Employee."
      >
        <WebLabel>Pincode *</WebLabel>
        <WebInput
          placeholder="6-digit pincode"
          value={pincodeForm.pincode}
          onChangeText={handlePincodeLookup}
          keyboardType="number-pad"
          maxLength={6}
        />
        <WebSelect
          label="Zone *"
          value={pincodeForm.zoneId}
          onValueChange={(v) => setPincodeForm((f) => ({ ...f, zoneId: v, clusterId: '' }))}
          placeholder="Select zone"
          items={zones.filter((z) => z._id).map((z) => ({ label: z.name, value: z._id! }))}
        />
        <WebSelect
          label="Cluster *"
          value={pincodeForm.clusterId}
          onValueChange={(v) => setPincodeForm((f) => ({ ...f, clusterId: v }))}
          placeholder="Select cluster"
          items={clustersForPincodeZone.filter((c) => c._id).map((c) => ({ label: c.name, value: c._id! }))}
        />
        <WebLabel>City</WebLabel>
        <WebInput placeholder="City" value={pincodeForm.city} onChangeText={(t) => setPincodeForm((f) => ({ ...f, city: t }))} />
        <WebLabel>District</WebLabel>
        <WebInput placeholder="District" value={pincodeForm.district} onChangeText={(t) => setPincodeForm((f) => ({ ...f, district: t }))} />
        <WebLabel>State</WebLabel>
        <WebInput placeholder="State" value={pincodeForm.state} onChangeText={(t) => setPincodeForm((f) => ({ ...f, state: t }))} />
        <WebButton
          title={savingPincode ? 'Saving…' : 'Save pincode mapping'}
          onPress={onAddPincodeMapping}
          loading={savingPincode || loadingPincode}
        />
        {mappings.length > 0 && (
          <View style={styles.list}>
            {mappings.map((m, i) => (
              <ListRow
                key={m._id || `${m.pincode}-${i}`}
                title={m.pincode}
                meta={[m.zone, m.cluster, m.city].filter(Boolean).join(' · ')}
                last={i === mappings.length - 1}
                actionLabel={m._id ? 'Delete' : undefined}
                onAction={() => onDeleteMapping(m._id)}
              />
            ))}
          </View>
        )}
      </PageSection>
    </ScreenShell>
  );
}

/** One compact line in a list: title + small meta on the left, delete/remove on the right. */
function ListRow({
  title,
  meta,
  last,
  actionLabel,
  onAction,
}: {
  title: string;
  meta?: string;
  last?: boolean;
  actionLabel?: string;
  onAction: () => void;
}) {
  return (
    <View style={[styles.listRow, last && styles.listRowLast]}>
      <View style={styles.grow}>
        <Text style={styles.listTitle}>{title}</Text>
        {meta ? <Text style={styles.listMeta}>{meta}</Text> : null}
      </View>
      {actionLabel ? (
        <TouchableOpacity onPress={onAction} style={styles.dangerBtn} hitSlop={6}>
          <Text style={styles.dangerText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  grow: { flex: 1 },
  empty: { fontSize: 13, color: colors.textTertiary, textAlign: 'center', paddingVertical: 12 },
  list: { marginTop: 12, borderWidth: 1, borderColor: '#EEF2F7', borderRadius: 12, overflow: 'hidden' },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.backgroundLight,
  },
  listRowLast: { borderBottomWidth: 0 },
  listTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  listMeta: { fontSize: 13, color: colors.textTertiary, marginTop: 2 },
  dangerBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.errorLight },
  dangerText: { fontSize: 13, fontWeight: '700', color: colors.error },
});
