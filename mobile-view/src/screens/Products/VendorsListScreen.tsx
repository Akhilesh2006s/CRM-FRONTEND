import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Modal,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../../services/api';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell from '../../ui/ScreenShell';
import { Card, CardTitle, InfoRow, ActionRow, EmptyState } from '../../ui/Kit';
import { WebButton } from '../../ui/WebPrimitives';
import { navigateRoot } from '../../navigation/navigationRef';

type Partner = {
  _id: string;
  name: string;
  email: string;
  isActive?: boolean;
  createdAt?: string;
  partnerAssignedProducts?: Array<{ _id: string; productName: string } | string>;
};

type Product = { _id: string; productName: string };

function formatDate(value?: string) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '-';
  }
}

function productCount(partner: Partner) {
  return Array.isArray(partner.partnerAssignedProducts) ? partner.partnerAssignedProducts.length : 0;
}

export default function VendorsListScreen() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiService.get('/partners');
      setPartners(Array.isArray(data) ? data : []);
    } catch {
      setPartners([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openEdit = async (partner: Partner) => {
    setSelectedPartner(partner);
    const currentIds =
      partner.partnerAssignedProducts?.map((p) =>
        typeof p === 'object' && p?._id ? String(p._id) : String(p)
      ) || [];
    setSelectedProductIds(currentIds);
    try {
      const data = await apiService.get('/products/active');
      setAvailableProducts(Array.isArray(data) ? data : []);
    } catch {
      setAvailableProducts([]);
    }
    setEditOpen(true);
  };

  const toggleProduct = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const saveProducts = async () => {
    if (!selectedPartner) return;
    if (selectedProductIds.length === 0) {
      Alert.alert('Required', 'At least one product must be assigned to the partner.');
      return;
    }
    setSaving(true);
    try {
      await apiService.put(`/partners/${selectedPartner._id}/products`, {
        assignedProducts: selectedProductIds,
      });
      setEditOpen(false);
      setSelectedPartner(null);
      await load();
      Alert.alert('Saved', 'Products updated successfully.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update products');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenShell
      title="Partners"
      subtitle="Manage partner accounts and product assignments"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
      headerRight={
        <TouchableOpacity onPress={() => navigateRoot('VendorNew')} hitSlop={8} accessibilityLabel="Add Partner">
          <Ionicons name="add-circle" size={28} color={colors.primary} />
        </TouchableOpacity>
      }
    >
      {partners.length === 0 ? (
        <>
          <EmptyState icon="🏢" title="No partners yet" message="Add your first partner to get started." />
          <WebButton title="+ Add Partner" onPress={() => navigateRoot('VendorNew')} />
        </>
      ) : (
        partners.map((partner) => (
          <Card key={partner._id}>
            <CardTitle
              title={partner.name}
              subtitle={partner.email}
              badge={partner.isActive === false ? 'Inactive' : 'Active'}
              tone={partner.isActive === false ? 'neutral' : 'success'}
            />
            <InfoRow label="Products" value={String(productCount(partner))} />
            <InfoRow label="Created" value={formatDate(partner.createdAt)} />
            <ActionRow>
              <WebButton title="View" variant="outline" onPress={() => navigateRoot('VendorDetail', { id: partner._id })} />
              <WebButton title="Edit Products" variant="outline" onPress={() => openEdit(partner)} />
            </ActionRow>
          </Card>
        ))
      )}

      <Modal visible={editOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Products — {selectedPartner?.name}</Text>
              <TouchableOpacity onPress={() => setEditOpen(false)}>
                <Text style={styles.modalClose}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {availableProducts.length === 0 ? (
                <Text style={styles.emptyText}>No products available</Text>
              ) : (
                availableProducts.map((product) => {
                  const checked = selectedProductIds.includes(product._id);
                  return (
                    <TouchableOpacity
                      key={product._id}
                      style={[styles.productRow, checked && styles.productRowOn]}
                      onPress={() => toggleProduct(product._id)}
                    >
                      <Ionicons
                        name={checked ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={checked ? colors.primary : colors.textMuted}
                      />
                      <Text style={styles.productName}>{product.productName}</Text>
                    </TouchableOpacity>
                  );
                })
              )}
              <Text style={styles.selectedCount}>
                Selected: {selectedProductIds.length} product(s)
              </Text>
              <WebButton title={saving ? 'Saving…' : 'Save Changes'} onPress={saveProducts} disabled={saving} />
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 14,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, flex: 1, paddingRight: 8 },
  modalClose: { fontSize: 15, color: colors.primary, fontWeight: '600' },
  modalBody: { padding: 16 },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    marginBottom: 8,
  },
  productRowOn: { borderColor: colors.primary, backgroundColor: colors.infoLight },
  productName: { fontSize: 15, color: colors.textPrimary, flex: 1 },
  selectedCount: { fontSize: 13, color: colors.textSecondary, marginVertical: 12 },
});
