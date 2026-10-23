/** Mirrors web app/dashboard/leads/cross-sale/page.tsx (GET /leads?lead_type=cross_sale). */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { apiService } from '../../services/api';
import { colors, radii } from '../../theme/colors';
import ScreenShell from '../../ui/ScreenShell';
import { WebButton, WebInput } from '../../ui/WebPrimitives';

type Lead = {
  _id: string;
  school_name?: string;
  school_code?: string;
  contact_person?: string;
  contact_mobile?: string;
  zone?: string;
  status?: string;
  priority?: string;
  lead_type?: string;
  follow_up_date?: string;
};

export default function CrossSaleLeadsScreen({ navigation }: any) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await apiService.get('/leads?lead_type=cross_sale');
      setLeads(Array.isArray(data) ? data : []);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load cross-sale leads');
      setLeads([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const q = search.trim().toLowerCase();
  const filtered = leads.filter((l) =>
    !q
      ? true
      : [l.school_name, l.school_code, l.contact_person, l.zone]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
  );

  return (
    <ScreenShell
      title="Cross-Sale Leads"
      subtitle="Upsell / cross-sell pipeline for existing schools"
      loading={loading}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        void load();
      }}
    >
      <View style={styles.toolbar}>
        <View style={{ flex: 1 }}>
          <WebInput placeholder="Search school / zone" value={search} onChangeText={setSearch} />
        </View>
        <View style={{ marginBottom: 12 }}>
          <WebButton title="Refresh" variant="outline" onPress={() => void load()} />
        </View>
      </View>

      {filtered.length === 0 ? (
        <Text style={styles.empty}>No cross-sale leads yet. Create a lead with type Cross Sale.</Text>
      ) : (
        filtered.map((l) => (
          <View key={l._id} style={styles.card}>
            <Text style={styles.school}>{l.school_name || '-'}</Text>
            <Text style={styles.code}>{l.school_code || '-'}</Text>
            <Text style={styles.meta}>
              <Text style={styles.label}>Contact: </Text>
              {l.contact_person || '-'}
              {l.contact_mobile ? ` · ${l.contact_mobile}` : ''}
            </Text>
            <Text style={styles.meta}>
              <Text style={styles.label}>Zone: </Text>
              {l.zone || '-'}
            </Text>
            <Text style={styles.meta}>
              <Text style={styles.label}>Status: </Text>
              {l.status || '-'}
              {'   '}
              <Text style={styles.label}>Priority: </Text>
              {l.priority || '-'}
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('LeadEdit', { id: l._id })}>
              <Text style={styles.open}>Open</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  empty: { textAlign: 'center', color: colors.textTertiary, paddingVertical: 32, fontSize: 14 },
  card: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 12,
    marginBottom: 10,
  },
  school: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  code: { fontSize: 12, color: '#1D4ED8', fontFamily: 'monospace', marginBottom: 4 },
  meta: { fontSize: 13, color: colors.textPrimary, marginTop: 2 },
  label: { color: colors.textSecondary },
  open: { marginTop: 8, color: '#0F766E', fontWeight: '600', textAlign: 'right' },
});
