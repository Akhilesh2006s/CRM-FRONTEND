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
    <ScreenShell loading={loading && !refreshing}>
      <ScrollView
        style={styles.page}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.pageTitle}>Partners</Text>
            <Text style={styles.pageSubtitle}>Manage partner accounts and product assignments</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => navigateRoot('VendorNew')}>
            <Ionicons name="add-circle-outline" size={18} color="#fff" />
            <Text style={styles.addBtnText}>Add Partner</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          {partners.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="business-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>No partners yet. Add your first partner to get started.</Text>
              <TouchableOpacity style={styles.addBtn} onPress={() => navigateRoot('VendorNew')}>
                <Ionicons name="add-circle-outline" size={18} color="#fff" />
                <Text style={styles.addBtnText}>Add Partner</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={Platform.OS === 'web'}>
              <View style={styles.table}>
                <View style={styles.tableHead}>
                  <Text style={[styles.th, styles.colName]}>Partner Name</Text>
                  <Text style={[styles.th, styles.colEmail]}>Email</Text>
                  <Text style={[styles.th, styles.colCount]}>Assigned Products Count</Text>
                  <Text style={[styles.th, styles.colStatus]}>Status</Text>
                  <Text style={[styles.th, styles.colDate]}>Created Date</Text>
                  <Text style={[styles.th, styles.colActions]}>Actions</Text>
                </View>
                {partners.map((partner) => (
                  <View key={partner._id} style={styles.tableRow}>
                    <Text style={[styles.td, styles.colName, styles.nameCell]}>{partner.name}</Text>
                    <Text style={[styles.td, styles.colEmail, styles.mutedCell]}>{partner.email}</Text>
                    <Text style={[styles.td, styles.colCount]}>{productCount(partner)}</Text>
                    <View style={[styles.td, styles.colStatus]}>
                      <View
                        style={[
                          styles.statusBadge,
                          partner.isActive === false ? styles.statusInactive : styles.statusActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            partner.isActive === false ? styles.statusInactiveText : styles.statusActiveText,
                          ]}
                        >
                          {partner.isActive === false ? 'Inactive' : 'Active'}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.td, styles.colDate, styles.mutedCell]}>{formatDate(partner.createdAt)}</Text>
                    <View style={[styles.td, styles.colActions, styles.actionsCell]}>
                      <TouchableOpacity
                        style={styles.viewBtn}
                        onPress={() => navigateRoot('VendorDetail', { id: partner._id })}
                      >
                        <Ionicons name="eye-outline" size={16} color={colors.textPrimary} />
                        <Text style={styles.viewBtnText}>View</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(partner)}>
                        <Ionicons name="pencil-outline" size={16} color="#1D4ED8" />
                        <Text style={styles.editBtnText}>Edit</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      </ScrollView>

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
  page: { flex: 1, padding: 16, backgroundColor: colors.background },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    gap: 12,
    flexWrap: 'wrap',
  },
  headerText: { flex: 1, minWidth: 200 },
  pageTitle: { ...typography.heading.h1, color: colors.textPrimary, fontSize: 28 },
  pageSubtitle: { ...typography.body.medium, color: colors.textSecondary, marginTop: 4 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  card: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  table: { minWidth: 900 },
  tableHead: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingVertical: 14,
  },
  th: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  td: { fontSize: 14, color: colors.textPrimary },
  colName: { width: 140 },
  colEmail: { width: 200 },
  colCount: { width: 180 },
  colStatus: { width: 100 },
  colDate: { width: 120 },
  colActions: { width: 200 },
  nameCell: { fontWeight: '600' },
  mutedCell: { color: colors.textSecondary },
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
  actionsCell: { flexDirection: 'row', gap: 8 },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  viewBtnText: { fontSize: 13, fontWeight: '500', color: colors.textPrimary },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#fff',
  },
  editBtnText: { fontSize: 13, fontWeight: '500', color: '#1D4ED8' },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { ...typography.body.medium, color: colors.textSecondary, textAlign: 'center' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { ...typography.heading.h3, flex: 1, paddingRight: 8 },
  modalClose: { color: colors.primary, fontWeight: '600' },
  modalBody: { padding: 16 },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  productRowOn: { borderColor: colors.primary, backgroundColor: colors.infoLight },
  productName: { ...typography.body.medium, flex: 1 },
  selectedCount: { ...typography.body.small, color: colors.textSecondary, marginVertical: 12 },
});
