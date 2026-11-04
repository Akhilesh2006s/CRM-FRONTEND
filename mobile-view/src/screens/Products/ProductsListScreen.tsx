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
import { WebInput, WebButton } from '../../ui/WebPrimitives';
import { Card, CardTitle, InfoRow, ChipRow, ActionRow, EmptyState } from '../../ui/Kit';
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

  const words = searchTerm.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = products.filter((p) => {
    if (!words.length) return true;
    const text = [
      p.productName,
      formatList(p.productLevels),
      p.hasSubjects ? formatList(p.subjects) : '',
      p.hasSpecs ? formatList(p.specs) : '',
      p.hasCategory ? formatList(p.categories) : '',
      p.prodStatus === 1 ? 'available' : 'not available',
      formatCreatedDate(p.createdAt),
    ]
      .join(' ')
      .toLowerCase();
    return words.every((w) => text.includes(w));
  });

  return (
    <ScreenShell
      title="All Products"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
      headerRight={
        <TouchableOpacity
          onPress={() => navigation.navigate('ProductNew')}
          hitSlop={8}
          accessibilityLabel="Add Product"
        >
          <Ionicons name="add-circle" size={28} color={colors.primary} />
        </TouchableOpacity>
      }
    >
      <WebInput
        value={searchTerm}
        onChangeText={setSearchTerm}
        placeholder="Search name, level, deliverables, specs, series..."
        autoCorrect={false}
      />
      <ChipRow
        items={[
          { key: 'all', label: 'All' },
          { key: '1', label: 'Available' },
          { key: '0', label: 'Not Available' },
        ]}
        value={statusFilter}
        onChange={(k: string) => setStatusFilter(k as 'all' | '1' | '0')}
      />
      <View style={{ height: 12 }} />

      {filtered.length === 0 ? (
        <EmptyState icon="📦" title="No products found" />
      ) : (
        filtered.map((product) => {
          const available = product.prodStatus === 1;
          return (
            <Card key={product._id}>
              <CardTitle
                title={product.productName || 'N/A'}
                badge={available ? 'Available' : 'Not Available'}
                tone={available ? 'success' : 'neutral'}
              />
              <InfoRow label="Term / Level" value={formatList(product.productLevels)} />
              <InfoRow label="Deliverables" value={product.hasSubjects ? formatList(product.subjects) : '-'} />
              <InfoRow label="Specs" value={product.hasSpecs ? formatList(product.specs) : '-'} />
              <InfoRow label="Series" value={product.hasCategory ? formatList(product.categories) : '-'} />
              <InfoRow label="Created" value={formatCreatedDate(product.createdAt)} />
              <ActionRow>
                <WebButton
                  title="Edit"
                  variant="outline"
                  onPress={() => navigation.navigate('ProductEdit', { id: product._id })}
                />
                <WebButton title="Delete" variant="destructive" onPress={() => handleDelete(product)} />
              </ActionRow>
            </Card>
          );
        })
      )}

      <Modal visible={!!productToDelete} transparent animationType="fade" onRequestClose={() => !deleting && setProductToDelete(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.confirmDialog}>
            <Text style={styles.confirmTitle}>Delete Product</Text>
            <Text style={styles.confirmMessage}>
              Are you sure you want to delete “{productToDelete?.productName || 'this product'}”?
            </Text>
            <View style={styles.confirmActions}>
              <View style={{ flex: 1 }}>
                <WebButton title="Cancel" variant="outline" onPress={() => setProductToDelete(null)} disabled={deleting} />
              </View>
              <View style={{ flex: 1 }}>
                <WebButton title="Delete" variant="destructive" onPress={confirmDelete} loading={deleting} disabled={deleting} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  confirmDialog: { backgroundColor: colors.backgroundLight, borderRadius: 14, padding: 16 },
  confirmTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  confirmMessage: { fontSize: 15, color: colors.textSecondary, marginBottom: 16 },
  confirmActions: { flexDirection: 'row', gap: 8 },
});
