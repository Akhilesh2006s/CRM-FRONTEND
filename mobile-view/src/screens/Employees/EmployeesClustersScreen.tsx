import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { apiService } from '../../services/api';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebLabel } from '../../ui/WebPrimitives';
import { Card, CardTitle, ActionRow, EmptyState, SectionTitle } from '../../ui/Kit';

type Cluster = { _id?: string; name: string };

export default function EmployeesClustersScreen() {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const data = await apiService.get('/clusters');
      setClusters(Array.isArray(data) ? data : []);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load clusters');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Validation', 'Cluster is required');
      return;
    }
    if (clusters.some((c) => c.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      Alert.alert('Validation', 'Cluster already exists');
      return;
    }
    setSaving(true);
    try {
      await apiService.post('/clusters', { name: trimmed });
      setName('');
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save cluster');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (id?: string) => {
    if (!id) return;
    Alert.alert('Delete cluster?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiService.delete(`/clusters/${id}`);
            load();
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to delete');
          }
        },
      },
    ]);
  };

  return (
    <ScreenShell
      title="Clusters"
      loading={loading}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      <PageSection title="Add Cluster">
        <WebLabel>Cluster name *</WebLabel>
        <WebInput placeholder="Enter cluster" value={name} onChangeText={setName} />
        <View style={styles.row}>
          <View style={styles.grow}>
            <WebButton title={saving ? 'Saving…' : 'Add Cluster'} onPress={onAdd} loading={saving} />
          </View>
          <WebButton title="Refresh" variant="outline" onPress={load} />
        </View>
      </PageSection>

      <SectionTitle>{`Clusters (${clusters.length})`}</SectionTitle>
      {clusters.length === 0 ? (
        <EmptyState title="No clusters yet" message="Add a cluster above." />
      ) : (
        clusters.map((c, i) => (
          <Card key={c._id || `${c.name}-${i}`}>
            <CardTitle title={c.name} />
            {c._id ? (
              <ActionRow>
                <WebButton title="Delete" variant="destructive" onPress={() => onDelete(c._id)} />
              </ActionRow>
            ) : null}
          </Card>
        ))
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  grow: { flex: 1 },
});
