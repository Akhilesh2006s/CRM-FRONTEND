import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';

const TERM_OPTIONS = ['Term 1', 'Term 2', 'Term 3'] as const;

export default function ProductEditScreen({ navigation, route }: any) {
  const { user } = useAuth();
  const { id } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [paymentLogicOpen, setPaymentLogicOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const [form, setForm] = useState({
    productName: '',
    productLevels: [] as string[],
    newLevel: '',
    hasSubjects: false,
    subjects: [] as string[],
    newSubject: '',
    hasSpecs: false,
    specs: [] as string[],
    newSpec: '',
    hasCategory: false,
    categories: [] as string[],
    newCategory: '',
    prodStatus: 1,
    calculationType: 'normal' as 'normal' | 'level_based' | 'subject_based',
  });

  useEffect(() => {
    if (id) loadProduct();
  }, [id]);

  const loadProduct = async () => {
    try {
      setLoading(true);
      const product = await apiService.get(`/products/${id}`);
      setForm({
        productName: product.productName || '',
        productLevels: product.productLevels || [],
        newLevel: '',
        hasSubjects: product.hasSubjects || false,
        subjects: product.subjects || [],
        newSubject: '',
        hasSpecs: product.hasSpecs || false,
        specs: Array.isArray(product.specs)
          ? product.specs
          : product.specs
            ? [product.specs]
            : [],
        newSpec: '',
        hasCategory: product.hasCategory || false,
        categories: product.categories || [],
        newCategory: '',
        prodStatus: product.prodStatus ?? 1,
        calculationType:
          (product.calculationType === 'none' ? 'normal' : product.calculationType) || 'normal',
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load product');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const addLevel = () => {
    const value = form.newLevel.trim();
    if (!value || form.productLevels.includes(value)) return;
    setForm({
      ...form,
      productLevels: [...form.productLevels, value],
      newLevel: '',
    });
  };

  const addNamedTerm = (term: string) => {
    const value = form.newLevel.trim() || term;
    if (!value || form.productLevels.includes(value)) return;
    setForm({
      ...form,
      productLevels: [...form.productLevels, value],
      newLevel: '',
    });
  };

  const removeLevel = (index: number) => {
    setForm({
      ...form,
      productLevels: form.productLevels.filter((_, i) => i !== index),
    });
  };

  const renameLevel = (index: number, next: string) => {
    setForm((prev) => {
      const nextLevels = [...prev.productLevels];
      nextLevels[index] = next;
      return { ...prev, productLevels: nextLevels };
    });
  };

  const addSubject = () => {
    if (form.newSubject.trim() && !form.subjects.includes(form.newSubject.trim())) {
      setForm({
        ...form,
        subjects: [...form.subjects, form.newSubject.trim()],
        newSubject: '',
      });
    }
  };

  const removeSubject = (index: number) => {
    setForm({
      ...form,
      subjects: form.subjects.filter((_, i) => i !== index),
    });
  };

  const addSpec = () => {
    if (form.newSpec.trim() && !form.specs.includes(form.newSpec.trim())) {
      setForm({
        ...form,
        specs: [...form.specs, form.newSpec.trim()],
        newSpec: '',
      });
    }
  };

  const removeSpec = (index: number) => {
    setForm({
      ...form,
      specs: form.specs.filter((_, i) => i !== index),
    });
  };

  const addCategory = () => {
    if (form.newCategory.trim() && !form.categories.includes(form.newCategory.trim())) {
      setForm({
        ...form,
        categories: [...form.categories, form.newCategory.trim()],
        newCategory: '',
      });
    }
  };

  const removeCategory = (index: number) => {
    setForm({
      ...form,
      categories: form.categories.filter((_, i) => i !== index),
    });
  };

  const clearMessages = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const paymentLabel =
    form.calculationType === 'level_based'
      ? 'Level-based'
      : form.calculationType === 'subject_based'
        ? 'Subject-based'
        : 'Normal';

  const onSubmit = async () => {
    clearMessages();
    if (!form.productName.trim()) {
      setErrorMessage('Product name is required');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (form.hasSubjects && form.subjects.length === 0) {
      setErrorMessage('At least one subject is required when subjects are enabled');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (form.hasSpecs && form.specs.length === 0) {
      setErrorMessage('At least one spec is required when specs are enabled');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (form.hasCategory && form.categories.length === 0) {
      setErrorMessage('At least one product category is required when product categories are enabled');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (form.calculationType === 'level_based' && form.productLevels.length === 0) {
      setErrorMessage('Level-based payment requires at least one product level');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (form.calculationType === 'subject_based' && !form.hasSubjects) {
      setErrorMessage('Subject-based payment requires at least one Special Note');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    setSaving(true);
    try {
      await apiService.put(`/products/${id}`, {
        productName: form.productName.trim(),
        productLevels: form.productLevels.map((l) => l.trim()).filter(Boolean),
        hasSubjects: form.hasSubjects,
        subjects: form.hasSubjects ? form.subjects : [],
        hasSpecs: form.hasSpecs,
        specs: form.hasSpecs ? form.specs : [],
        hasCategory: form.hasCategory,
        categories: form.hasCategory ? form.categories : [],
        prodStatus: form.prodStatus,
        calculationType: form.calculationType,
      });
      setSuccessMessage('Product updated successfully.');
      setErrorMessage(null);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to update product');
      setSuccessMessage(null);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setSaving(false);
    }
  };

  if (!user || (user.role !== 'Admin' && user.role !== 'Super Admin')) {
    return (
      <ScreenShell title="Edit Product">
        <Text style={styles.errorText}>Access denied. Admin privileges required.</Text>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Edit Product"
      subtitle="Update product details."
      loading={loading}
      showBack
      noScroll
    >
      <ScrollView
        ref={scrollRef}
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {successMessage && (
          <MessageBanner
            type="success"
            message={successMessage}
            actionLabel="Back to Products"
            onAction={() => navigation.goBack()}
          />
        )}
        {errorMessage && (
          <MessageBanner type="error" message={errorMessage} onDismiss={clearMessages} />
        )}

        <View style={styles.formCard}>
          <View style={styles.formSection}>
            <Text style={styles.label}>Product Name *</Text>
            <WebInput
              style={styles.input}
              placeholder="Enter product name"
              value={form.productName}
              onChangeText={(text) => setForm({ ...form, productName: text })}
            />
          </View>

          <View style={styles.paymentBox}>
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentTitle}>Payment: {paymentLabel}</Text>
              <Text style={styles.hint}>How payable amount is divided per sale</Text>
            </View>
            <TouchableOpacity
              style={styles.manageBtn}
              onPress={() => setPaymentLogicOpen((v) => !v)}
            >
              <Ionicons name="options-outline" size={16} color={colors.textPrimary} />
              <Text style={styles.manageBtnText}>Manage payment logic</Text>
            </TouchableOpacity>
          </View>

          {paymentLogicOpen && (
            <View style={styles.formSection}>
              <View style={styles.chipRow}>
                {(
                  [
                    { key: 'normal' as const, label: 'Normal' },
                    { key: 'level_based' as const, label: 'Level-Based' },
                    { key: 'subject_based' as const, label: 'Subject-Based' },
                  ]
                ).map(({ key, label }) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.chip, form.calculationType === key && styles.chipActive]}
                    onPress={() => setForm({ ...form, calculationType: key })}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        form.calculationType === key && styles.chipTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={styles.formSection}>
            <Text style={styles.label}>Term / Level</Text>
            <Text style={styles.hint}>
              Type a custom name (e.g. hi), then tap Add Term 1 / Term 2 — or edit names below.
            </Text>
            <View style={styles.addRow}>
              <WebInput
                style={[styles.input, styles.addInput]}
                placeholder="Custom name for next term (e.g. hi)"
                value={form.newLevel}
                onChangeText={(text) => setForm({ ...form, newLevel: text })}
                onSubmitEditing={addLevel}
              />
              <TouchableOpacity style={styles.addButton} onPress={addLevel}>
                <Text style={styles.addButtonText}>Add Level</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.chipRow}>
              {TERM_OPTIONS.map((term) => {
                const label = form.newLevel.trim() || term;
                const alreadyAdded = form.productLevels.includes(label);
                return (
                  <TouchableOpacity
                    key={term}
                    style={[styles.termBtn, alreadyAdded && styles.termBtnDisabled]}
                    onPress={() => addNamedTerm(term)}
                    disabled={alreadyAdded}
                  >
                    <Text
                      style={[styles.termBtnText, alreadyAdded && styles.termBtnTextDisabled]}
                    >
                      Add {term}
                      {form.newLevel.trim() ? ` as “${form.newLevel.trim()}”` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {form.productLevels.length > 0 && (
              <View style={[styles.badgeContainer, { marginTop: 10 }]}>
                {form.productLevels.map((level, idx) => (
                  <View key={idx} style={styles.badge}>
                    <WebInput
                      style={styles.badgeInput}
                      value={level}
                      onChangeText={(text) => renameLevel(idx, text)}
                    />
                    <TouchableOpacity onPress={() => removeLevel(idx)}>
                      <Text style={styles.badgeRemove}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.formSection}>
            <View style={styles.switchRow}>
              <Text style={styles.label}>Special Notes</Text>
              <Switch
                value={form.hasSubjects}
                onValueChange={(value) => setForm({ ...form, hasSubjects: value })}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.backgroundLight}
              />
            </View>
          </View>

          {form.hasSubjects && (
            <View style={styles.formSection}>
              <Text style={styles.label}>Special Notes *</Text>
              <View style={styles.addRow}>
                <WebInput
                  style={[styles.input, styles.addInput]}
                  placeholder="Enter special note"
                  value={form.newSubject}
                  onChangeText={(text) => setForm({ ...form, newSubject: text })}
                  onSubmitEditing={addSubject}
                />
                <TouchableOpacity style={styles.addButton} onPress={addSubject}>
                  <Text style={styles.addButtonText}>Add Special Note</Text>
                </TouchableOpacity>
              </View>
              {form.subjects.length > 0 && (
                <View style={styles.badgeContainer}>
                  {form.subjects.map((subject, idx) => (
                    <View key={idx} style={[styles.badge, styles.badgeSecondary]}>
                      <Text style={styles.badgeText}>{subject}</Text>
                      <TouchableOpacity onPress={() => removeSubject(idx)}>
                        <Text style={styles.badgeRemove}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={styles.formSection}>
            <View style={styles.switchRow}>
              <Text style={styles.label}>Has Specs</Text>
              <Switch
                value={form.hasSpecs}
                onValueChange={(value) => setForm({ ...form, hasSpecs: value })}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.backgroundLight}
              />
            </View>
          </View>

          {form.hasSpecs && (
            <View style={styles.formSection}>
              <Text style={styles.label}>Specs *</Text>
              <Text style={styles.hint}>Add one or multiple specs</Text>
              <View style={styles.addRow}>
                <WebInput
                  style={[styles.input, styles.addInput]}
                  placeholder="Enter spec name"
                  value={form.newSpec}
                  onChangeText={(text) => setForm({ ...form, newSpec: text })}
                  onSubmitEditing={addSpec}
                />
                <TouchableOpacity style={styles.addButton} onPress={addSpec}>
                  <Text style={styles.addButtonText}>Add Spec</Text>
                </TouchableOpacity>
              </View>
              {form.specs.length > 0 && (
                <View style={styles.badgeContainer}>
                  {form.specs.map((spec, idx) => (
                    <View key={idx} style={styles.badge}>
                      <Text style={styles.badgeText}>{spec}</Text>
                      <TouchableOpacity onPress={() => removeSpec(idx)}>
                        <Text style={styles.badgeRemove}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={styles.formSection}>
            <View style={styles.switchRow}>
              <Text style={styles.label}>Series</Text>
              <Switch
                value={form.hasCategory}
                onValueChange={(value) => setForm({ ...form, hasCategory: value })}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.backgroundLight}
              />
            </View>
          </View>

          {form.hasCategory && (
            <View style={styles.formSection}>
              <Text style={styles.label}>Series *</Text>
              <Text style={styles.hint}>Add one or multiple series</Text>
              <View style={styles.addRow}>
                <WebInput
                  style={[styles.input, styles.addInput]}
                  placeholder="Enter series name"
                  value={form.newCategory}
                  onChangeText={(text) => setForm({ ...form, newCategory: text })}
                  onSubmitEditing={addCategory}
                />
                <TouchableOpacity style={styles.addButton} onPress={addCategory}>
                  <Text style={styles.addButtonText}>Add Series</Text>
                </TouchableOpacity>
              </View>
              {form.categories.length > 0 && (
                <View style={styles.badgeContainer}>
                  {form.categories.map((category, idx) => (
                    <View key={idx} style={[styles.badge, styles.badgeSecondary]}>
                      <Text style={styles.badgeText}>{category}</Text>
                      <TouchableOpacity onPress={() => removeCategory(idx)}>
                        <Text style={styles.badgeRemove}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={styles.formSection}>
            <Text style={styles.label}>Product Status *</Text>
            <View style={styles.statusContainer}>
              <TouchableOpacity
                style={[styles.statusButton, form.prodStatus === 1 && styles.statusButtonActive]}
                onPress={() => setForm({ ...form, prodStatus: 1 })}
              >
                <Text
                  style={[
                    styles.statusButtonText,
                    form.prodStatus === 1 && styles.statusButtonTextActive,
                  ]}
                >
                  Available
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.statusButton, form.prodStatus === 0 && styles.statusButtonActive]}
                onPress={() => setForm({ ...form, prodStatus: 0 })}
              >
                <Text
                  style={[
                    styles.statusButtonText,
                    form.prodStatus === 0 && styles.statusButtonTextActive,
                  ]}
                >
                  Not Available
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.buttonCancel]}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.buttonTextCancel}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.buttonSubmit]}
              onPress={onSubmit}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.textLight} />
              ) : (
                <Text style={styles.buttonTextSubmit}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32 },
  errorText: { ...typography.body.medium, color: colors.error, textAlign: 'center', padding: 20 },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  formSection: { marginBottom: 20 },
  label: {
    ...typography.body.medium,
    color: colors.textPrimary,
    marginBottom: 8,
    fontWeight: '600',
  },
  hint: { ...typography.body.small, color: colors.textSecondary, marginBottom: 8 },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    ...typography.body.medium,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  paymentBox: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    backgroundColor: '#F8FAFC',
    gap: 10,
  },
  paymentInfo: { flex: 1 },
  paymentTitle: {
    ...typography.body.medium,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: 4,
  },
  manageBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  manageBtnText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  addRow: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  addInput: { flex: 1, minWidth: 140 },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    justifyContent: 'center',
  },
  addButtonText: { ...typography.body.small, color: colors.textLight, fontWeight: '600' },
  badgeContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  badgeSecondary: { backgroundColor: colors.info + '15', borderColor: colors.info + '30' },
  badgeText: { ...typography.body.small, color: colors.textPrimary, marginRight: 6 },
  badgeInput: {
    ...typography.body.small,
    color: colors.textPrimary,
    minWidth: 72,
    maxWidth: 140,
    paddingVertical: 0,
    paddingHorizontal: 4,
    marginRight: 4,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  badgeRemove: {
    ...typography.body.medium,
    color: colors.error,
    fontWeight: 'bold',
    fontSize: 18,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusContainer: { flexDirection: 'row', gap: 12 },
  statusButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  statusButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  statusButtonText: { ...typography.body.medium, color: colors.textPrimary },
  statusButtonTextActive: { color: colors.textLight, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.body.small, color: colors.textPrimary },
  chipTextActive: { color: colors.textLight, fontWeight: '600' },
  termBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
  },
  termBtnDisabled: { opacity: 0.45, backgroundColor: '#F8FAFC' },
  termBtnText: { ...typography.body.small, color: colors.textPrimary, fontWeight: '500' },
  termBtnTextDisabled: { color: colors.textSecondary },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  button: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center' },
  buttonCancel: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonSubmit: { backgroundColor: colors.primary },
  buttonTextCancel: { ...typography.body.medium, color: colors.textPrimary, fontWeight: '600' },
  buttonTextSubmit: { ...typography.body.medium, color: colors.textLight, fontWeight: '600' },
});
