import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { apiService } from '../../services/api';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, DataTable, WebLabel } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';

export default function DCEditScreen({ navigation, route }: any) {
  const { id } = route.params || {};
  const [dc, setDC] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [form, setForm] = useState({
    customerName: '',
    customerEmail: '',
    customerAddress: '',
    customerPhone: '',
    product: '',
    requestedQuantity: '',
    deliveryNotes: '',
  });

  useEffect(() => {
    if (id) loadDC();
  }, [id]);

  const loadDC = async () => {
    try {
      setLoading(true);
      const data = await apiService.get(`/dc/${id}`);
      setDC(data);
      setForm({
        customerName: data.customerName || '',
        customerEmail: data.customerEmail || '',
        customerAddress: data.customerAddress || '',
        customerPhone: data.customerPhone || '',
        product: data.product || '',
        requestedQuantity: String(data.requestedQuantity || ''),
        deliveryNotes: data.deliveryNotes || '',
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load DC');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const clearMessages = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const onSubmit = async () => {
    clearMessages();
    setSaving(true);
    try {
      await apiService.put(`/dc/${id}`, {
        customerName: form.customerName,
        customerEmail: form.customerEmail,
        customerAddress: form.customerAddress,
        customerPhone: form.customerPhone,
        product: form.product,
        requestedQuantity: Number(form.requestedQuantity),
        deliveryNotes: form.deliveryNotes,
      });
      setSuccessMessage('DC updated successfully.');
      setErrorMessage(null);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to save');
      setSuccessMessage(null);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading DC...</Text>
      </View>
    );
  }

  return (
    <ScreenShell
      title="Edit DC"
      loading={loading}
    >
<ScrollView ref={scrollRef} style={styles.content} contentContainerStyle={styles.contentContainer}>
        {successMessage && (
          <MessageBanner
            type="success"
            message={successMessage}
            actionLabel="Go Back"
            onAction={() => navigation.goBack()}
          />
        )}
        {errorMessage && (
          <MessageBanner type="error" message={errorMessage} onDismiss={clearMessages} />
        )}
        <View style={styles.formCard}>
          <View style={styles.formSection}>
            <Text style={styles.label}>Customer Name</Text>
            <WebInput
              style={styles.input}
              value={form.customerName}
              onChangeText={(text) => setForm({ ...form, customerName: text })}
            />
          </View>

          <View style={styles.formSection}>
            <Text style={styles.label}>Customer Email</Text>
            <WebInput
              style={styles.input}
              value={form.customerEmail}
              onChangeText={(text) => setForm({ ...form, customerEmail: text })}
              keyboardType="email-address"
            />
          </View>

          <View style={styles.formSection}>
            <Text style={styles.label}>Customer Address</Text>
            <WebInput
              style={[styles.input, styles.textArea]}
              value={form.customerAddress}
              onChangeText={(text) => setForm({ ...form, customerAddress: text })}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.formSection}>
            <Text style={styles.label}>Customer Phone</Text>
            <WebInput
              style={styles.input}
              value={form.customerPhone}
              onChangeText={(text) => setForm({ ...form, customerPhone: text })}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.formSection}>
            <Text style={styles.label}>Product</Text>
            <WebInput
              style={styles.input}
              value={form.product}
              onChangeText={(text) => setForm({ ...form, product: text })}
            />
          </View>

          <View style={styles.formSection}>
            <Text style={styles.label}>Requested Quantity</Text>
            <WebInput
              style={styles.input}
              value={form.requestedQuantity}
              onChangeText={(text) => setForm({ ...form, requestedQuantity: text })}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.formSection}>
            <Text style={styles.label}>Delivery Notes</Text>
            <WebInput
              style={[styles.input, styles.textArea]}
              value={form.deliveryNotes}
              onChangeText={(text) => setForm({ ...form, deliveryNotes: text })}
              multiline
              numberOfLines={4}
            />
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
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: 12, ...typography.body.medium, color: colors.textSecondary },
  header: { paddingHorizontal: 20, paddingTop: 50, paddingBottom: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 24, color: colors.textLight, fontWeight: 'bold' },
  headerTitle: { ...typography.heading.h1, color: colors.textLight, flex: 1, textAlign: 'center' },
  placeholder: { width: 40 },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32 },
  formCard: { backgroundColor: colors.backgroundLight, borderRadius: 16, padding: 20, shadowColor: colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  formSection: { marginBottom: 20 },
  label: { ...typography.body.medium, color: colors.textPrimary, marginBottom: 8, fontWeight: '600' },
  input: { backgroundColor: colors.background, borderRadius: 12, padding: 12, ...typography.body.medium, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  button: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  buttonCancel: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  buttonSubmit: { backgroundColor: colors.primary },
  buttonTextCancel: { ...typography.body.medium, color: colors.textPrimary, fontWeight: '600' },
  buttonTextSubmit: { ...typography.body.medium, color: colors.textLight, fontWeight: '600' },
});


