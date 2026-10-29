import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { apiService } from '../../services/api';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { colors, radii, spacing } from '../../theme/colors';

type Executive = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  mobile?: string;
  empCode?: string;
  department?: string;
  assignedCity?: string;
  assignedArea?: string;
  assignedState?: string;
  assignedDistrict?: string;
  isActive: boolean;
  createdAt?: string;
};

function formatJoined(dateString?: string) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  );
}

export default function ExecutiveManagerExecutivesScreen() {
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await apiService.get('/executive-managers/my/executives');
      setExecutives(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setExecutives([]);
      Alert.alert('Error', e?.message || 'Failed to load executives');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <ScreenShell
      title="Executives"
      subtitle="View all executives assigned to you"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      {executives.length === 0 ? (
        <PageSection title="No executives">
          <Text style={styles.empty}>No executives assigned to you.</Text>
          <Text style={styles.emptyHint}>Contact Super Admin to assign executives to your account.</Text>
        </PageSection>
      ) : (
        <PageSection title={`Executives (${executives.length})`}>
          {executives.map((item, index) => (
            <View key={item._id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.titleWrap}>
                  <Text style={styles.serial}>#{index + 1}</Text>
                  <Text style={styles.name}>{item.name || '—'}</Text>
                </View>
                <View style={[styles.badge, item.isActive ? styles.badgeActive : styles.badgeInactive]}>
                  <Text style={[styles.badgeText, item.isActive ? styles.badgeTextActive : styles.badgeTextInactive]}>
                    {item.isActive ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </View>
              <InfoRow label="Email" value={item.email || '—'} />
              <InfoRow label="Phone" value={item.phone || '—'} />
              <InfoRow label="Mobile" value={item.mobile || '—'} />
              <InfoRow label="Employee Code" value={item.empCode || '—'} />
              <InfoRow label="Department" value={item.department || '—'} />
              <InfoRow label="State" value={item.assignedState || '—'} />
              <InfoRow label="City" value={item.assignedCity || '—'} />
              <InfoRow label="Area" value={item.assignedArea || '—'} />
              <InfoRow label="District" value={item.assignedDistrict || '—'} />
              <InfoRow label="Joined Date" value={formatJoined(item.createdAt)} />
            </View>
          ))}
        </PageSection>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  empty: { fontSize: 15, color: colors.textSecondary },
  emptyHint: { fontSize: 13, color: colors.textMuted, marginTop: 8 },
  card: {
    backgroundColor: colors.backgroundLight,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  titleWrap: { flex: 1, minWidth: 0 },
  serial: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
  name: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, lineHeight: 22 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeActive: { backgroundColor: colors.successLight },
  badgeInactive: { backgroundColor: colors.errorLight },
  badgeText: { fontSize: 12, fontWeight: '700' },
  badgeTextActive: { color: colors.success },
  badgeTextInactive: { color: colors.error },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6, gap: 8 },
  infoLabel: { width: 110, fontSize: 13, color: colors.textSecondary, paddingTop: 1 },
  infoValue: { flex: 1, fontSize: 14, color: colors.textPrimary, lineHeight: 20 },
});
