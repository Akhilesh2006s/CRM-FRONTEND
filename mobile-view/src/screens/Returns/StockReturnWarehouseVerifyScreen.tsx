import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, DataTable, WebLabel } from '../../ui/WebPrimitives';
import { apiService, getApiUrl } from '../../services/api';

const CONDITION_OPTIONS = ['Sellable', 'Damaged', 'Expired', 'Missing'];

function normalizeQty(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function isQuantityMismatch(returnQty: unknown, receivedQty: unknown): boolean {
  const expected = normalizeQty(returnQty);
  const received = normalizeQty(receivedQty);
  if (Number.isNaN(expected) || Number.isNaN(received)) return false;
  return expected > 0 && received !== expected;
}

function resolveInitialReceivedQty(
  returnQty: unknown,
  receivedQty: unknown,
  condition?: string
): number {
  const expected = normalizeQty(returnQty);
  const received = normalizeQty(receivedQty);
  const hasPriorVerification =
    Boolean(String(condition || '').trim()) ||
    (Number.isFinite(received) && receivedQty != null && receivedQty !== '' && received > 0);

  if (hasPriorVerification && Number.isFinite(received)) {
    return received;
  }

  return Number.isFinite(expected) ? expected : 0;
}

function formatDate(d: string | undefined) {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleDateString('en-IN');
  } catch {
    return '-';
  }
}

type ProductVerification = {
  product: string;
  returnQty: number;
  reason: string;
  remarks?: string;
  receivedQty: string;
  condition: string;
  batchLot: string;
  storageLocation: string;
  quantityMismatch: boolean;
  mismatchRemark: string;
};

export default function StockReturnWarehouseVerifyScreen({ navigation, route }: any) {
  const returnId = route?.params?.returnId as string;
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [returnDoc, setReturnDoc] = useState<any>(null);
  const [productRows, setProductRows] = useState<ProductVerification[]>([]);
  const [warehousePhotos, setWarehousePhotos] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (!returnId) return;
    (async () => {
      try {
        setLoading(true);
        const doc = await apiService.get(`/stock-returns/warehouse-executive/${returnId}`);
        setReturnDoc(doc);
        const rows: ProductVerification[] = (doc.products || []).map((p: any) => {
          const returnQty = normalizeQty(p.returnQty) || 0;
          const receivedQty = resolveInitialReceivedQty(p.returnQty, p.receivedQty, p.condition);
          const mismatch = isQuantityMismatch(p.returnQty, receivedQty);
          return {
            product: p.product || '',
            returnQty,
            reason: p.reason || '',
            remarks: p.remarks,
            receivedQty: String(receivedQty),
            condition: p.condition || '',
            batchLot: p.batchLot || '',
            storageLocation: p.storageLocation || '',
            quantityMismatch: mismatch,
            mismatchRemark: mismatch ? (p.mismatchRemark || '') : '',
          };
        });
        setProductRows(rows);
        setWarehousePhotos(Array.isArray(doc.warehousePhotos) ? doc.warehousePhotos : []);
      } catch (e: any) {
        Alert.alert('Error', e.message || 'Failed to load return');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    })();
  }, [returnId, navigation]);

  const updateProduct = (index: number, field: keyof ProductVerification, value: string | number | boolean) => {
    setProductRows((prev) => {
      const next = [...prev];
      const p = next[index];
      if (!p) return prev;
      (p as any)[field] = value;
      if (field === 'receivedQty') {
        const received = typeof value === 'string' ? parseInt(value, 10) : Number(value);
        p.quantityMismatch = isQuantityMismatch(p.returnQty, received);
        if (!p.quantityMismatch) {
          p.mismatchRemark = '';
        }
      }
      return next;
    });
  };

  const addWarehousePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission', 'We need photo access to add evidence.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (result.canceled || !result.assets[0]) return;
      const uri = result.assets[0].uri;
      setUploadingPhoto(true);
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'photo.jpg';
      formData.append('photo', { uri, name: filename, type: 'image/jpeg' } as any);
      const token = await AsyncStorage.getItem('authToken');
      const response = await fetch(`${getApiUrl()}/stock-returns/upload-photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Upload failed');
      }
      const data = await response.json();
      const url = data.photoUrl || data.url;
      if (url) setWarehousePhotos((prev) => [...prev, url]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removeWarehousePhoto = (index: number) => {
    setWarehousePhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const canSubmit = productRows.length > 0 && productRows.every((p) => {
    const received = parseInt(p.receivedQty, 10);
    return !isNaN(received) && p.condition && (p.condition.trim() !== '');
  });

  const hasAnyMismatch = productRows.some((p) => isQuantityMismatch(p.returnQty, p.receivedQty));
  const mismatchRemarkRequired = productRows.some(
    (p) => isQuantityMismatch(p.returnQty, p.receivedQty) && !(p.mismatchRemark || '').trim()
  );
  const canSubmitWithMismatch = !mismatchRemarkRequired;

  const handleSubmit = async () => {
    if (!canSubmit) {
      Alert.alert('Validation', 'Enter received quantity and condition for every product.');
      return;
    }
    if (hasAnyMismatch && !canSubmitWithMismatch) {
      Alert.alert('Validation', 'Mismatch remark is required when received quantity does not match requested.');
      return;
    }
    setSubmitting(true);
    try {
      const products = productRows.map((p) => {
        const receivedQty = normalizeQty(p.receivedQty) || 0;
        const mismatch = isQuantityMismatch(p.returnQty, receivedQty);
        return {
          product: p.product,
          returnQty: p.returnQty,
          reason: p.reason,
          remarks: p.remarks,
          receivedQty,
          condition: p.condition,
          batchLot: p.batchLot,
          storageLocation: p.storageLocation,
          quantityMismatch: mismatch,
          mismatchRemark: mismatch ? (p.mismatchRemark || '').trim() : '',
        };
      });
      const totalReceivedQty = products.reduce((s, p) => s + p.receivedQty, 0);
      await apiService.put(`/stock-returns/${returnId}/warehouse-verify`, {
        products,
        warehousePhotos,
        totalReceivedQty,
      });
      Alert.alert('Done', hasAnyMismatch ? 'Sent for manager review (quantity mismatch).' : 'Marked as received.');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !returnDoc) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const canEdit = ['Submitted', 'Sent Back'].includes(returnDoc.status);

  return (
    <ScreenShell
      title="Verify Return"
      loading={loading}
    >
<ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Read-only */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Return details (read-only)</Text>
          <Text style={styles.readOnlyLabel}>Return ID</Text>
          <Text style={styles.readOnlyValue}>{returnDoc.returnId || returnDoc._id}</Text>
          <Text style={styles.readOnlyLabel}>Customer</Text>
          <Text style={styles.readOnlyValue}>{returnDoc.customerName || '—'}</Text>
          <Text style={styles.readOnlyLabel}>Invoice / Sale ID</Text>
          <Text style={styles.readOnlyValue}>{returnDoc.saleId || '—'}</Text>
          <Text style={styles.readOnlyLabel}>Executive remarks</Text>
          <Text style={styles.readOnlyValue}>{returnDoc.executiveRemarks || '—'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Products requested</Text>
          {(returnDoc.products || []).map((p: any, i: number) => (
            <View key={i} style={styles.readOnlyRow}>
              <Text style={styles.readOnlyValue}>{p.product} — Qty: {p.returnQty}, Reason: {p.reason || '—'}</Text>
              {p.remarks ? <Text style={styles.readOnlySmall}>{p.remarks}</Text> : null}
            </View>
          ))}
        </View>

        {(returnDoc.evidencePhotos || []).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Executive photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {(returnDoc.evidencePhotos || []).map((url: string, i: number) => (
                <Image key={i} source={{ uri: url }} style={styles.photoThumb} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Physical verification */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Physical verification</Text>
          <Text style={styles.hint}>Enter received quantity, condition, batch/lot, storage location. Stock is not updated by you.</Text>
          {productRows.map((p, index) => (
            <View key={index} style={styles.productBlock}>
              <Text style={styles.productName}>{p.product} (requested: {p.returnQty})</Text>
              <View style={styles.row}>
                <Text style={styles.label}>Received Qty</Text>
                <WebInput
                  style={styles.input}
                  value={p.receivedQty}
                  onChangeText={(v) => /^\d*$/.test(v) && updateProduct(index, 'receivedQty', v)}
                  keyboardType="numeric"
                  placeholder="0"
                  editable={canEdit}
                />
              </View>
              <View style={styles.pickerWrap}>
                <Text style={styles.label}>Condition</Text>
                <Picker
                  selectedValue={p.condition}
                  onValueChange={(v) => updateProduct(index, 'condition', v)}
                  style={styles.picker}
                  enabled={canEdit}
                  prompt="Condition"
                >
                  <Picker.Item label="Select" value="" />
                  {CONDITION_OPTIONS.map((c) => (
                    <Picker.Item key={c} label={c} value={c} />
                  ))}
                </Picker>
              </View>
              <Text style={styles.label}>Batch / Lot</Text>
              <WebInput
                style={styles.input}
                value={p.batchLot}
                onChangeText={(v) => updateProduct(index, 'batchLot', v)}
                placeholder="Optional"
                editable={canEdit}
              />
              <Text style={styles.label}>Storage location</Text>
              <WebInput
                style={styles.input}
                value={p.storageLocation}
                onChangeText={(v) => updateProduct(index, 'storageLocation', v)}
                placeholder="Optional"
                editable={canEdit}
              />
              {p.quantityMismatch && (
                <>
                  <Text style={styles.mismatchLabel}>Quantity mismatch — remark required</Text>
                  <WebInput
                    style={[styles.input, styles.textArea]}
                    value={p.mismatchRemark}
                    onChangeText={(v) => updateProduct(index, 'mismatchRemark', v)}
                    placeholder="Explain difference"
                    multiline
                    editable={canEdit}
                  />
                </>
              )}
            </View>
          ))}
        </View>

        {/* Warehouse evidence */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Warehouse photos (optional)</Text>
          {canEdit && (
            <TouchableOpacity style={styles.photoButton} onPress={addWarehousePhoto} disabled={uploadingPhoto}>
              {uploadingPhoto ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.photoButtonText}>+ Add photo</Text>}
            </TouchableOpacity>
          )}
          {warehousePhotos.length > 0 && (
            <ScrollView horizontal style={styles.photoRow}>
              {warehousePhotos.map((url, i) => (
                <View key={i} style={styles.photoWrap}>
                  <Image source={{ uri: url }} style={styles.photoThumb} />
                  {canEdit && (
                    <TouchableOpacity style={styles.photoRemove} onPress={() => removeWarehousePhoto(i)}>
                      <Text style={styles.photoRemoveText}>×</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {canEdit && (
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.submitButton, (!canSubmit || (hasAnyMismatch && !canSubmitWithMismatch)) && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={submitting || !canSubmit || (hasAnyMismatch && !canSubmitWithMismatch)}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {hasAnyMismatch ? 'Send for manager review' : 'Mark as received'}
                </Text>
              )}
            </TouchableOpacity>
            {hasAnyMismatch && (
              <Text style={styles.hint}>Mismatch will be flagged; manager approval required. Add remark for each mismatched line.</Text>
            )}
          </View>
        )}

        {!canEdit && (
          <View style={styles.section}>
            <Text style={styles.readOnlyValue}>Status: {returnDoc.status}</Text>
          </View>
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, ...typography.body.medium, color: colors.textSecondary },
  header: { paddingHorizontal: 20, paddingTop: 50, paddingBottom: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 24, color: colors.textLight, fontWeight: 'bold' },
  headerTitle: { ...typography.heading.h3, color: colors.textLight, flex: 1, textAlign: 'center' },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 40 },
  section: { marginBottom: 24 },
  sectionTitle: { ...typography.heading.h3, color: colors.textPrimary, marginBottom: 12 },
  readOnlyLabel: { ...typography.body.small, color: colors.textSecondary, marginBottom: 4 },
  readOnlyValue: { ...typography.body.medium, color: colors.textPrimary, marginBottom: 8 },
  readOnlySmall: { ...typography.body.small, color: colors.textTertiary, marginBottom: 4 },
  readOnlyRow: { marginBottom: 8 },
  hint: { ...typography.body.small, color: colors.textSecondary, marginBottom: 12 },
  productBlock: { backgroundColor: colors.backgroundLight, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  productName: { ...typography.body.medium, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 },
  row: { marginBottom: 8 },
  label: { ...typography.body.small, color: colors.textSecondary, marginBottom: 4 },
  input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, ...typography.body.medium, color: colors.textPrimary },
  textArea: { minHeight: 60, textAlignVertical: 'top' },
  pickerWrap: { marginBottom: 8 },
  picker: { height: 44 },
  mismatchLabel: { ...typography.body.small, color: colors.warning, marginTop: 8, marginBottom: 4 },
  photoButton: { backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 8 },
  photoButtonText: { ...typography.body.medium, color: colors.primary },
  photoRow: { flexDirection: 'row', marginTop: 8 },
  photoWrap: { marginRight: 12, position: 'relative' },
  photoThumb: { width: 80, height: 80, borderRadius: 8 },
  photoRemove: { position: 'absolute', top: 4, right: 4, backgroundColor: colors.error, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  photoRemoveText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  submitButton: { backgroundColor: colors.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { ...typography.body.medium, color: colors.textLight, fontWeight: '600' },
});
