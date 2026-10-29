import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { apiService } from '../../services/api';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput } from '../../ui/WebPrimitives';
import { useAuth } from '../../context/AuthContext';

type Product = {
  _id: string;
  productName?: string;
  productLevels?: string[];
  hasSubjects?: boolean;
  subjects?: string[];
  hasSpecs?: boolean;
  specs?: string | string[];
  hasCategory?: boolean;
  categories?: string[];
  prodStatus?: number;
  createdAt?: string;
};

function formatCreatedDate(dateString?: string) {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '-';
  }
}

function formatList(items?: string[] | string | null) {
  if (Array.isArray(items)) return items.length ? items.join(', ') : '-';
  if (typeof items === 'string' && items.trim()) return items;
  return '-';
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function ProductsListScreen({ navigation }: any) {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | '1' | '0'>('all');
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      let endpoint = '/products';
      if (statusFilter !== 'all') {
        endpoint += `?status=${statusFilter}`;
      }
      const data = await apiService.get(endpoint);
      setProducts(Array.isArray(data) ? data : []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load products');
      setProducts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (user && (user.role === 'Admin' || user.role === 'Super Admin')) {
      loadData();
    } else {
      Alert.alert('Access Denied', 'Admin privileges required', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
  }, [user, loadData, navigation]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleDelete = (product: Product) => {
    setProductToDelete(product);
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;
    setDeleting(true);
    try {
      await apiService.delete(`/products/${productToDelete._id}`);
      setProducts((prev) => prev.filter((product) => product._id !== productToDelete._id));
      setProductToDelete(null);
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Failed to delete product';
      Alert.alert('Error', message);
    } finally {
      setDeleting(false);
    }
  };

  const filtered = products.filter((p) =>
    (p.productName || '').toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <ScreenShell
      title="All Products"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
      noScroll
      headerRight={
        <TouchableOpacity
          onPress={() => navigation.navigate('ProductNew')}
          hitSlop={8}
          style={styles.headerAdd}
        >
          <Ionicons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      }
    >
      <View style={styles.filterContainer}>
        <WebInput
          style={styles.searchInput}
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholder="Search products..."
        />
        <View style={styles.filterTabs}>
          {(['all', '1', '0'] as const).map((filterType) => (
            <TouchableOpacity
              key={filterType}
              style={[styles.filterTab, statusFilter === filterType && styles.filterTabActive]}
              onPress={() => setStatusFilter(filterType)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  statusFilter === filterType && styles.filterTabTextActive,
                ]}
              >
                {filterType === 'all' ? 'All' : filterType === '1' ? 'Available' : 'Not Available'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No products found</Text>
          </View>
        ) : (
          filtered.map((product) => {
            const available = product.prodStatus === 1;
            return (
              <View key={product._id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.productName}>{product.productName || 'N/A'}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: available ? '#DCFCE7' : '#F1F5F9' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        { color: available ? '#15803D' : '#64748B' },
                      ]}
                    >
                      {available ? 'Available' : 'Not Available'}
                    </Text>
                  </View>
                </View>

                <InfoRow label="Term / Level" value={formatList(product.productLevels)} />
                <InfoRow
                  label="Deliverables"
                  value={
                    product.hasSubjects ? formatList(product.subjects) : '-'
                  }
                />
                <InfoRow
                  label="Specs"
                  value={product.hasSpecs ? formatList(product.specs) : '-'}
                />
                <InfoRow
                  label="Series"
                  value={product.hasCategory ? formatList(product.categories) : '-'}
                />
                <InfoRow label="Created Date" value={formatCreatedDate(product.createdAt)} />

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => navigation.navigate('ProductEdit', { id: product._id })}
                  >
                    <Ionicons name="create-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(product)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={!!productToDelete} transparent animationType="fade" onRequestClose={() => !deleting && setProductToDelete(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.confirmDialog}>
            <Text style={styles.confirmTitle}>Delete Product</Text>
            <Text style={styles.confirmMessage}>
              Are you sure you want to delete “{productToDelete?.productName || 'this product'}”?
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setProductToDelete(null)} disabled={deleting}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmDeleteButton, deleting && styles.confirmDeleteButtonDisabled]} onPress={confirmDelete} disabled={deleting}>
                {deleting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.confirmDeleteButtonText}>Delete</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  headerAdd: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchInput: { marginBottom: 12 },
  filterTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  filterTabActive: { backgroundColor: colors.primary },
  filterTabText: { ...typography.label.medium, color: colors.textSecondary },
  filterTabTextActive: { color: '#FFFFFF', fontWeight: '600' },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32 },
  emptyContainer: { paddingVertical: 60, alignItems: 'center' },
  emptyText: { ...typography.heading.h3, color: colors.textSecondary },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  productName: { ...typography.heading.h3, color: colors.textPrimary, flex: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusBadgeText: { ...typography.label.small, fontWeight: '600' },
  infoRow: { flexDirection: 'row', marginBottom: 6, gap: 8 },
  infoLabel: { width: 100, ...typography.body.small, color: colors.textSecondary },
  infoValue: { flex: 1, ...typography.body.medium, color: colors.textPrimary },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  editBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  actionRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DC2626',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  deleteBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  modalOverlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(15, 23, 42, 0.55)' },
  confirmDialog: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20 },
  confirmTitle: { ...typography.heading.h3, color: colors.textPrimary, marginBottom: 10 },
  confirmMessage: { ...typography.body.medium, color: colors.textSecondary, lineHeight: 21 },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 22 },
  cancelButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  cancelButtonText: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  confirmDeleteButton: { minWidth: 82, minHeight: 40, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#DC2626', justifyContent: 'center', alignItems: 'center' },
  confirmDeleteButtonDisabled: { opacity: 0.6 },
  confirmDeleteButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
