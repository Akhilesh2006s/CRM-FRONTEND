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
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { Card, CardTitle, InfoRow, EmptyState, SectionTitle, toneFor } from '../../ui/Kit';
import { WebInput, WebSelect, WebButton, WebLabel } from '../../ui/WebPrimitives';
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
      setAvailableProducts([...new Set(names as string[])]);
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
      return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
      {successMessage && (
        <MessageBanner type="success" message={successMessage} onDismiss={() => setSuccessMessage(null)} />
      )}
      {errorMessage && (
        <MessageBanner type="error" message={errorMessage} onDismiss={() => setErrorMessage(null)} />
      )}

      <PageSection title="New Request">
        <WebLabel>Purpose</WebLabel>
        <WebInput value={purpose} onChangeText={setPurpose} placeholder="To show school" />

        <View style={styles.productsHeader}>
          <WebLabel>Products *</WebLabel>
          <TouchableOpacity style={styles.addButton} onPress={addProduct}>
            <Text style={styles.addButtonText}>+ Add Product</Text>
          </TouchableOpacity>
        </View>

        {products.length === 0 ? (
          <Text style={styles.emptyProductsText}>No products added. Tap Add Product.</Text>
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
                  <>
                    <WebLabel>Product Name</WebLabel>
                    <WebInput
                      value={product.product_name}
                      onChangeText={(v) => updateProduct(index, 'product_name', v)}
                      placeholder="Product name"
                    />
                  </>
                )}
                <WebLabel>Quantity</WebLabel>
                <WebInput
                  style={{ marginBottom: 0 }}
                  value={String(product.quantity)}
                  onChangeText={(v) => updateProduct(index, 'quantity', Math.max(1, Number(v) || 1))}
                  keyboardType="number-pad"
                />
              </View>
              <TouchableOpacity onPress={() => removeProduct(index)} style={styles.removeBtn} accessibilityLabel="Remove product">
                <Text style={styles.removeButton}>×</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </PageSection>

      <WebButton
        title="Submit Request"
        onPress={submitRequest}
        loading={submitting}
        disabled={submitting || products.length === 0}
      />

      <SectionTitle>My Sample Requests</SectionTitle>
      {myRequests.length === 0 ? (
        <EmptyState icon="🧪" title="No sample requests yet" />
      ) : (
        myRequests.map((request) => (
          <Card key={request._id}>
            <CardTitle
              title={request.request_code || 'Request'}
              subtitle={request.purpose || undefined}
              badge={request.status || 'Pending'}
              tone={toneFor(request.status || 'Pending')}
            />
            {request.products?.map((p: any, idx: number) => (
              <InfoRow key={idx} label={p.product_name || 'Product'} value={`Qty ${p.quantity}`} />
            ))}
            <InfoRow label="Created" value={formatDate(request.createdAt)} />
          </Card>
        ))
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  productsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  addButton: { borderWidth: 1, borderColor: '#DCE3EC', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  addButtonText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  emptyProductsText: { fontSize: 13, color: colors.textTertiary, textAlign: 'center', paddingVertical: 12 },
  productRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12, padding: 12, backgroundColor: colors.background, borderRadius: 12, borderWidth: 1, borderColor: '#EEF2F7' },
  productFields: { flex: 1 },
  removeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.errorLight, alignItems: 'center', justifyContent: 'center' },
  removeButton: { fontSize: 18, color: colors.error, fontWeight: '700' },
});
