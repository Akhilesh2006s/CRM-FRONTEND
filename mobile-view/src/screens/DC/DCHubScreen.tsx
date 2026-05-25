import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { apiService } from '../../services/api';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebButton } from '../../ui/WebPrimitives';
import { colors, radii, spacing } from '../../theme/colors';
import { navigateRoot } from '../../navigation/navigationRef';

type Stats = {
  total: number;
  byStatus: { Pending: number; Processing: number; Saved: number; Closed: number };
};

/** Matches web `dashboard/dc` Deal Conversion hub */
export default function DCHubScreen() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiService.get('/dc/stats/employee');
        setStats(data);
      } catch {
        setStats(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const tiles = stats
    ? [
        { label: 'Processing', value: stats.byStatus.Processing, screen: 'DCPending' as const },
        { label: 'Saved', value: stats.byStatus.Saved, screen: 'DCSaved' as const },
        { label: 'Closed', value: stats.byStatus.Closed, screen: 'DCClosed' as const },
        { label: 'Pending', value: stats.byStatus.Pending, screen: null },
        { label: 'Total', value: stats.total, screen: null },
      ]
    : [];

  return (
    <ScreenShell title="Deal Conversion" subtitle="DC pipeline overview" loading={loading}>
      <WebButton title="Create Sale" onPress={() => navigateRoot('DCCreate')} />
      <PageSection title="Status summary">
        <View style={styles.grid}>
          {tiles.map((t) => (
            <TouchableOpacity
              key={t.label}
              style={styles.tile}
              disabled={!t.screen}
              onPress={() => t.screen && navigateRoot(t.screen)}
            >
              <Text style={styles.tileLabel}>{t.label}</Text>
              <Text style={styles.tileValue}>{t.value}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </PageSection>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    width: '47%',
    padding: spacing.md,
    backgroundColor: colors.backgroundLight,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tileLabel: { fontSize: 12, color: colors.textSecondary },
  tileValue: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, marginTop: 4 },
});
