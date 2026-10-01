import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { apiService } from '../../services/api';
import { phoneDigitsError, sanitizePhoneDigits } from '../../utils/phone';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebSelect } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';

type ProductOption = { _id: string; productName: string };
type ProductHead = { _id: string; name: string; assignedProductIds?: Array<string | { _id?: string }> };

export default function TrainersNewScreen({ navigation }: any) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    mobile: '',
    state: '',
    zone: '',
    cluster: '',
    address1: '',
    trainerProducts: [] as string[],
    trainerAbacusLevels: '',
    trainerVedicLevels: '',
    trainerLevels: '',
    trainerType: 'Employee',
    verticalManagerId: '',
  });
  const [zones, setZones] = useState<string[]>([]);
  const [clustersByZone, setClustersByZone] = useState<Record<string, string[]>>({});
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productHeads, setProductHeads] = useState<ProductHead[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [categoryPickerKey, setCategoryPickerKey] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    (async () => {
      try {
        const [pairsRaw, zonesRaw, productsRaw, productHeadsRaw] = await Promise.all([
          apiService.get('/zones-clusters').catch(() => []),
          apiService.get('/zones').catch(() => []),
          apiService.get('/products/active').catch(() => []),
          apiService.get('/employees?isActive=true&role=Manager').catch(() => []),
        ]);
        const pairs = Array.isArray(pairsRaw) ? pairsRaw : [];
        const zoneDocs = Array.isArray(zonesRaw) ? zonesRaw : [];
        const zoneMap: Record<string, string[]> = {};
        pairs.forEach((zc: any) => {
          const zone = (zc.zone || '').trim();
          if (!zone) return;
          if (!zoneMap[zone]) zoneMap[zone] = [];
          const cl = (zc.cluster || '').trim();
          if (cl && !zoneMap[zone].includes(cl)) zoneMap[zone].push(cl);
        });
        const zoneNames = zoneDocs.map((z: any) => (z.name || '').trim()).filter(Boolean);
        setZones([...new Set([...Object.keys(zoneMap), ...zoneNames])].sort());
        setClustersByZone(zoneMap);
        setProducts(Array.isArray(productsRaw) ? productsRaw : []);
        setProductHeads(Array.isArray(productHeadsRaw) ? productHeadsRaw : []);
      } catch {
        /* zones optional */
      }
    })();
  }, []);

  const eligibleProductHeads = useMemo(() => {
    const selectedIds = products
      .filter((product) => form.trainerProducts.includes(product.productName))
      .map((product) => product._id);
    return productHeads.filter((head) => {
      const assigned = new Set(
        (head.assignedProductIds || []).map((value) =>
          typeof value === 'string' ? value : String(value?._id || ''),
        ),
      );
      return selectedIds.every((id) => assigned.has(id));
    });
  }, [form.trainerProducts, productHeads, products]);

  const addProductCategory = (value: string) => {
    if (!value || form.trainerProducts.includes(value)) return;
    setForm((f) => ({ ...f, trainerProducts: [...f.trainerProducts, value], verticalManagerId: '' }));
    setCategoryPickerKey((k) => k + 1);
  };

  const removeProductCategory = (p: string) => {
    setForm((f) => ({ ...f, trainerProducts: f.trainerProducts.filter((x) => x !== p), verticalManagerId: '' }));
  };

  const availableCategories = products
    .map((product) => product.productName)
    .filter((name) => !form.trainerProducts.includes(name));

  const handleSubmit = async () => {
    setSuccessMessage(null);
    setErrorMessage(null);
    if (!form.name?.trim()) {
      setErrorMessage('Trainer name is required');
      return;
    }
    const mobileError = phoneDigitsError(form.mobile, true);
    if (mobileError) {
      setErrorMessage(mobileError);
      return;
    }
    if (form.trainerProducts.length === 0) {
      setErrorMessage('Select at least one product');
      return;
    }
    if (!form.verticalManagerId) {
      setErrorMessage('Select the Product Head');
      return;
    }
    setSubmitting(true);
    try {
      await apiService.post('/trainers/create', form);
      setSuccessMessage('Trainer created successfully.');
      setForm({
        name: '',
        email: '',
        mobile: '',
        state: '',
        zone: '',
        cluster: '',
        address1: '',
        trainerProducts: [],
        trainerAbacusLevels: '',
        trainerVedicLevels: '',
        trainerLevels: '',
        trainerType: 'Employee',
        verticalManagerId: '',
      });
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to create trainer');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenShell title="Add Trainer">
      <ScrollView ref={scrollRef} style={styles.content} contentContainerStyle={styles.contentContainer}>
        {successMessage && (
          <MessageBanner
            type="success"
            message={successMessage}
            actionLabel="View Trainers"
            onAction={() => navigation.navigate('TrainersActive')}
          />
        )}
        {errorMessage && <MessageBanner type="error" message={errorMessage} onDismiss={() => setErrorMessage(null)} />}

        <FormField label="Trainer Name *" value={form.name} onChangeText={(t: string) => setForm((f) => ({ ...f, name: t }))} />
        <FormField label="Mobile *" value={form.mobile} onChangeText={(t: string) => setForm((f) => ({ ...f, mobile: sanitizePhoneDigits(t) }))} keyboardType="phone-pad" maxLength={15} placeholder="10 to 15 digits" />
        <FormField label="Email" value={form.email} onChangeText={(t: string) => setForm((f) => ({ ...f, email: t }))} keyboardType="email-address" />

        <Text style={styles.sectionTitle}>Employment Type *</Text>
        <WebSelect
          label=""
          value={form.trainerType}
          onValueChange={(v) => setForm((f) => ({ ...f, trainerType: v }))}
          items={[
            { label: 'Employee', value: 'Employee' },
            { label: 'Freelancer', value: 'Freelancer' },
          ]}
        />

        {zones.length > 0 && (
          <WebSelect
            label="Zone"
            value={form.zone}
            onValueChange={(v) => setForm((f) => ({ ...f, zone: v, cluster: '' }))}
            items={zones.map((z) => ({ label: z, value: z }))}
            placeholder="Select zone"
          />
        )}
        {form.zone && (clustersByZone[form.zone] || []).length > 0 && (
          <WebSelect
            label="Cluster"
            value={form.cluster}
            onValueChange={(v) => setForm((f) => ({ ...f, cluster: v }))}
            items={(clustersByZone[form.zone] || []).map((c) => ({ label: c, value: c }))}
            placeholder="Select cluster"
          />
        )}

        <FormField label="Address" value={form.address1} onChangeText={(t: string) => setForm((f) => ({ ...f, address1: t }))} multiline />

        <Text style={styles.sectionTitle}>Products *</Text>
        {availableCategories.length > 0 && (
          <WebSelect
            key={`cat-${categoryPickerKey}`}
            label="Add product"
            value=""
            onValueChange={addProductCategory}
            items={availableCategories.map((c) => ({ label: c, value: c }))}
            placeholder="Select product"
          />
        )}
        <View style={styles.checkboxRow}>
          {form.trainerProducts.map((p) => (
            <TouchableOpacity key={p} style={[styles.chip, styles.chipActive]} onPress={() => removeProductCategory(p)}>
              <Text style={[styles.chipText, styles.chipTextActive]}>{p} ×</Text>
            </TouchableOpacity>
          ))}
        </View>
        {form.trainerProducts.length === 0 && (
          <Text style={styles.hint}>No products selected</Text>
        )}
        <WebSelect
          label="Product Head *"
          value={form.verticalManagerId}
          onValueChange={(verticalManagerId) => setForm((current) => ({ ...current, verticalManagerId }))}
          items={eligibleProductHeads.map((head) => ({ label: head.name, value: head._id }))}
          placeholder="Select Product Head"
          disabled={!form.trainerProducts.length || eligibleProductHeads.length === 0}
        />
        {form.trainerProducts.length > 0 && eligibleProductHeads.length === 0 && (
          <Text style={styles.hint}>Assign the selected product(s) to a Product Head first.</Text>
        )}

        {form.trainerProducts.includes('Abacus') && (
          <FormField
            label="Abacus levels known"
            value={form.trainerAbacusLevels}
            onChangeText={(t: string) => setForm((f) => ({ ...f, trainerAbacusLevels: t }))}
            placeholder="e.g. Level 1–8"
          />
        )}
        {form.trainerProducts.includes('Vedic Maths') && (
          <FormField
            label="Vedic Maths levels known"
            value={form.trainerVedicLevels}
            onChangeText={(t: string) => setForm((f) => ({ ...f, trainerVedicLevels: t }))}
            placeholder="e.g. Level 1–5"
          />
        )}
        <FormField
          label="Other levels (optional)"
          value={form.trainerLevels}
          onChangeText={(t: string) => setForm((f) => ({ ...f, trainerLevels: t }))}
        />

        <TouchableOpacity style={[styles.submitButton, submitting && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color={colors.textLight} /> : <Text style={styles.submitButtonText}>Create Trainer</Text>}
        </TouchableOpacity>
      </ScrollView>
    </ScreenShell>
  );
}

function FormField({ label, value, onChangeText, placeholder, keyboardType, multiline, maxLength }: any) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <WebInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        multiline={multiline}
        maxLength={maxLength}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 40 },
  fieldContainer: { marginBottom: 16 },
  sectionTitle: { ...typography.label.medium, color: colors.textPrimary, marginBottom: 8, marginTop: 8, fontWeight: '600' },
  label: { ...typography.label.medium, color: colors.textPrimary, marginBottom: 8 },
  input: { ...typography.body.medium, backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, color: colors.textPrimary },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  checkboxRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.backgroundLight },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.body.small, color: colors.textPrimary },
  chipTextActive: { color: colors.textLight },
  hint: { ...typography.body.small, color: colors.textSecondary, marginBottom: 12 },
  submitButton: { marginTop: 24, borderRadius: 12, backgroundColor: colors.primary, paddingVertical: 16, alignItems: 'center' },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { ...typography.label.large, color: colors.textLight, fontWeight: '600' },
});
