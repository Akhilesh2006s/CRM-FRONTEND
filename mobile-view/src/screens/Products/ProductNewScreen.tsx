import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { apiService } from '../../services/api';
import LogoutButton from '../../components/LogoutButton';
import { useAuth } from '../../context/AuthContext';

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
    prodStatus: 1,
    calculationType: 'none' as 'none' | 'level_based' | 'subject_based',
  });

  const addLevel = () => {
    if (form.newLevel.trim() && !form.productLevels.includes(form.newLevel.trim())) {
      setForm({
        ...form,
        productLevels: [...form.productLevels, form.newLevel.trim()],
        newLevel: '',
      });
    }
  };

  const removeLevel = (index: number) => {
    setForm({
      ...form,
      productLevels: form.productLevels.filter((_, i) => i !== index),
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
    if (form.calculationType === 'level_based' && form.productLevels.length === 0) {
      setErrorMessage('Level-based payment requires at least one product level');
      setSubmitting(false);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (form.calculationType === 'subject_based' && !form.hasSubjects) {
      setErrorMessage('Subject-based payment requires subjects to be enabled');
      setSubmitting(false);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    try {
      const payload: any = {
        productName: form.productName.trim(),
        productLevels: form.productLevels,
        hasSubjects: form.hasSubjects,
        subjects: form.hasSubjects ? form.subjects : [],
        hasSpecs: form.hasSpecs,
        specs: form.hasSpecs ? form.specs : [],
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
      <View style={styles.container}>
        <Text style={styles.errorText}>Access denied. Admin privileges required.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={gradients.primary as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Add New Product</Text>
            <Text style={styles.headerSubtitle}>Create a new product</Text>
          </View>
          <LogoutButton />
        </View>
      </LinearGradient>

      <ScrollView ref={scrollRef} style={styles.content} contentContainerStyle={styles.contentContainer}>
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
            <TextInput
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
                  { key: 'none' as const, label: 'Standard' },
                  { key: 'level_based' as const, label: 'By level' },
                  { key: 'subject_based' as const, label: 'By subject' },
                ]
              ).map(({ key, label }) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.chip,
                    form.calculationType === key && styles.chipActive,
                  ]}
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

          <View style={styles.formSection}>
            <Text style={styles.label}>Product Levels</Text>
            <Text style={styles.hint}>Add levels like L1, L2, L3, etc.</Text>
            <View style={styles.addRow}>
              <TextInput
                style={[styles.input, styles.addInput]}
                placeholder="Enter level (e.g., L1, L2)"
                value={form.newLevel}
                onChangeText={(text) => setForm({ ...form, newLevel: text })}
                onSubmitEditing={addLevel}
              />
              <TouchableOpacity style={styles.addButton} onPress={addLevel}>
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
            {form.productLevels.length > 0 && (
              <View style={styles.badgeContainer}>
                {form.productLevels.map((level, idx) => (
                  <View key={idx} style={styles.badge}>
                    <Text style={styles.badgeText}>{level}</Text>
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
              <Text style={styles.label}>Has Subjects</Text>
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
              <Text style={styles.label}>Subjects *</Text>
              <Text style={styles.hint}>Add one or multiple subjects</Text>
              <View style={styles.addRow}>
                <TextInput
                  style={[styles.input, styles.addInput]}
                  placeholder="Enter subject name"
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
                <TextInput
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
            <Text style={styles.label}>Product Status *</Text>
            <View style={styles.statusContainer}>
              <TouchableOpacity
                style={[styles.statusButton, form.prodStatus === 1 && styles.statusButtonActive]}
                onPress={() => setForm({ ...form, prodStatus: 1 })}
              >
                <Text style={[styles.statusButtonText, form.prodStatus === 1 && styles.statusButtonTextActive]}>
                  Available
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.statusButton, form.prodStatus === 0 && styles.statusButtonActive]}
                onPress={() => setForm({ ...form, prodStatus: 0 })}
              >
                <Text style={[styles.statusButtonText, form.prodStatus === 0 && styles.statusButtonTextActive]}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: 50, paddingBottom: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 24, color: colors.textLight, fontWeight: 'bold' },
  headerTitleContainer: { flex: 1, alignItems: 'center' },
  headerTitle: { ...typography.heading.h1, color: colors.textLight, marginBottom: 4 },
  headerSubtitle: { ...typography.body.small, color: colors.textLight + 'CC' },
  placeholder: { width: 40 },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32 },
  formCard: { backgroundColor: colors.backgroundLight, borderRadius: 16, padding: 20, shadowColor: colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  formSection: { marginBottom: 24 },
  label: { ...typography.body.medium, color: colors.textPrimary, marginBottom: 8, fontWeight: '600' },
  hint: { ...typography.body.small, color: colors.textSecondary, marginBottom: 8 },
  input: { backgroundColor: colors.background, borderRadius: 12, padding: 12, ...typography.body.medium, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border },
  addRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  addInput: { flex: 1 },
  addButton: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, justifyContent: 'center' },
  addButtonText: { ...typography.body.medium, color: colors.textLight, fontWeight: '600' },
  badgeContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: colors.primary + '30' },
  badgeSecondary: { backgroundColor: colors.info + '15', borderColor: colors.info + '30' },
  badgeText: { ...typography.body.small, color: colors.textPrimary, marginRight: 6 },
  badgeRemove: { ...typography.body.medium, color: colors.error, fontWeight: 'bold', fontSize: 18 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusContainer: { flexDirection: 'row', gap: 12 },
  statusButton: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, alignItems: 'center' },
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
  successBanner: {
    backgroundColor: '#D1FAE5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  successIcon: { fontSize: 24, color: '#10B981', marginBottom: 8, fontWeight: 'bold' },
  successText: { ...typography.body.medium, color: '#065F46', fontWeight: '600', marginBottom: 12 },
  viewProductsButton: { alignSelf: 'flex-start', backgroundColor: '#10B981', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
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
  buttonCancel: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  buttonSubmit: { backgroundColor: colors.primary },
  buttonTextCancel: { ...typography.body.medium, color: colors.textPrimary, fontWeight: '600' },
  buttonTextSubmit: { ...typography.body.medium, color: colors.textLight, fontWeight: '600' },
});


