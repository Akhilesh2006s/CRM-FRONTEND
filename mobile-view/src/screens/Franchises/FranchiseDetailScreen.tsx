import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { apiService } from '../../services/api';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { Card, CardTitle, InfoRow, SectionTitle } from '../../ui/Kit';
import { colors } from '../../theme/colors';

export default function FranchiseDetailScreen({ route }: any) {
  const { email } = route.params;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const decoded = decodeURIComponent(email);
        const res = await apiService.get(`/franchises/${encodeURIComponent(decoded)}/dashboard`);
        setData(res);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [email]);

  if (!data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFound}>Franchise not found</Text>
      </View>
    );
  }

  return (
    <ScreenShell title="Franchise Detail" loading={loading}>
      <Card>
        <CardTitle title={data.franchiseName || 'Franchise'} subtitle={data.franchiseEmail} />
        <InfoRow label="Schools" value={String(data.totalSchools ?? 0)} bold />
        <InfoRow label="Zones" value={String(data.totalZones ?? 0)} bold />
      </Card>
      {(data.assignedSchools || []).length ? <SectionTitle>Assigned schools</SectionTitle> : null}
      {(data.assignedSchools || []).slice(0, 20).map((s: any) => (
        <Card key={s._id}>
          <CardTitle title={s.schoolName} />
          <InfoRow label="Zone" value={s.zone} />
          <InfoRow label="Mobile" value={s.contactMobile} phone />
        </Card>
      ))}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  notFound: { fontSize: 15, color: colors.textSecondary },
});
