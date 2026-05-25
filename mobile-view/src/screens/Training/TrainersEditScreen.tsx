import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { apiService } from '../../services/api';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebSelect } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';

import { TRAINER_CATEGORIES, normalizeTrainerProducts } from '../../constants/trainerCategories';

export default function TrainersEditScreen({ navigation, route }: any) {
  const id = route.params?.id as string;
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
  });
  const [zones, setZones] = useState<string[]>([]);
  const [clustersByZone, setClustersByZone] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [categoryPickerKey, setCategoryPickerKey] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [pairsRaw, zonesRaw, trainer] = await Promise.all([
          apiService.get<any[]>('/zones-clusters').catch(() => []),
          apiService.get<any[]>('/zones').catch(() => []),
          apiService.get<any>(`/employees/${id}`),
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
        setForm({
          name: trainer.name || '',
          email: trainer.email || '',
          mobile: trainer.mobile || '',
          state: trainer.state || '',
          zone: trainer.zone || '',
          cluster: trainer.cluster || '',
          address1: trainer.address1 || '',
          trainerProducts: normalizeTrainerProducts(trainer.trainerProducts || []),
          trainerAbacusLevels: trainer.trainerAbacusLevels || '',
          trainerVedicLevels: trainer.trainerVedicLevels || '',
          trainerLevels: trainer.trainerLevels || '',
          trainerType: trainer.trainerType || 'Employee',
        });
      } catch (e: any) {
        setErrorMessage(e.message || 'Failed to load trainer');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const addProductCategory = (value: string) => {
    if (!value || form.trainerProducts.includes(value)) return;
    setForm((f) => ({ ...f, trainerProducts: [...f.trainerProducts, value] }));
    setCategoryPickerKey((k) => k + 1);
  };

  const removeProductCategory = (p: string) => {
    setForm((f) => ({ ...f, trainerProducts: f.trainerProducts.filter((x) => x !== p) }));
  };

  const availableCategories = TRAINER_CATEGORIES.filter((c) => !form.trainerProducts.includes(c));

  const handleSubmit = async () => {
    setErrorMessage(null);
    if (!form.name?.trim() || !form.mobile?.trim()) {
      setErrorMessage('Name and mobile are required');
      return;
    }
    if (form.trainerProducts.length === 0) {
      setErrorMessage('Select at least one product category');
      return;
    }
    setSubmitting(true);
    try {
      await apiService.put(`/trainers/${id}`, form);
      navigation.navigate('TrainersActive');
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to update trainer');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <ScreenShell title="Edit Trainer" loading>
        <View />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Edit Trainer">
      <ScrollView ref={scrollRef} style={styles.content} contentContainerStyle={styles.contentContainer}>
        {errorMessage && <MessageBanner type="error" message={errorMessage} onDismiss={() => setErrorMessage(null)} />}

        <FormField label="Trainer Name *" value={form.name} onChangeText={(t: string) => setForm((f) => ({ ...f, name: t }))} />
        <FormField label="Mobile *" value={form.mobile} onChangeText={(t: string) => setForm((f) => ({ ...f, mobile: t }))} keyboardType="phone-pad" />
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

        <Text style={styles.sectionTitle}>Product Category *</Text>
        {availableCategories.length > 0 && (
          <WebSelect
            key={`cat-${categoryPickerKey}`}
            label="Add category"
            value=""
            onValueChange={addProductCategory}
            items={availableCategories.map((c) => ({ label: c, value: c }))}
            placeholder="Select product category"
          />
        )}
        <View style={styles.checkboxRow}>
          {form.trainerProducts.map((p) => (
            <TouchableOpacity key={p} style={[styles.chip, styles.chipActive]} onPress={() => removeProductCategory(p)}>
              <Text style={[styles.chipText, styles.chipTextActive]}>{p} ×</Text>
            </TouchableOpacity>
          ))}
        </View>

        {form.trainerProducts.includes('Abacus') && (
          <FormField label="Abacus levels known" value={form.trainerAbacusLevels} onChangeText={(t: string) => setForm((f) => ({ ...f, trainerAbacusLevels: t }))} />
        )}
        {form.trainerProducts.includes('Vedic Maths') && (
          <FormField label="Vedic Maths levels known" value={form.trainerVedicLevels} onChangeText={(t: string) => setForm((f) => ({ ...f, trainerVedicLevels: t }))} />
        )}
        <FormField label="Other levels (optional)" value={form.trainerLevels} onChangeText={(t: string) => setForm((f) => ({ ...f, trainerLevels: t }))} />

        <TouchableOpacity style={[styles.submitButton, submitting && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color={colors.textLight} /> : <Text style={styles.submitButtonText}>Save Changes</Text>}
        </TouchableOpacity>
      </ScrollView>
    </ScreenShell>
  );
}

function FormField({ label, value, onChangeText, placeholder, keyboardType, multiline }: any) {
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
