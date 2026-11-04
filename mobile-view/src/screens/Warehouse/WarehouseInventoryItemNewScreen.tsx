import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { apiService } from '../../services/api';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebSelect, WebButton, WebLabel } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';
import {
  getCatalogProductNames,
  getProductLevelsOptions,
  getProductSpecsOptions,
  getProductSubjectsOptions,
  getProductCategoryOptions,
} from '../../utils/productCatalog';

const FIXED_VENDOR = 'Vendor 1';

function toSelectItems(options: string[]) {
  return options.map((o) => ({ label: o, value: o }));
}

export default function WarehouseInventoryItemNewScreen({ navigation }: any) {
  const [products, setProducts] = useState<any[]>([]);
  const [form, setForm] = useState({
    productName: '',
    category: '',
    level: '',
    specs: '',
    subject: '',
    quantity: '',
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const levelOptions = useMemo(
    () => (form.productName ? getProductLevelsOptions(products, form.productName) : []),
    [products, form.productName],
  );
  const specsOptions = useMemo(
    () => (form.productName ? getProductSpecsOptions(products, form.productName) : []),
    [products, form.productName],
  );
  const subjectOptions = useMemo(
    () => (form.productName ? getProductSubjectsOptions(products, form.productName) : []),
    [products, form.productName],
  );
  const categoryOptions = useMemo(
    () => (form.productName ? getProductCategoryOptions(products, form.productName) : []),
    [products, form.productName],
  );

  const showLevels = levelOptions.length > 0;
  const showSpecs = specsOptions.length > 0;
  const showSubjects = subjectOptions.length > 0;
  const showCategories = categoryOptions.length > 0;

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const productList = await apiService
        .get('/products/active')
        .catch(() => apiService.get('/products'));
      setProducts(Array.isArray(productList) ? productList : []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  function syncFieldsForProduct(name: string) {
    const levels = getProductLevelsOptions(products, name);
    const specsList = getProductSpecsOptions(products, name);
    const categories = getProductCategoryOptions(products, name);
    const subjects = getProductSubjectsOptions(products, name);

    setForm((f) => ({
      ...f,
      productName: name,
      level: levels.length > 0 ? levels[0] : '',
      specs: specsList.length > 0 ? specsList[0] : '',
      category: categories.length > 0 ? categories[0] : '',
      subject: subjects.length > 0 ? subjects[0] : '',
    }));
  }

  const clearMessages = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleSubmit = async () => {
    clearMessages();
    if (!form.productName?.trim()) {
      setErrorMessage('Product is required');
      return;
    }
    if (showLevels && !form.level) {
      setErrorMessage('Level is required for this product');
      return;
    }
    if (showSpecs && !form.specs) {
      setErrorMessage('Specs is required for this product');
      return;
    }
    if (showCategories && !form.category) {
      setErrorMessage('Product category is required for this product');
      return;
    }
    if (showSubjects && !form.subject) {
      setErrorMessage('Subject is required for this product');
      return;
    }
    if (!form.quantity) {
      setErrorMessage('Quantity is required');
      return;
    }

    setSubmitting(true);
    try {
      await apiService.post('/warehouse', {
        productName: form.productName,
        category: form.category || undefined,
        level: form.level || undefined,
        specs: form.specs || undefined,
        subject: form.subject || undefined,
        itemType: FIXED_VENDOR,
        currentStock: parseFloat(form.quantity) || 0,
      });
      setSuccessMessage('Item added successfully.');
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to add item');
    } finally {
      setSubmitting(false);
    }
  };

  const productNames = getCatalogProductNames(products);


  return (
    <ScreenShell title="Add Item Details" loading={loading}>
      <PageSection title="Item Details">
        <Text style={styles.helper}>Fields come from Product Master for the selected product.</Text>

        {successMessage && (
          <MessageBanner
            type="success"
            message={successMessage}
            actionLabel="View Inventory"
            onAction={() => navigation.navigate('WarehouseInventoryItems')}
          />
        )}
        {errorMessage && (
          <MessageBanner type="error" message={errorMessage} onDismiss={clearMessages} />
        )}

        <WebSelect
          label="Product *"
          value={form.productName}
          onValueChange={syncFieldsForProduct}
          placeholder="Select Product"
          items={toSelectItems(productNames)}
        />

        {showCategories && (
          <WebSelect
            label="Product Category *"
            value={form.category}
            onValueChange={(category) => setForm((f) => ({ ...f, category }))}
            placeholder="Select Product Category"
            disabled={!form.productName}
            items={toSelectItems(categoryOptions)}
          />
        )}

        {showLevels && (
          <WebSelect
            label="Level *"
            value={form.level}
            onValueChange={(level) => setForm((f) => ({ ...f, level }))}
            placeholder="Select Level"
            disabled={!form.productName}
            items={toSelectItems(levelOptions)}
          />
        )}

        {showSpecs && (
          <WebSelect
            label="Specs *"
            value={form.specs}
            onValueChange={(specs) => setForm((f) => ({ ...f, specs }))}
            placeholder="Select Specs"
            disabled={!form.productName}
            items={toSelectItems(specsOptions)}
          />
        )}

        {showSubjects && (
          <WebSelect
            label="Subject *"
            value={form.subject}
            onValueChange={(subject) => setForm((f) => ({ ...f, subject }))}
            placeholder="Select Subject"
            disabled={!form.productName}
            items={toSelectItems(subjectOptions)}
          />
        )}

        <WebLabel>Vendor</WebLabel>
        <WebInput style={styles.readOnlyInput} value={FIXED_VENDOR} editable={false} />

        <FormField
          label="Quantity *"
          value={form.quantity}
          onChangeText={(quantity) => setForm((f) => ({ ...f, quantity }))}
          placeholder="Item Quantity"
          keyboardType="decimal-pad"
        />

      </PageSection>
      <WebButton title={submitting ? 'Adding…' : 'Add Item'} onPress={handleSubmit} loading={submitting} disabled={submitting} />
    </ScreenShell>
  );
}

function FormField({ label, value, onChangeText, placeholder, keyboardType }: { label: string; value: string; onChangeText: (v: string) => void; placeholder?: string; keyboardType?: any }) {
  return (
    <View>
      <WebLabel>{label}</WebLabel>
      <WebInput value={value} onChangeText={onChangeText} placeholder={placeholder} keyboardType={keyboardType} />
    </View>
  );
}

const styles = StyleSheet.create({
  helper: { fontSize: 13, color: colors.textTertiary, marginBottom: 12 },
  readOnlyInput: { backgroundColor: colors.backgroundMuted, color: colors.textSecondary },
});
