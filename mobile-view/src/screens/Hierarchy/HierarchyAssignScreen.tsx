import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ScreenShell from '../../ui/ScreenShell';
import { WebButton } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { colors } from '../../theme/colors';

type Option = { _id: string; name: string; email: string; detail: string; takenBy: string };

export default function HierarchyAssignScreen({ navigation }: { navigation: any }) {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);
  const [error, setError] = useState('');
  const [target, setTarget] = useState<null | {
    parentRole: string;
    parentId: string;
    parentName: string;
    childLabel: string;
    options: Option[];
  }>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiService.get('/hierarchy/overview');
      setOverview(data);
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Failed to load hierarchy');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const open = (
    parentRole: string,
    parent: any,
    childLabel: string,
    options: Option[],
    selectedIds: string[]
  ) => {
    setTarget({ parentRole, parentId: parent._id, parentName: parent.name, childLabel, options });
    setSelected(selectedIds);
  };

  const save = async () => {
    if (!target) return;
    setSaving(true);
    try {
      await apiService.put('/hierarchy/assignments', {
        parentRole: target.parentRole,
        parentId: target.parentId,
        childIds: selected,
      });
      setTarget(null);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to save assignment');
    } finally {
      setSaving(false);
    }
  };

  const people = (list: any[] | undefined, meta: (item: any) => string, onAssign: (item: any) => void, dashboard: (item: any) => void) =>
    (list || []).map((item) => (
      <View key={item._id} style={styles.card}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.meta}>{item.email}</Text>
        <Text style={styles.meta}>{meta(item)}</Text>
        <View style={styles.row}>
          <TouchableOpacity onPress={() => dashboard(item)}>
            <Text style={styles.link}>Dashboard</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onAssign(item)}>
            <Text style={styles.link}>Assign</Text>
          </TouchableOpacity>
        </View>
      </View>
    ));

  return (
    <ScreenShell title="Assign Hierarchy" loading={loading} onRefresh={load} refreshing={false}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.help}>
        Create these roles from New Employee, then assign the level below each person. Saving moves someone off their previous manager.
      </Text>

      <Text style={styles.section}>Regional Managers</Text>
      {people(
        overview?.regionalManagers,
        (item) => `${item.zonalManagerCount || 0} Zonal Managers`,
        (item) =>
          open(
            'Regional Manager',
            item,
            'Zonal Managers',
            (overview?.zonalManagers || []).map((z: any) => ({
              _id: z._id,
              name: z.name,
              email: z.email,
              detail: `${z.employeeCount || 0} employees`,
              takenBy: z.regionalManagerId && String(z.regionalManagerId) !== item._id ? z.assignedToName || 'another manager' : '',
            })),
            (overview?.zonalManagers || []).filter((z: any) => String(z.regionalManagerId || '') === item._id).map((z: any) => z._id)
          ),
        (item) => navigation.navigate('HierarchyDashboard', { level: 'regional-manager', personId: item._id })
      )}

      <Text style={styles.section}>Regional Heads</Text>
      {people(
        overview?.regionalHeads,
        (item) => `${item.regionalManagerCount || 0} Regional Managers`,
        (item) =>
          open(
            'Regional Head',
            item,
            'Regional Managers',
            (overview?.regionalManagers || []).map((z: any) => ({
              _id: z._id,
              name: z.name,
              email: z.email,
              detail: `${z.zonalManagerCount || 0} Zonal Managers`,
              takenBy: z.regionalHeadId && String(z.regionalHeadId) !== item._id ? z.assignedToName || 'another head' : '',
            })),
            (overview?.regionalManagers || []).filter((z: any) => String(z.regionalHeadId || '') === item._id).map((z: any) => z._id)
          ),
        (item) => navigation.navigate('HierarchyDashboard', { level: 'regional-head', personId: item._id })
      )}

      <Text style={styles.section}>National Heads</Text>
      {people(
        overview?.nationalHeads,
        (item) => `${item.regionalHeadCount || 0} Regional Heads`,
        (item) =>
          open(
            'National Head',
            item,
            'Regional Heads',
            (overview?.regionalHeads || []).map((z: any) => ({
              _id: z._id,
              name: z.name,
              email: z.email,
              detail: `${z.regionalManagerCount || 0} Regional Managers`,
              takenBy: z.nationalHeadId && String(z.nationalHeadId) !== item._id ? z.assignedToName || 'another head' : '',
            })),
            (overview?.regionalHeads || []).filter((z: any) => String(z.nationalHeadId || '') === item._id).map((z: any) => z._id)
          ),
        (item) => navigation.navigate('HierarchyDashboard', { level: 'national-head', personId: item._id })
      )}

      <Modal visible={Boolean(target)} animationType="slide" onRequestClose={() => setTarget(null)}>
        <ScrollView contentContainerStyle={styles.modal}>
          <Text style={styles.section}>
            Assign {target?.childLabel} to {target?.parentName}
          </Text>
          {(target?.options || []).map((option) => {
            const on = selected.includes(option._id);
            return (
              <TouchableOpacity
                key={option._id}
                style={[styles.card, on && styles.cardOn]}
                onPress={() =>
                  setSelected((current) => (on ? current.filter((id) => id !== option._id) : [...current, option._id]))
                }
              >
                <Text style={styles.name}>
                  {on ? '☑ ' : '☐ '}
                  {option.name}
                </Text>
                <Text style={styles.meta}>{option.email}</Text>
                <Text style={styles.meta}>{option.detail}</Text>
                {option.takenBy ? <Text style={styles.taken}>Currently with {option.takenBy}</Text> : null}
              </TouchableOpacity>
            );
          })}
          <WebButton title={saving ? 'Saving…' : 'Save assignment'} onPress={save} disabled={saving} />
          <View style={{ height: 12 }} />
          <WebButton title="Cancel" variant="outline" onPress={() => setTarget(null)} />
        </ScrollView>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  help: { color: '#64748B', marginBottom: 12 },
  section: { marginTop: 16, marginBottom: 8, fontSize: 16, fontWeight: '700', color: '#0F172A' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 8,
  },
  cardOn: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  name: { fontWeight: '600', color: '#0F172A' },
  meta: { color: '#64748B', marginTop: 2 },
  taken: { color: '#B45309', marginTop: 2, fontSize: 12 },
  row: { flexDirection: 'row', gap: 16, marginTop: 8 },
  link: { color: '#1D4ED8', fontWeight: '600' },
  error: { color: '#B91C1C', marginBottom: 8 },
  modal: { padding: 16, backgroundColor: colors.background || '#F8FAFC' },
});
