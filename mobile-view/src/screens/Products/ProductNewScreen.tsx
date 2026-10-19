import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { apiService } from '../../services/api';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput } from '../../ui/WebPrimitives';
import { useAuth } from '../../context/AuthContext';

const TERM_OPTIONS = ['Term 1', 'Term 2', 'Term 3'] as const;

export default function ProductNewScreen({ navigation }: any) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const clearMessages = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
  };

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
    // Prefer custom label from the input (e.g. "hi" for Term 1 slot)
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

  const onSubmit = async () => {
    clearMessages();
    setSubmitting(true);

    if (!form.productName.trim()) {
      setErrorMessage('Product name is required');
      setSubmitting(false);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (form.hasSubjects && form.subjects.length === 0) {
      setErrorMessage('At least one subject is required when subjects are enabled');
      setSubmitting(false);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (form.hasSpecs && form.specs.length === 0) {
      setErrorMessage('At least one spec is required when specs are enabled');
      setSubmitting(false);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (form.hasCategory && form.categories.length === 0) {
      setErrorMessage('At least one product category is required when product categories are enabled');
      setSubmitting(false);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (form.calculationType === 'level_based' && form.productLevels.length === 0) {
      setErrorMessage('Level-based payment requires at least one product level');
      setSubmitting(false);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (form.calculationType === 'subject_based' && !form.hasSubjects) {
      setErrorMessage('Subject-based payment requires at least one Special Note');
      setSubmitting(false);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    try {
      const payload = {
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
      };

      await apiService.post('/products', payload);
      setSuccessMessage('Product created successfully.');
      setErrorMessage(null);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to create product';
      setErrorMessage(msg);
      setSuccessMessage(null);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setSubmitting(false);
    }
  };

  if (!user || (user.role !== 'Admin' && user.role !== 'Super Admin')) {
    return (
      <ScreenShell title="Add New Product">
        <Text style={styles.errorText}>Access denied. Admin privileges required.</Text>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Add New Product" showBack noScroll>
      <ScrollView
        ref={scrollRef}
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {successMessage ? (
          <View style={styles.successBanner}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successText}>{successMessage}</Text>
            <TouchableOpacity
              style={styles.viewProductsButton}
              onPress={() => navigation.navigate('ProductsList')}
            >
              <Text style={styles.viewProductsButtonText}>View Products</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerIcon}>!</Text>
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
            <TouchableOpacity onPress={clearMessages} style={styles.dismissError}>
              <Text style={styles.dismissErrorText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        ) : null}

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

          <View style={styles.formSection}>
            <Text style={styles.label}>Payment logic</Text>
            <Text style={styles.hint}>How payable amount is divided per sale</Text>
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
            <Text style={styles.hint}>
              Level-Based: Total amount is divided by number of levels (terms)
            </Text>
            <Text style={styles.hint}>
              Subject-Based: Total amount is divided by number of selected subjects
            </Text>
            <Text style={styles.hint}>Normal: Full amount is charged without division</Text>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.label}>Term / Level</Text>
            <Text style={styles.hint}>
              Type a custom name (e.g. hi), then tap Add Term 1 / Term 2 — or edit names below.
            </Text>
            <WebInput
              style={[styles.input, styles.termInput]}
              placeholder="Custom name for next term (e.g. hi)"
              value={form.newLevel}
              onChangeText={(text) => setForm({ ...form, newLevel: text })}
              onSubmitEditing={addLevel}
            />
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
              <View style={[styles.badgeContainer, styles.termBadges]}>
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
              <Text style={styles.hint}>Add one or multiple special notes</Text>
              <View style={styles.addRow}>
                <WebInput
                  style={[styles.input, styles.addInput]}
                  placeholder="Enter special note"
                  value={form.newSubject}
                  onChangeText={(text) => setForm({ ...form, newSubject: text })}
                  onSubmitEditing={addSubject}
                />
                <TouchableOpacity style={styles.addButton} onPress={addSubject}>
                  <Text style={styles.addButtonText}>Add</Text>
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
                  <Text style={styles.addButtonText}>Add</Text>
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
                  <Text style={styles.addButtonText}>Add</Text>
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
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.textLight} />
              ) : (
                <Text style={styles.buttonTextSubmit}>Create Product</Text>
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
  formCard: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 16,
    padding: 20,
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  formSection: { marginBottom: 24 },
  label: {
    ...typography.body.medium,
    color: colors.textPrimary,
    marginBottom: 8,
    fontWeight: '600',
  },
  hint: { ...typography.body.small, color: colors.textSecondary, marginBottom: 8 },
  input: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    ...typography.body.medium,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  addInput: { flex: 1 },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: 'center',
  },
  addButtonText: { ...typography.body.medium, color: colors.textLight, fontWeight: '600' },
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
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
    backgroundColor: colors.background,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.body.small, color: colors.textPrimary },
  chipTextActive: { color: colors.textLight, fontWeight: '600' },
  termInput: { marginBottom: 10 },
  termBadges: { marginTop: 12 },
  termBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  termBtnDisabled: {
    opacity: 0.45,
    backgroundColor: '#F8FAFC',
  },
  termBtnText: { ...typography.body.small, color: colors.textPrimary, fontWeight: '500' },
  termBtnTextDisabled: { color: colors.textSecondary },
  successBanner: {
    backgroundColor: '#D1FAE5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  successIcon: { fontSize: 24, color: '#10B981', marginBottom: 8, fontWeight: 'bold' },
  successText: {
    ...typography.body.medium,
    color: '#065F46',
    fontWeight: '600',
    marginBottom: 12,
  },
  viewProductsButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  viewProductsButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  errorBannerIcon: { fontSize: 24, color: '#EF4444', marginBottom: 8, fontWeight: 'bold' },
  errorBannerText: { ...typography.body.medium, color: '#991B1B', marginBottom: 12 },
  dismissError: { alignSelf: 'flex-start' },
  dismissErrorText: { color: '#EF4444', fontWeight: '600', fontSize: 14 },
  errorText: { ...typography.body.medium, color: colors.error },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  button: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  buttonCancel: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonSubmit: { backgroundColor: colors.primary },
  buttonTextCancel: { ...typography.body.medium, color: colors.textPrimary, fontWeight: '600' },
  buttonTextSubmit: { ...typography.body.medium, color: colors.textLight, fontWeight: '600' },
});
