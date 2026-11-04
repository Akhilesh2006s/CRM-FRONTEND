import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { apiService } from '../../services/api';
import { phoneDigitsError, sanitizePhoneDigits } from '../../utils/phone';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebLabel } from '../../ui/WebPrimitives';
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
    const phoneError = phoneDigitsError(form.customerPhone, false);
    if (phoneError) {
      setErrorMessage(phoneError);
      return;
    }
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

  return (
    <ScreenShell title="Edit DC" loading={loading} noScroll>
      <ScrollView ref={scrollRef} style={styles.content} contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
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
        <PageSection title="Customer">
          <WebLabel>Customer Name</WebLabel>
          <WebInput value={form.customerName} onChangeText={(text) => setForm({ ...form, customerName: text })} />
          <WebLabel>Customer Phone</WebLabel>
          <WebInput
            value={form.customerPhone}
            onChangeText={(text) => setForm({ ...form, customerPhone: sanitizePhoneDigits(text) })}
            keyboardType="phone-pad"
            maxLength={15}
            placeholder="10 to 15 digits"
          />
          <WebLabel>Customer Email</WebLabel>
          <WebInput value={form.customerEmail} onChangeText={(text) => setForm({ ...form, customerEmail: text })} keyboardType="email-address" />
          <WebLabel>Customer Address</WebLabel>
          <WebInput
            style={styles.textArea}
            value={form.customerAddress}
            onChangeText={(text) => setForm({ ...form, customerAddress: text })}
            multiline
            numberOfLines={3}
          />
        </PageSection>

        <PageSection title="Order">
          <WebLabel>Product</WebLabel>
          <WebInput value={form.product} onChangeText={(text) => setForm({ ...form, product: text })} />
          <WebLabel>Requested Quantity</WebLabel>
          <WebInput value={form.requestedQuantity} onChangeText={(text) => setForm({ ...form, requestedQuantity: text })} keyboardType="numeric" />
          <WebLabel>Delivery Notes</WebLabel>
          <WebInput
            style={styles.textArea}
            value={form.deliveryNotes}
            onChangeText={(text) => setForm({ ...form, deliveryNotes: text })}
            multiline
            numberOfLines={4}
          />
        </PageSection>

        <View style={styles.buttonRow}>
          <View style={styles.btnCell}><WebButton title="Cancel" variant="outline" onPress={() => navigation.goBack()} /></View>
          <View style={styles.btnCell}><WebButton title="Save Changes" onPress={onSubmit} loading={saving} disabled={saving} /></View>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32 },
  textArea: { minHeight: 96, textAlignVertical: 'top' },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  btnCell: { flex: 1 },
});
