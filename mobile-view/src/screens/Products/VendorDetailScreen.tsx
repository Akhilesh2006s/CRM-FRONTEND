import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { apiService } from '../../services/api';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell from '../../ui/ScreenShell';

type Partner = {
  _id: string;
  name: string;
  email: string;
  isActive?: boolean;
  createdAt?: string;
  partnerAssignedProducts?: Array<{ _id: string; productName: string } | string>;
};

function formatDate(value?: string) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '-';
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

export default function VendorDetailScreen({ route }: any) {
  const { id } = route.params;
  const [partner, setPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiService.get(`/partners/${id}`);
        setPartner(data);
      } catch {
        setPartner(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (!loading && !partner) {
    return (
      <ScreenShell>
        <View style={styles.centered}>
          <Text style={styles.notFound}>Partner not found</Text>
        </View>
      </ScreenShell>
    );
  }

  const products = partner?.partnerAssignedProducts || [];
  const productNames = products.map((p) =>
    typeof p === 'object' && p && 'productName' in p ? p.productName : String(p)
  );

  return (
    <ScreenShell loading={loading}>
      <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
        <Text style={styles.pageTitle}>Vendor Details</Text>
        <Text style={styles.pageSubtitle}>View vendor information and assigned products</Text>

        <View style={styles.card}>
          <View style={styles.grid}>
            <Field label="Vendor Name">
              <Text style={styles.valueBold}>{partner?.name || '-'}</Text>
            </Field>
            <Field label="Email">
              <Text style={styles.value}>{partner?.email || '-'}</Text>
            </Field>
            <Field label="Status">
              <View
                style={[
                  styles.statusBadge,
                  partner?.isActive === false ? styles.statusInactive : styles.statusActive,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    partner?.isActive === false ? styles.statusInactiveText : styles.statusActiveText,
                  ]}
                >
                  {partner?.isActive === false ? 'Inactive' : 'Active'}
                </Text>
              </View>
            </Field>
            <Field label="Created Date">
              <Text style={styles.value}>{formatDate(partner?.createdAt)}</Text>
            </Field>
          </View>

          <View style={styles.divider} />

          <Text style={styles.fieldLabel}>Assigned Products ({productNames.length})</Text>
          {productNames.length === 0 ? (
            <Text style={styles.emptyProducts}>No products assigned</Text>
          ) : (
            <View style={styles.tagsRow}>
              {productNames.map((name, idx) => (
                <View key={`${name}-${idx}`} style={styles.productTag}>
                  <Text style={styles.productTagText}>{name}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  pageContent: { padding: 16, paddingBottom: 32 },
  pageTitle: { ...typography.heading.h1, color: colors.textPrimary, fontSize: 28 },
  pageSubtitle: { ...typography.body.medium, color: colors.textSecondary, marginTop: 4, marginBottom: 20 },
  card: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  field: {
    width: '46%',
    minWidth: 140,
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  value: { fontSize: 16, color: colors.textPrimary },
  valueBold: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusActive: { backgroundColor: '#DCFCE7' },
  statusInactive: { backgroundColor: '#F3F4F6' },
  statusText: { fontSize: 12, fontWeight: '600' },
  statusActiveText: { color: '#166534' },
  statusInactiveText: { color: '#4B5563' },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 20,
  },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  productTag: {
    backgroundColor: colors.backgroundMuted,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  productTagText: { fontSize: 14, color: colors.textPrimary },
  emptyProducts: { ...typography.body.small, color: colors.textSecondary, marginTop: 8 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  notFound: { ...typography.body.medium, color: colors.textSecondary },
});
