/** Mirrors web app/dashboard/leads/cross-sale/page.tsx (GET /leads?lead_type=cross_sale). */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { apiService } from '../../services/api';
import { colors } from '../../theme/colors';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput } from '../../ui/WebPrimitives';
import { Card, CardTitle, InfoRow, ActionRow, EmptyState, toneFor } from '../../ui/Kit';

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

  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = leads.filter((l) => {
    if (!words.length) return true;
    const hay = [l.school_name, l.school_code, l.contact_person, l.contact_mobile, l.zone, l.status, l.priority]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return words.every((w) => hay.includes(w));
  });

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
          <WebInput placeholder="Search school, code, contact, zone…" value={search} onChangeText={setSearch} />
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => void load()}>
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {filtered.length === 0 ? (
        <EmptyState icon="🔁" title="No cross-sale leads" message="Create a lead with type Cross Sale." />
      ) : (
        filtered.map((l) => (
          <Card key={l._id}>
            <CardTitle title={l.school_name || '-'} subtitle={l.school_code || undefined} badge={l.status || undefined} tone={toneFor(l.status)} />
            <InfoRow label="Contact" value={l.contact_person || undefined} />
            <InfoRow label="Mobile" value={l.contact_mobile || undefined} phone />
            <InfoRow label="Zone" value={l.zone || undefined} />
            <InfoRow label="Priority" value={l.priority || undefined} />
            <ActionRow>
              <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('LeadEdit', { id: l._id })}>
                <Text style={styles.actionText}>Open</Text>
              </TouchableOpacity>
            </ActionRow>
          </Card>
        ))
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  refreshBtn: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundLight,
    justifyContent: 'center',
  },
  refreshText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.primaryDark,
  },
  actionText: { fontSize: 14, fontWeight: '700', color: colors.primaryForeground },
});
