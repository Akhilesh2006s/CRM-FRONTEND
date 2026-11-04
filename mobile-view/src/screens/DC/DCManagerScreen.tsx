import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { colors } from '../../theme/colors';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebButton } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';

export default function DCManagerScreen({ navigation }: any) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await apiService.get('/dc/stats/employee');
      setStats(data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  const tiles = stats
    ? [
        { label: 'Pending DC', sub: 'Awaiting review', value: stats.byStatus?.Pending || 0, tone: 'info' as const, onPress: () => navigation.navigate('DCPending') },
        { label: 'Delivery Pending', sub: 'Awaiting approval', value: stats.byStatus?.Employee || 0, tone: 'warning' as const, onPress: () => navigation.navigate('DCList', { type: 'employee' }) },
        { label: 'Completed', sub: 'Delivered', value: stats.byStatus?.Completed || 0, tone: 'success' as const, onPress: () => navigation.navigate('DCList', { type: 'completed' }) },
        { label: 'On Hold', sub: 'Needs attention', value: stats.byStatus?.Hold || 0, tone: 'error' as const, onPress: () => navigation.navigate('DCList', { type: 'hold' }) },
        { label: 'Total DC', sub: 'All DCs', value: stats.total || 0, tone: 'neutral' as const, onPress: undefined },
      ]
    : [];
  const TONE_COLOR: Record<string, string> = { info: '#1D4ED8', warning: '#B45309', success: '#15803D', error: '#B91C1C', neutral: colors.textPrimary };

  return (
    <ScreenShell title="Manager DC Dashboard" loading={loading}>
      {stats && (
        <>
          <View style={styles.statsGrid}>
            {tiles.map((t) => (
              <TouchableOpacity key={t.label} style={styles.statCard} onPress={t.onPress} disabled={!t.onPress} activeOpacity={0.8}>
                <Text style={styles.statLabel}>{t.label}</Text>
                <Text style={[styles.statValue, { color: TONE_COLOR[t.tone] }]}>{t.value}</Text>
                <Text style={styles.statSubtext}>{t.sub}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <PageSection title="Quick actions">
            <WebButton title="Review Pending DCs" onPress={() => navigation.navigate('DCPending')} />
            <WebButton title="View Closed Sales" variant="outline" onPress={() => navigation.navigate('DCClosed')} />
          </PageSection>
        </>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  statCard: { flexGrow: 1, flexBasis: '45%', backgroundColor: colors.backgroundLight, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#EEF2F7' },
  statLabel: { fontSize: 13, fontWeight: '600', color: colors.textTertiary },
  statValue: { fontSize: 26, fontWeight: '700', marginTop: 4 },
  statSubtext: { fontSize: 13, color: colors.textTertiary, marginTop: 2 },
});
