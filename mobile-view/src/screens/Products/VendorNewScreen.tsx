import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiService } from '../../services/api';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebLabel, WebButton } from '../../ui/WebPrimitives';
import { EmptyState } from '../../ui/Kit';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

type Product = { _id: string; productName?: string; name?: string };

export default function VendorNewScreen({ navigation }: any) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiService.get('/products');
        const entries = Array.isArray(data) ? data : data?.data || [];
        setProducts(entries);
      } catch (error: any) {
        Alert.alert('Unable to load products', error.message || 'Please refresh and try again.');
      } finally {
        setLoadingProducts(false);
      }
    })();
  }, []);

  const toggleProduct = (id: string) => {
    setSelectedProductIds((current) => current.includes(id) ? current.filter((productId) => productId !== id) : [...current, id]);
  };

  const selectAll = () => setSelectedProductIds((current) => current.length === products.length ? [] : products.map((product) => product._id));

  const save = async () => {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert('Required', 'Partner name, email, and password are required.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Invalid password', 'Password must be at least 6 characters.');
      return;
    }
    if (selectedProductIds.length === 0) {
      Alert.alert('Required', 'Select at least one product for this partner.');
      return;
    }
    setSaving(true);
    try {
      await apiService.post('/partners', { name: name.trim(), email: email.trim(), password, assignedProducts: selectedProductIds });
      Alert.alert('Partner saved', 'Partner saved successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create partner');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenShell title="Add Partner" subtitle="Create a partner account and assign products" loading={loadingProducts}>
      <PageSection title="Partner Details">
        <WebLabel>Partner Name *</WebLabel>
        <WebInput value={name} onChangeText={setName} placeholder="Enter partner name" />
        <WebLabel>Partner Email *</WebLabel>
        <WebInput value={email} onChangeText={setEmail} placeholder="Used for login" autoCapitalize="none" keyboardType="email-address" />
        <WebLabel>Partner Password *</WebLabel>
        <WebInput value={password} onChangeText={setPassword} placeholder="Min 6 characters" secureTextEntry />
        <Text style={styles.helper}>Minimum 6 characters.</Text>
      </PageSection>

      <PageSection title="Assign Products">
        <View style={styles.productsHeader}>
          <Text style={[styles.helper, { flex: 1 }]}>At least one product is required.</Text>
          <TouchableOpacity style={styles.selectAll} onPress={selectAll} disabled={products.length === 0}>
            <Text style={styles.selectAllText}>{selectedProductIds.length === products.length && products.length ? 'Clear All' : 'Select All'}</Text>
          </TouchableOpacity>
        </View>
        {loadingProducts ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : products.length === 0 ? (
          <EmptyState icon="📦" title="No active products available" />
        ) : (
          <View style={styles.productList}>
            {products.map((product) => {
              const selected = selectedProductIds.includes(product._id);
              return (
                <TouchableOpacity
                  key={product._id}
                  style={styles.productOption}
                  onPress={() => toggleProduct(product._id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                >
                  <View style={[styles.checkbox, selected && styles.checkboxSelected]}>{selected && <Text style={styles.checkmark}>✓</Text>}</View>
                  <Text style={styles.productText}>{product.productName || product.name || 'Unnamed product'}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        <Text style={styles.selectedCount}>Selected: {selectedProductIds.length} product{selectedProductIds.length === 1 ? '' : 's'}</Text>
      </PageSection>

      <View style={styles.actions}>
        <View style={{ flex: 1 }}>
          <WebButton title="Cancel" variant="outline" onPress={() => navigation.goBack()} disabled={saving} />
        </View>
        <View style={{ flex: 1.5 }}>
          <WebButton title="Save Partner" onPress={save} loading={saving} disabled={saving} />
        </View>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  helper: { fontSize: 13, color: colors.textTertiary, marginTop: -8, marginBottom: 12 },
  productsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  selectAll: { borderWidth: 1, borderColor: '#DCE3EC', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  selectAllText: { fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
  productList: { borderWidth: 1, borderColor: '#EEF2F7', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 },
  productOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: '#CBD5E1', marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  checkmark: { color: '#fff', fontWeight: '800', fontSize: 14 },
  productText: { fontSize: 15, color: colors.textPrimary },
  selectedCount: { fontSize: 13, color: colors.textSecondary, marginTop: 12 },
  loader: { marginVertical: 20 },
  actions: { flexDirection: 'row', gap: 8 },
});
