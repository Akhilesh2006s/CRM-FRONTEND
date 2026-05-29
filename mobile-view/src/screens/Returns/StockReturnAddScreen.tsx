import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  FlatList,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { colors, gradients } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { apiService, getApiUrl } from '../../services/api';
import LogoutButton from '../../components/LogoutButton';
import { useAuth } from '../../context/AuthContext';

const RETURN_TYPES = ['Damaged', 'Expired', 'Excess', 'Wrong item', 'Replacement'];
const MAIN_WAREHOUSE = 'Main Warehouse';

const NEXT_ACTION_BY_STATUS: Record<string, string> = {
  Draft: 'Complete & Submit',
  Submitted: 'Warehouse Verification',
  Received: 'Under Review',
  'Pending Manager Approval': 'Manager Decision',
  Approved: 'Closed',
  'Partially Approved': 'Closed',
  Rejected: '—',
  'Sent Back': 'Resubmit',
  'Stock Updated': 'Closed',
  Closed: '—',
};

function formatDate(d: string | Date | undefined) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-IN');
  } catch {
    return '';
  }
}

type ProductRow = {
  id: string;
  product: string;
  soldQty: number;
  returnQty: string;
  reason: string;
  remarks: string;
};

export default function StockReturnAddScreen({ navigation, route }: any) {
  const { user } = useAuth();
  const returnIdParam = route?.params?.returnId as string | undefined; // existing return _id for edit/view
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<string[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [warehouseLocations, setWarehouseLocations] = useState<string[]>([]);
  const [existingReturn, setExistingReturn] = useState<any>(null);
  const scrollRef = useRef<ScrollView>(null);

  const [customerName, setCustomerName] = useState('');
  const [saleId, setSaleId] = useState('');
  const [warehouse, setWarehouse] = useState('');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [returnType, setReturnType] = useState('');
  const [productRows, setProductRows] = useState<ProductRow[]>([]);
  const [evidencePhotos, setEvidencePhotos] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [executiveRemarks, setExecutiveRemarks] = useState('');
  const [displayReturnId, setDisplayReturnId] = useState('');

  const isViewMode = existingReturn && existingReturn.status !== 'Draft';
  const isEditDraft = existingReturn && existingReturn.status === 'Draft';

  useEffect(() => {
    (async () => {
      if (!user?._id) return;
      try {
        setLoading(true);
        const [custRes, locRes] = await Promise.all([
          apiService.get('/sales/customers').catch(() => []),
          apiService.get('/warehouse/locations').catch(() => []),
        ]);
        setCustomers(Array.isArray(custRes) ? custRes : []);
        setWarehouseLocations([MAIN_WAREHOUSE]);
        if (returnIdParam) {
          const ret = await apiService.get(`/stock-returns/${returnIdParam}`);
          setExistingReturn(ret);
          setDisplayReturnId(ret.returnId || '');
          setCustomerName(ret.customerName || '');
          setSaleId(ret.saleId ? String(ret.saleId) : '');
          setWarehouse(ret.warehouse || '');
          setReturnDate(ret.returnDate ? new Date(ret.returnDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
          setReturnType(ret.returnType || '');
          setExecutiveRemarks(ret.executiveRemarks || '');
          setEvidencePhotos(Array.isArray(ret.evidencePhotos) ? ret.evidencePhotos : []);
          if (ret.products && ret.products.length) {
            setProductRows(
              ret.products.map((p: any, i: number) => ({
                id: `row-${i}-${p.product}`,
                product: p.product || '',
                soldQty: Number(p.soldQty) || 0,
                returnQty: String(p.returnQty ?? ''),
                reason: p.reason || '',
                remarks: p.remarks || '',
              }))
            );
          }
        } else {
          setDisplayReturnId(`RET-${Date.now()}`);
          setWarehouse(MAIN_WAREHOUSE);
        }
      } catch (e: any) {
        Alert.alert('Error', e.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    })();
  }, [user?._id, returnIdParam]);

  useEffect(() => {
    if (!customerName || !user?._id) {
      setSales([]);
      setSaleId('');
      setProductRows([]);
      return;
    }
    (async () => {
      try {
        const list = await apiService.get(`/sales?assignedTo=${user._id}&customerName=${encodeURIComponent(customerName)}`);
        setSales(Array.isArray(list) ? list : []);
        setSaleId('');
        setProductRows([]);
      } catch {
        setSales([]);
      }
    })();
  }, [customerName, user?._id]);

  useEffect(() => {
    if (!saleId || !sales.length) {
      setProductRows([]);
      return;
    }
    const sale = sales.find((s) => s._id === saleId);
    if (!sale) {
      setProductRows([]);
      return;
    }
    setProductRows([
      {
        id: `row-${sale._id}`,
        product: sale.product || '',
        soldQty: Number(sale.quantity) || 0,
        returnQty: '',
        reason: '',
        remarks: '',
      },
    ]);
  }, [saleId, sales]);

  const addPhoto = async () => {
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
      const type = 'image/jpeg';
      formData.append('photo', { uri, name: filename, type } as any);
      const token = await AsyncStorage.getItem('authToken');
      const baseURL = getApiUrl();
      const response = await fetch(`${baseURL}/stock-returns/upload-photo`, {
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
      if (url) setEvidencePhotos((prev) => [...prev, url]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removePhoto = (index: number) => {
    setEvidencePhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const updateProductRow = (id: string, field: keyof ProductRow, value: string | number) => {
    setProductRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const sold = field === 'soldQty' ? Number(value) : r.soldQty;
        let returnQty = field === 'returnQty' ? String(value) : r.returnQty;
        if (field === 'returnQty' && /^\d*$/.test(String(value))) {
          const num = parseInt(String(value), 10);
          if (!isNaN(num) && num > sold) return r;
        }
        return { ...r, [field]: value };
      })
    );
  };

  const productsValid = productRows.length > 0 && productRows.every((r) => {
    const q = parseInt(r.returnQty, 10);
    return !isNaN(q) && q > 0 && q <= r.soldQty && (r.reason || '').trim() !== '';
  });
  const evidenceRequired = returnType === 'Damaged' || returnType === 'Expired';
  const evidenceOk = !evidenceRequired || (evidencePhotos.length > 0 && (executiveRemarks || '').trim() !== '');
  const canSubmit = productsValid && evidenceOk && returnDate && returnType && customerName && saleId;

  const buildPayload = () => {
    const products = productRows
      .filter((r) => parseInt(r.returnQty, 10) > 0)
      .map((r) => ({
        product: r.product,
        soldQty: r.soldQty,
        returnQty: parseInt(r.returnQty, 10) || 0,
        reason: r.reason.trim(),
        remarks: r.remarks.trim(),
      }));
    const totalQuantity = products.reduce((s, p) => s + p.returnQty, 0);
    return {
      returnId: existingReturn?.returnId || displayReturnId,
      returnDate,
      returnType,
      customerName,
      warehouse: warehouse || undefined,
      saleId: saleId || undefined,
      executiveRemarks: executiveRemarks.trim() || undefined,
      evidencePhotos,
      products,
      totalItems: products.length,
      totalQuantity,
    };
  };

  const saveDraft = async () => {
    setSaving(true);
    try {
      const payload = { ...buildPayload(), status: 'Draft' };
      if (payload.products.length === 0) {
        payload.products = [{ product: '—', soldQty: 0, returnQty: 0, reason: 'Draft', remarks: '' }];
        payload.totalItems = 0;
        payload.totalQuantity = 0;
      }
      if (existingReturn?._id) {
        await apiService.put(`/stock-returns/${existingReturn._id}`, payload);
        Alert.alert('Saved', 'Draft updated.');
      } else {
        await apiService.post('/stock-returns/executive', payload);
        Alert.alert('Saved', 'Draft saved.');
      }
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const submitReturn = async () => {
    if (!canSubmit) {
      Alert.alert('Validation', 'Please complete: Customer, Invoice, Return Date & Type, at least one product with Return Qty and Reason. For Damaged/Expired, add photo and remarks.');
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (existingReturn?._id) {
        await apiService.put(`/stock-returns/${existingReturn._id}`, { ...payload, status: 'Submitted' });
        Alert.alert('Submitted', 'Return request submitted.');
      } else {
        await apiService.post('/stock-returns/executive', { ...payload, status: 'Submitted' });
        Alert.alert('Submitted', 'Return request submitted.');
      }
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to submit');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
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
          <Text style={styles.headerTitle}>{returnIdParam ? (isViewMode ? 'View Return' : 'Edit Draft Return') : 'Add Return'}</Text>
          <LogoutButton />
        </View>
      </LinearGradient>

      <View style={styles.stepTabs}>
        {[1, 2, 3, 4].map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.stepTab, step === s && styles.stepTabActive]}
            onPress={() => !isViewMode && setStep(s)}
          >
            <Text style={[styles.stepTabText, step === s && styles.stepTabTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView ref={scrollRef} style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Step 1: Basic info */}
        {step === 1 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Return Information</Text>
            <Text style={styles.readOnlyLabel}>Return ID</Text>
            <Text style={styles.readOnlyValue}>{displayReturnId || '—'}</Text>
            <Text style={styles.readOnlyLabel}>Executive Name</Text>
            <Text style={styles.readOnlyValue}>{user?.name || '—'}</Text>

            <Text style={styles.label}>Customer / Outlet *</Text>
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={customerName}
                onValueChange={setCustomerName}
                style={styles.picker}
                enabled={!isViewMode}
                prompt="Select customer"
              >
                <Picker.Item label="Select customer" value="" />
                {customers.map((c) => (
                  <Picker.Item key={c} label={c} value={c} />
                ))}
              </Picker>
            </View>

            <Text style={styles.label}>Original Invoice / Sale *</Text>
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={saleId}
                onValueChange={setSaleId}
                style={styles.picker}
                enabled={!isViewMode && !!customerName}
                prompt="Select sale"
              >
                <Picker.Item label="Select sale" value="" />
                {sales.map((s) => (
                  <Picker.Item
                    key={s._id}
                    label={`${s.product} × ${s.quantity} - ${formatDate(s.saleDate)}`}
                    value={s._id}
                  />
                ))}
              </Picker>
            </View>

            <Text style={styles.label}>Warehouse</Text>
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={warehouse}
                onValueChange={setWarehouse}
                style={styles.picker}
                enabled={!isViewMode}
                prompt="Select warehouse"
              >
                <Picker.Item label="Select warehouse" value="" />
                {warehouseLocations.map((w) => (
                  <Picker.Item key={w} label={w} value={w} />
                ))}
              </Picker>
            </View>

            <Text style={styles.label}>Return Date *</Text>
            <TextInput
              style={styles.input}
              value={returnDate}
              onChangeText={setReturnDate}
              placeholder="YYYY-MM-DD"
              editable={!isViewMode}
            />
            <Text style={styles.label}>Return Type *</Text>
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={returnType}
                onValueChange={setReturnType}
                style={styles.picker}
                enabled={!isViewMode}
                prompt="Select type"
              >
                <Picker.Item label="Select type" value="" />
                {RETURN_TYPES.map((t) => (
                  <Picker.Item key={t} label={t} value={t} />
                ))}
              </Picker>
            </View>
          </View>
        )}

        {/* Step 2: Products */}
        {step === 2 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Product Selection</Text>
            <Text style={styles.hint}>Only products from the selected invoice. Return Qty ≤ Sold Qty. Reason required per product.</Text>
            {productRows.length === 0 ? (
              <Text style={styles.emptyText}>Select Customer and Sale in Step 1 first.</Text>
            ) : (
              <>
                <View style={styles.tableHeader}>
                  <Text style={[styles.th, styles.colProduct]}>Product</Text>
                  <Text style={[styles.th, styles.colQty]}>Sold</Text>
                  <Text style={[styles.th, styles.colQty]}>Return</Text>
                  <Text style={[styles.th, styles.colReason]}>Reason</Text>
                  <Text style={[styles.th, styles.colRemarks]}>Remarks</Text>
                </View>
                {productRows.map((row) => (
                  <View key={row.id} style={styles.tableRow}>
                    <Text style={[styles.td, styles.colProduct]} numberOfLines={1}>{row.product}</Text>
                    <Text style={[styles.td, styles.colQty]}>{row.soldQty}</Text>
                    <TextInput
                      style={[styles.inputSmall, styles.colQty]}
                      value={row.returnQty}
                      onChangeText={(v) => /^\d*$/.test(v) && updateProductRow(row.id, 'returnQty', v)}
                      keyboardType="numeric"
                      placeholder="0"
                      editable={!isViewMode}
                      maxLength={6}
                    />
                    <TextInput
                      style={[styles.inputSmall, styles.colReason]}
                      value={row.reason}
                      onChangeText={(v) => updateProductRow(row.id, 'reason', v)}
                      placeholder="Reason *"
                      editable={!isViewMode}
                    />
                    <TextInput
                      style={[styles.inputSmall, styles.colRemarks]}
                      value={row.remarks}
                      onChangeText={(v) => updateProductRow(row.id, 'remarks', v)}
                      placeholder="Remarks"
                      editable={!isViewMode}
                    />
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        {/* Step 3: Evidence */}
        {step === 3 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Evidence & Remarks</Text>
            {(returnType === 'Damaged' || returnType === 'Expired') && (
              <Text style={styles.warningText}>Photo and executive remarks are mandatory for Damaged/Expired.</Text>
            )}
            <Text style={styles.label}>Photos (product, batch, damage)</Text>
            <TouchableOpacity style={styles.photoButton} onPress={addPhoto} disabled={isViewMode || uploadingPhoto}>
              {uploadingPhoto ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.photoButtonText}>+ Add Photo</Text>}
            </TouchableOpacity>
            {evidencePhotos.length > 0 && (
              <FlatList
                horizontal
                data={evidencePhotos}
                keyExtractor={(item, i) => i.toString()}
                renderItem={({ item, index }) => (
                  <View style={styles.photoWrap}>
                    <Image source={{ uri: item }} style={styles.photoThumb} />
                    {!isViewMode && (
                      <TouchableOpacity style={styles.photoRemove} onPress={() => removePhoto(index)}>
                        <Text style={styles.photoRemoveText}>×</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              />
            )}
            <Text style={styles.label}>Executive remarks * (mandatory for Damaged/Expired)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={executiveRemarks}
              onChangeText={setExecutiveRemarks}
              placeholder="Remarks for warehouse"
              multiline
              numberOfLines={4}
              editable={!isViewMode}
            />
          </View>
        )}

        {/* Step 4: Summary & actions */}
        {step === 4 && (() => {
          const totalItems = productRows.filter((r) => parseInt(r.returnQty, 10) > 0).length;
          const totalQty = productRows.reduce((s, r) => s + (parseInt(r.returnQty, 10) || 0), 0);
          return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total items returned</Text>
              <Text style={styles.summaryValue}>{totalItems}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total quantity</Text>
              <Text style={styles.summaryValue}>{totalQty}</Text>
            </View>
            {existingReturn && (
              <>
                <Text style={styles.label}>Current Status</Text>
                <Text style={styles.readOnlyValue}>{existingReturn.status}</Text>
                <Text style={styles.label}>Next Action</Text>
                <Text style={styles.readOnlyValue}>{NEXT_ACTION_BY_STATUS[existingReturn.status] || '—'}</Text>
                <Text style={styles.label}>Created / Updated</Text>
                <Text style={styles.readOnlyValue}>{formatDate(existingReturn.createdAt)} / {formatDate(existingReturn.updatedAt)}</Text>
              </>
            )}
            {!isViewMode && (
              <View style={styles.actions}>
                <TouchableOpacity style={[styles.btn, styles.btnDraft]} onPress={saveDraft} disabled={saving}>
                  {saving ? <ActivityIndicator color={colors.textPrimary} /> : <Text style={styles.btnDraftText}>Save as Draft</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.btnSubmit]} onPress={submitReturn} disabled={saving || !canSubmit}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnSubmitText}>Submit Return Request</Text>}
                </TouchableOpacity>
              </View>
            )}
            {!canSubmit && !isViewMode && (
              <Text style={styles.hint}>Complete all steps: select invoice, add products with return qty & reason, and evidence if Damaged/Expired.</Text>
            )}
          </View>
          );
        })()}

        {step < 4 && !isViewMode && (
          <TouchableOpacity style={styles.nextButton} onPress={() => setStep(step + 1)}>
            <Text style={styles.nextButtonText}>Next →</Text>
          </TouchableOpacity>
        )}
        {step > 1 && (
          <TouchableOpacity style={styles.backStepButton} onPress={() => setStep(step - 1)}>
            <Text style={styles.backStepText}>← Back</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: 12, ...typography.body.medium, color: colors.textSecondary },
  header: { paddingHorizontal: 20, paddingTop: 50, paddingBottom: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 24, color: colors.textLight, fontWeight: 'bold' },
  headerTitle: { ...typography.heading.h3, color: colors.textLight, flex: 1, textAlign: 'center' },
  stepTabs: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.backgroundLight, borderBottomWidth: 1, borderBottomColor: colors.border },
  stepTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, marginHorizontal: 4 },
  stepTabActive: { backgroundColor: colors.primary, marginHorizontal: 4 },
  stepTabText: { ...typography.body.medium, color: colors.textSecondary },
  stepTabTextActive: { ...typography.body.medium, color: colors.textLight, fontWeight: '600' },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 40 },
  section: { marginBottom: 24 },
  sectionTitle: { ...typography.heading.h3, color: colors.textPrimary, marginBottom: 12 },
  label: { ...typography.body.medium, color: colors.textPrimary, fontWeight: '600', marginBottom: 6 },
  readOnlyLabel: { ...typography.body.small, color: colors.textSecondary, marginBottom: 4 },
  readOnlyValue: { ...typography.body.medium, color: colors.textPrimary, marginBottom: 12 },
  hint: { ...typography.body.small, color: colors.textSecondary, marginBottom: 12 },
  warningText: { ...typography.body.small, color: colors.warning, marginBottom: 12 },
  emptyText: { ...typography.body.medium, color: colors.textSecondary, fontStyle: 'italic', marginVertical: 12 },
  input: { backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, ...typography.body.medium, color: colors.textPrimary, marginBottom: 12 },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  pickerWrap: { backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, borderRadius: 12, marginBottom: 12 },
  picker: { height: 48 },
  tableHeader: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: colors.border },
  th: { ...typography.label.small, fontWeight: '600', color: colors.textPrimary },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  td: { ...typography.body.small, color: colors.textPrimary },
  colProduct: { width: 80, paddingRight: 4 },
  colQty: { width: 44, paddingRight: 4 },
  colReason: { flex: 1, minWidth: 70 },
  colRemarks: { flex: 1, minWidth: 60 },
  inputSmall: { backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, borderRadius: 6, padding: 6, fontSize: 12, color: colors.textPrimary },
  photoButton: { backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  photoButtonText: { ...typography.body.medium, color: colors.primary },
  photoWrap: { marginRight: 12, position: 'relative' },
  photoThumb: { width: 80, height: 80, borderRadius: 8 },
  photoRemove: { position: 'absolute', top: 4, right: 4, backgroundColor: colors.error, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  photoRemoveText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  summaryLabel: { ...typography.body.medium, color: colors.textSecondary },
  summaryValue: { ...typography.body.medium, color: colors.textPrimary, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  btn: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  btnDraft: { backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border },
  btnSubmit: { backgroundColor: colors.primary },
  btnDraftText: { ...typography.body.medium, color: colors.textPrimary, fontWeight: '600' },
  btnSubmitText: { ...typography.body.medium, color: colors.textLight, fontWeight: '600' },
  nextButton: { backgroundColor: colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  nextButtonText: { ...typography.body.medium, color: colors.textLight, fontWeight: '600' },
  backStepButton: { padding: 12, alignItems: 'center', marginTop: 8 },
  backStepText: { ...typography.body.small, color: colors.primary },
});
