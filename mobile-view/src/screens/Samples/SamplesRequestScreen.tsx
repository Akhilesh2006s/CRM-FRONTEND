import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { apiService } from '../../services/api';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebSelect } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';

type ProductSelection = {
  product_name: string;
  quantity: number;
};

export default function SamplesRequestScreen({ navigation }: any) {
  const [products, setProducts] = useState<ProductSelection[]>([]);
  const [purpose, setPurpose] = useState('To show schools');
  const [submitting, setSubmitting] = useState(false);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableProducts, setAvailableProducts] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [requestsData, productsData] = await Promise.all([
        apiService.get('/sample-requests/my').catch(() => []),
        apiService.get('/products/active').catch(() => apiService.get('/products').catch(() => [])),
      ]);
      setMyRequests(Array.isArray(requestsData) ? requestsData : []);
      const prods = Array.isArray(productsData) ? productsData : productsData?.data || [];
      const names = prods
        .map((p: any) =>
          typeof p === 'string' ? p : p.productName || p.product_name || p.name || ''
        )
        .filter(Boolean);
      setAvailableProducts([...new Set(names)]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const addProduct = () => {
    setProducts([...products, { product_name: '', quantity: 1 }]);
  };

  const updateProduct = (index: number, field: keyof ProductSelection, value: string | number) => {
    const updated = [...products];
    updated[index] = { ...updated[index], [field]: value };
    setProducts(updated);
  };

  const removeProduct = (index: number) => {
    setProducts(products.filter((_, i) => i !== index));
  };

  const submitRequest = async () => {
    setSuccessMessage(null);
    setErrorMessage(null);
    if (products.length === 0) {
      setErrorMessage('Please add at least one product');
      return;
    }
    for (const product of products) {
      if (!product.product_name?.trim() || !product.quantity || product.quantity < 1) {
        setErrorMessage('Please fill all product fields correctly');
        return;
      }
    }
    setSubmitting(true);
    try {
      await apiService.post('/sample-requests', { products, purpose });
      setSuccessMessage('Sample request submitted successfully!');
      setProducts([]);
      setPurpose('To show schools');
      loadData();
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('en-IN');
    } catch {
      return '-';
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'Accepted': return colors.success;
      case 'Rejected': return colors.error;
      default: return colors.warning;
    }
  };

  return (
    <ScreenShell title="Request Sample Products" subtitle="Request sample products for school" loading={loading}>
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {successMessage && (
          <MessageBanner type="success" message={successMessage} onDismiss={() => setSuccessMessage(null)} />
        )}
        {errorMessage && (
          <MessageBanner type="error" message={errorMessage} onDismiss={() => setErrorMessage(null)} />
        )}

        <View style={styles.formCard}>
          <View style={styles.formSection}>
            <Text style={styles.label}>Purpose</Text>
            <WebInput style={styles.input} value={purpose} onChangeText={setPurpose} placeholder="To show school" />
          </View>

          <View style={styles.formSection}>
            <View style={styles.productsHeader}>
              <Text style={styles.label}>Products *</Text>
              <TouchableOpacity style={styles.addButton} onPress={addProduct}>
                <Text style={styles.addButtonText}>+ Add Product</Text>
              </TouchableOpacity>
            </View>

            {products.length === 0 ? (
              <View style={styles.emptyProducts}>
                <Text style={styles.emptyProductsText}>No products added. Tap Add Product.</Text>
              </View>
            ) : (
              products.map((product, index) => (
                <View key={index} style={styles.productRow}>
                  <View style={styles.productFields}>
                    {availableProducts.length > 0 ? (
                      <WebSelect
                        label="Product Name"
                        value={product.product_name}
                        onValueChange={(v) => updateProduct(index, 'product_name', v)}
                        items={availableProducts.map((name) => ({ label: name, value: name }))}
                        placeholder="Select product"
                      />
                    ) : (
                      <View style={styles.fieldBlock}>
                        <Text style={styles.fieldLabel}>Product Name</Text>
                        <WebInput
                          style={styles.input}
                          value={product.product_name}
                          onChangeText={(v) => updateProduct(index, 'product_name', v)}
                          placeholder="Product name"
                        />
                      </View>
                    )}
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>Quantity</Text>
                      <WebInput
                        style={styles.input}
                        value={String(product.quantity)}
                        onChangeText={(v) => updateProduct(index, 'quantity', Math.max(1, Number(v) || 1))}
                        keyboardType="number-pad"
                      />
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => removeProduct(index)} style={styles.removeBtn}>
                    <Text style={styles.removeButton}>×</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>

          <TouchableOpacity
            style={[styles.submitButton, (submitting || products.length === 0) && styles.submitDisabled]}
            onPress={submitRequest}
            disabled={submitting || products.length === 0}
          >
            {submitting ? (
              <ActivityIndicator color={colors.textLight} />
            ) : (
              <Text style={styles.submitButtonText}>Submit Request</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.listCard}>
          <Text style={styles.listTitle}>My Sample Requests</Text>
          {myRequests.length === 0 ? (
            <Text style={styles.emptyText}>No sample requests yet</Text>
          ) : (
            myRequests.map((request) => (
              <View key={request._id} style={styles.requestCard}>
                <View style={styles.requestHeader}>
                  <Text style={styles.requestCode}>{request.request_code}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) + '15' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(request.status) }]}>
                      {request.status || 'Pending'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.requestPurpose}>{request.purpose}</Text>
                {request.products?.map((p: any, idx: number) => (
                  <Text key={idx} style={styles.requestProductItem}>
                    {p.product_name} — Qty: {p.quantity}
                  </Text>
                ))}
                <Text style={styles.requestDate}>Created: {formatDate(request.createdAt)}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32 },
  formCard: { backgroundColor: colors.backgroundLight, borderRadius: 16, padding: 20, marginBottom: 20 },
  formSection: { marginBottom: 16 },
  label: { ...typography.body.medium, color: colors.textPrimary, marginBottom: 8, fontWeight: '600' },
  input: { backgroundColor: colors.background, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary },
  productsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  addButton: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  addButtonText: { ...typography.body.small, color: colors.textLight, fontWeight: '600' },
  emptyProducts: { padding: 16, backgroundColor: colors.background, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  emptyProductsText: { ...typography.body.small, color: colors.textSecondary, textAlign: 'center' },
  productRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12, padding: 12, backgroundColor: colors.background, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  productFields: { flex: 1, gap: 8 },
  fieldBlock: { marginBottom: 4 },
  fieldLabel: { ...typography.label.small, color: colors.textSecondary, marginBottom: 4 },
  removeBtn: { paddingTop: 8 },
  removeButton: { fontSize: 28, color: colors.error, fontWeight: 'bold' },
  submitButton: { backgroundColor: colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  submitDisabled: { opacity: 0.5 },
  submitButtonText: { ...typography.body.medium, color: colors.textLight, fontWeight: '600' },
  listCard: { backgroundColor: colors.backgroundLight, borderRadius: 16, padding: 20 },
  listTitle: { ...typography.heading.h3, color: colors.textPrimary, marginBottom: 12 },
  emptyText: { ...typography.body.medium, color: colors.textSecondary, textAlign: 'center', padding: 16 },
  requestCard: { backgroundColor: colors.background, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  requestHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  requestCode: { ...typography.heading.h4, color: colors.textPrimary },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { ...typography.label.small, fontWeight: '600' },
  requestPurpose: { ...typography.body.medium, color: colors.textPrimary, marginBottom: 6 },
  requestProductItem: { ...typography.body.small, color: colors.textSecondary },
  requestDate: { ...typography.body.small, color: colors.textSecondary, marginTop: 8 },
});
