import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { apiService } from '../../services/api';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { Card, CardTitle, InfoRow, EmptyState } from '../../ui/Kit';

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
      <ScreenShell title="Vendor Details">
        <EmptyState icon="🔍" title="Partner not found" />
      </ScreenShell>
    );
  }

  const products = partner?.partnerAssignedProducts || [];
  const productNames = products.map((p) =>
    typeof p === 'object' && p && 'productName' in p ? p.productName : String(p)
  );

  return (
    <ScreenShell title="Vendor Details" subtitle="Vendor information and assigned products" loading={loading}>
      <Card>
        <CardTitle
          title={partner?.name || '-'}
          badge={partner?.isActive === false ? 'Inactive' : 'Active'}
          tone={partner?.isActive === false ? 'neutral' : 'success'}
        />
        <InfoRow label="Email" value={partner?.email || '-'} />
        <InfoRow label="Created" value={formatDate(partner?.createdAt)} />
      </Card>

      <PageSection title={`Assigned Products (${productNames.length})`}>
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
      </PageSection>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  productTag: { backgroundColor: colors.infoLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  productTagText: { fontSize: 13, fontWeight: '600', color: colors.primaryDark },
  emptyProducts: { fontSize: 14, color: colors.textSecondary },
});
