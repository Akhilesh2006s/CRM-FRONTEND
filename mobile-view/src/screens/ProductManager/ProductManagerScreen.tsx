import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { apiService } from '../../services/api';
import { colors } from '../../theme/colors';
import ScreenShell from '../../ui/ScreenShell';
import { Card, CardTitle, InfoRow, toneFor } from '../../ui/Kit';
import { useAuth } from '../../context/AuthContext';
import PendingAdvanceApprovalsCard from '../../components/PendingAdvanceApprovalsCard';

type Dashboard = {
  manager: { name: string };
  products: Array<{ name: string }>;
  schools: Array<{
    schoolName: string;
    schoolCode: string;
    zone: string;
    cluster: string;
    zonalManager: string;
    products: Array<{ name: string; relationship: string }>;
    bdeName: string;
    deliveryStatus: string;
  }>;
  bdes: Array<{ _id: string; name: string; email: string; phone: string; zone: string; schools: string[] }>;
  deliveries: Array<{ id: string; schoolName: string; products: string[]; status: string }>;
  trainers: Array<{ _id: string; name: string; completionRate: number; completed: number; feedbackOnFile: number }>;
};

export default function ProductManagerScreen({ embedded, managerId, header }: { embedded?: boolean; managerId?: string; navigation?: any; header?: React.ReactNode }) {
  const [showSchools, setShowSchools] = useState(!embedded);
  const { user } = useAuth();
  const id = managerId || user?._id;
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    apiService
      .get(`/product-manager/${id}/dashboard`)
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message || 'Failed to load assigned products');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const body = loading || error || !data ? (
    <ScrollView contentContainerStyle={styles.content}>
      {header}
      {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} /> : error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  ) : (
    <ScrollView contentContainerStyle={styles.content}>
      {header}
      <PendingAdvanceApprovalsCard />
      <Card>
        <CardTitle title={data.manager?.name || 'Product Manager'} subtitle="Product Manager" />
        <Text style={styles.meta}>
          {(data.products || []).map((item) => item.name).join(', ') || 'No products assigned yet'}
        </Text>
      </Card>
      <TouchableOpacity style={styles.foldRow} onPress={() => setShowSchools((v) => !v)} activeOpacity={0.7}>
        <Text style={styles.foldTitle}>Schools ({data.schools?.length || 0})</Text>
        <Text style={styles.foldLink}>{showSchools ? 'Hide ▲' : 'Show ▼'}</Text>
      </TouchableOpacity>
      {(showSchools ? data.schools || [] : []).map((school) => (
        <Card key={`${school.schoolCode}-${school.schoolName}`}>
          <CardTitle
            title={school.schoolName}
            subtitle={school.schoolCode || undefined}
            badge={school.deliveryStatus || undefined}
            tone={toneFor(school.deliveryStatus)}
          />
          <InfoRow label="Zone" value={school.zone || '—'} />
          <InfoRow label="Cluster" value={school.cluster || '—'} />
          <InfoRow label="Zonal Manager" value={school.zonalManager || '—'} />
          <InfoRow label="BDE" value={school.bdeName || 'No BDE'} />
          <InfoRow label="Products" value={(school.products || []).map((item) => `${item.name} (${item.relationship})`).join(', ')} />
        </Card>
      ))}
      <Text style={styles.section}>BDEs ({data.bdes?.length || 0})</Text>
      {(data.bdes || []).map((bde) => (
        <Card key={bde._id}>
          <CardTitle title={bde.name} subtitle={bde.zone || undefined} />
          <InfoRow label="Email" value={bde.email} />
          <InfoRow label="Phone" value={bde.phone} phone />
          <InfoRow label="Schools" value={(bde.schools || []).filter(Boolean).join(', ')} />
        </Card>
      ))}
      <Text style={styles.section}>Delivery ({data.deliveries?.length || 0})</Text>
      {(data.deliveries || []).slice(0, 40).map((row) => (
        <Card key={row.id}>
          <CardTitle title={row.schoolName} badge={row.status || undefined} tone={toneFor(row.status)} />
          <InfoRow label="Products" value={(row.products || []).join(', ')} />
        </Card>
      ))}
      <Text style={styles.section}>Trainers</Text>
      {(data.trainers || []).map((trainer) => (
        <Card key={trainer._id}>
          <CardTitle title={trainer.name} badge={`${trainer.completionRate}%`} tone="info" />
          <InfoRow label="Completed" value={String(trainer.completed)} />
          <InfoRow label="Feedback forms" value={String(trainer.feedbackOnFile)} />
        </Card>
      ))}
    </ScrollView>
  );

  if (embedded) return <View style={{ flex: 1 }}>{body}</View>;
  return <ScreenShell title="My Products">{body}</ScreenShell>;
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  section: {
    marginTop: 8,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  foldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    paddingHorizontal: 16,
    minHeight: 48,
    marginBottom: 12,
  },
  foldTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  foldLink: { fontSize: 14, fontWeight: '600', color: colors.primaryDark },
  meta: { color: colors.textTertiary, fontSize: 13, lineHeight: 18 },
  error: { color: colors.error, padding: 16, fontSize: 14 },
});
