/**
 * Raise DC screen (admin) - full form aligned with navbar-landing closed sales Raise DC.
 * Load deal, employees, products; Lead Info, Assign Employee *, DC Details, Products table; Submit to Senior Coordinator.
 */
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
  Modal,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { apiService } from '../../services/api';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, DataTable, WebLabel } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';

type ProductRow = {
  id: string;
  product: string;
  class: string;
  category: string;
  specs: string;
  subject?: string;
  strength: number;
  level: string;
  term: string;
  unit_price: number;
};

const DEFAULT_ROW: Omit<ProductRow, 'id'> = {
  product: 'Abacus',
  class: '1',
  category: 'New Students',
  specs: 'Regular',
  strength: 0,
  level: 'L1',
  term: 'Term 1',
  unit_price: 0,
};

const CLASSES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const CATEGORIES = ['New Students', 'Existing Students', 'Both'];
const DC_CATEGORIES = ['Term 1', 'Term 2', 'Term 3', 'Full Year'];
const TERMS = ['Term 1', 'Term 2', 'Both'];

export default function DCCreateScreen({ navigation, route }: any) {
  const dealId = route?.params?.dealId as string | undefined;
  const scrollRef = useRef<ScrollView>(null);

  const [deal, setDeal] = useState<any>(null);
  const [isLead, setIsLead] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [employees, setEmployees] = useState<{ _id: string; name: string }[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [dcDate, setDcDate] = useState('');
  const [showDcDatePicker, setShowDcDatePicker] = useState(false);
  const [dcCategory, setDcCategory] = useState('Term 1');
  const [dcRemarks, setDcRemarks] = useState('');
  const [dcNotes, setDcNotes] = useState('');
  const [productRows, setProductRows] = useState<ProductRow[]>([
    { ...DEFAULT_ROW, id: '1' },
  ]);

  useEffect(() => {
    if (dealId) {
      loadDeal();
      loadEmployees();
      loadProducts();
    } else {
      setLoading(false);
      setErrorMessage('No deal selected');
    }
  }, [dealId]);

  const loadDeal = async () => {
    try {
      setLoading(true);
      let data: any;
      try {
        data = await apiService.get(`/dc-orders/${dealId}`);
        setIsLead(false);
      } catch {
        data = await apiService.get(`/leads/${dealId}`);
        setIsLead(true);
      }
      setDeal(data);
      if (data?.assigned_to) {
        const id = typeof data.assigned_to === 'object' ? data.assigned_to._id : data.assigned_to;
        if (id) setSelectedEmployeeId(id);
      }
      if (data?.products?.length) {
        setProductRows(
          data.products.map((p: any, idx: number) => ({
            id: String(idx + 1),
            product: p.product_name || p.product || 'Abacus',
            class: '1',
            category: data.school_type === 'Existing' ? 'Existing Students' : 'New Students',
            specs: 'Regular',
            strength: Number(p.quantity) || Number(p.strength) || 0,
            level: p.level || 'L1',
            term: p.term || 'Term 1',
            unit_price: Number(p.unit_price) || Number(p.price) || 0,
          }))
        );
      }
    } catch (e: any) {
      setErrorMessage(e?.message || 'Failed to load deal');
      setDeal(null);
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    try {
      const data = await apiService.get('/employees?isActive=true');
      const list = Array.isArray(data) ? data : data?.data || [];
      setEmployees(list.map((e: any) => ({ _id: e._id, name: e.name || 'Unknown' })));
    } catch {
      setEmployees([]);
    }
  };

  const loadProducts = async () => {
    try {
      let data: any = await apiService.get('/products/active').catch(() => apiService.get('/products'));
      const list = Array.isArray(data) ? data : data?.data || data?.products || [];
      setProducts(list);
    } catch {
      setProducts([]);
    }
  };

  const getProductLevels = (productName: string): string[] => {
    const p = products.find((x: any) => (x.productName || x.name || x.product) === productName);
    return p?.productLevels || ['L1'];
  };

  const getDefaultLevel = (productName: string) => getProductLevels(productName)[0] || 'L1';

  const addProductRow = () => {
    setProductRows((prev) => [
      ...prev,
      { ...DEFAULT_ROW, id: String(Date.now()) },
    ]);
  };

  const updateProductRow = (id: string, field: keyof ProductRow, value: any) => {
    setProductRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const removeProductRow = (id: string) => {
    setProductRows((prev) => prev.filter((r) => r.id !== id));
  };

  const validate = (): boolean => {
    if (!selectedEmployeeId.trim()) {
      setErrorMessage('Assign to Employee * is required');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return false;
    }
    if (!dcDate.trim()) {
      setErrorMessage('DC Date * is required');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return false;
    }
    if (productRows.length === 0) {
      setErrorMessage('Add at least one product row');
      return false;
    }
    const invalid = productRows.some(
      (r) => !r.product?.trim() || (r.strength ?? 0) <= 0
    );
    if (invalid) {
      setErrorMessage('Product and Quantity (Strength) * are required for all rows');
      return false;
    }
    setErrorMessage(null);
    return true;
  };

  const handleSubmitToSeniorCoordinator = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const productDetails = productRows.map((row) => ({
        product: row.product,
        class: row.class || '1',
        category: row.category || 'New Students',
        specs: row.specs || 'Regular',
        subject: row.subject,
        strength: Number(row.strength) || 0,
        quantity: Number(row.strength) || 0,
        level: row.level || 'L1',
        term: row.term || 'Term 1',
        unit_price: Number(row.unit_price) || 0,
        price: Number(row.unit_price) || 0,
      }));

      const terms = productDetails.map((p) => p.term || 'Term 1');
      const hasTerm2 = terms.some((t) => t === 'Term 2');
      const hasTerm1OrBoth = terms.some((t) => t === 'Term 1' || t === 'Both');
      const hasBothTerms = hasTerm2 && hasTerm1OrBoth;

      const requestedQuantity = productDetails.reduce((s, p) => s + (p.strength || 0), 0) || 1;
      await apiService.post('/dc/raise', {
        dcOrderId: dealId,
        dcDate: dcDate || undefined,
        dcRemarks: dcRemarks || undefined,
        dcCategory: dcCategory || undefined,
        dcNotes: dcNotes || undefined,
        employeeId: selectedEmployeeId,
        productDetails,
        requestedQuantity,
        status: hasTerm2 && !hasTerm1OrBoth ? 'scheduled_for_later' : 'pending_dc',
      });

      if (!isLead) {
        await apiService.put(`/dc-orders/${dealId}`, { status: 'dc_sent_to_senior' });
      }

      setSuccessMessage(hasBothTerms ? 'DC split: Term 1 → Pending DC, Term 2 → Term-Wise DC.' : 'DC raised and sent to Senior Coordinator.');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      setTimeout(() => {
        navigation.goBack();
      }, 1500);
    } catch (e: any) {
      setErrorMessage(e?.message || 'Failed to raise DC');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setSubmitting(false);
    }
  };

  const clearMessages = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!deal && !loading) {
    return (
    <ScreenShell
      title="Raise DC"
      loading={loading}
    >
<View style={styles.errorBlock}>
          <Text style={styles.errorText}>{errorMessage || 'Deal not found'}</Text>
        </View>
    </ScreenShell>
  );
  }

  return (
    <View style={styles.container}>
      <ScrollView ref={scrollRef} style={styles.content} contentContainerStyle={styles.contentContainer}>
        {successMessage && (
          <MessageBanner type="success" message={successMessage} onDismiss={clearMessages} />
        )}
        {errorMessage && (
          <MessageBanner type="error" message={errorMessage} onDismiss={clearMessages} />
        )}

        <Text style={styles.mandatoryNote}>Fields marked with * are mandatory.</Text>

        {/* Lead Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lead Information</Text>
          <FormField label="School Type" value={deal?.school_type || '-'} editable={false} />
          <FormField label="School Name" value={deal?.school_name || '-'} editable={false} />
          <FormField label="School Code" value={deal?.dc_code || deal?.school_code || '-'} editable={false} />
          <FormField label="Contact Person" value={deal?.contact_person || '-'} editable={false} />
          <FormField label="Contact Mobile" value={deal?.contact_mobile || '-'} editable={false} />
          <FormField label="Zone" value={deal?.zone || '-'} editable={false} />
          <FormField label="Location" value={deal?.location || deal?.address || '-'} editable={false} />
        </View>

        {/* Assign to Employee * */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Assign to Employee *</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={selectedEmployeeId}
              onValueChange={setSelectedEmployeeId}
              style={styles.picker}
            >
              <Picker.Item label="Select Employee *" value="" />
              {employees.map((emp) => (
                <Picker.Item key={emp._id} label={emp.name} value={emp._id} />
              ))}
            </Picker>
          </View>
        </View>

        {/* DC Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DC Details</Text>
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>DC Date *</Text>
            <TouchableOpacity style={styles.dateTouchable} onPress={() => setShowDcDatePicker(true)}>
              <Text style={[styles.dateText, !dcDate && styles.placeholderText]}>{dcDate || 'Tap to pick date'}</Text>
              <Text style={styles.calendarIcon}>📅</Text>
            </TouchableOpacity>
          </View>
          {showDcDatePicker && (
            <Modal visible transparent animationType="slide">
              <TouchableOpacity style={styles.datePickerOverlay} activeOpacity={1} onPress={() => setShowDcDatePicker(false)} />
              <View style={styles.datePickerBox}>
                <View style={styles.datePickerHeader}>
                  <Text style={styles.datePickerTitle}>DC Date *</Text>
                  <TouchableOpacity onPress={() => setShowDcDatePicker(false)}>
                    <Text style={styles.doneText}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={dcDate ? new Date(dcDate) : new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                  onChange={(_, d) => {
                    if (d) setDcDate(d.toISOString().split('T')[0]);
                    if (Platform.OS === 'android') setShowDcDatePicker(false);
                  }}
                />
              </View>
            </Modal>
          )}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>DC Category *</Text>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={dcCategory} onValueChange={setDcCategory} style={styles.picker}>
                {DC_CATEGORIES.map((c) => (
                  <Picker.Item key={c} label={c} value={c} />
                ))}
              </Picker>
            </View>
          </View>
          <FormField label="DC Remarks" value={dcRemarks} onChangeText={setDcRemarks} placeholder="Remarks" />
          <FormField label="DC Notes" value={dcNotes} onChangeText={setDcNotes} placeholder="Notes" />
        </View>

        {/* Products & Quantities */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Products & Quantities</Text>
            <TouchableOpacity style={styles.addProductButton} onPress={addProductRow}>
              <Text style={styles.addProductButtonText}>+ Add Product</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableScroll}>
            <View style={styles.tableWrap}>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, styles.colProduct]}>Product</Text>
                <Text style={[styles.th, styles.colClass]}>Class</Text>
                <Text style={[styles.th, styles.colCategory]}>Category</Text>
                <Text style={[styles.th, styles.colSpecs]}>Specs</Text>
                <Text style={[styles.th, styles.colSubject]}>Subject</Text>
                <Text style={[styles.th, styles.colQty]}>Quantity *</Text>
                <Text style={[styles.th, styles.colLevel]}>Level</Text>
                <Text style={[styles.th, styles.colTerm]}>Term</Text>
                <Text style={[styles.th, styles.colPrice]}>Unit Price *</Text>
                <Text style={[styles.th, styles.colTotal]}>Total</Text>
                <Text style={[styles.th, styles.colAction]}>Action</Text>
              </View>
              {productRows.map((row) => (
                <View key={row.id} style={styles.tableRow}>
                  <View style={[styles.td, styles.tdPickerWrap, styles.colProduct]}>
                    <Text style={styles.pickerLabel} numberOfLines={1} pointerEvents="none">{row.product || 'Abacus'}</Text>
                    <Picker
                      selectedValue={row.product}
                      onValueChange={(v) => updateProductRow(row.id, 'product', v)}
                      style={styles.tablePickerOverlay}
                      color="#111827"
                    >
                      {products.length ? products.map((p: any) => (
                        <Picker.Item key={p._id} label={p.productName || p.name || p.product || 'Abacus'} value={p.productName || p.name || p.product || 'Abacus'} />
                      )) : (
                        <Picker.Item label="Abacus" value="Abacus" />
                      )}
                    </Picker>
                  </View>
                  <View style={[styles.td, styles.tdPickerWrap, styles.colClass]}>
                    <Text style={styles.pickerLabel} pointerEvents="none">{row.class || '1'}</Text>
                    <Picker selectedValue={row.class} onValueChange={(v) => updateProductRow(row.id, 'class', v)} style={styles.tablePickerOverlay} color="#111827">
                      {CLASSES.map((c) => (
                        <Picker.Item key={c} label={c} value={c} />
                      ))}
                    </Picker>
                  </View>
                  <View style={[styles.td, styles.tdPickerWrap, styles.colCategory]}>
                    <Text style={styles.pickerLabel} numberOfLines={1} pointerEvents="none">{row.category || 'New Students'}</Text>
                    <Picker selectedValue={row.category} onValueChange={(v) => updateProductRow(row.id, 'category', v)} style={styles.tablePickerOverlay} color="#111827">
                      {CATEGORIES.map((c) => (
                        <Picker.Item key={c} label={c} value={c} />
                      ))}
                    </Picker>
                  </View>
                  <WebInput
                    style={[styles.tableInput, styles.colSpecs]}
                    value={row.specs}
                    onChangeText={(v) => updateProductRow(row.id, 'specs', v)}
                    placeholder="Specs"
                  />
                  <WebInput
                    style={[styles.tableInput, styles.colSubject]}
                    value={row.subject || ''}
                    onChangeText={(v) => updateProductRow(row.id, 'subject', v)}
                    placeholder="Subject"
                  />
                  <WebInput
                    style={[styles.tableInput, styles.colQty]}
                    value={String(row.strength)}
                    onChangeText={(v) => updateProductRow(row.id, 'strength', Number(v) || 0)}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                  <View style={[styles.td, styles.tdPickerWrap, styles.colLevel]}>
                    <Text style={styles.pickerLabel} pointerEvents="none">{row.level || 'L1'}</Text>
                    <Picker
                      selectedValue={row.level}
                      onValueChange={(v) => updateProductRow(row.id, 'level', v)}
                      style={styles.tablePickerOverlay}
                      color="#111827"
                    >
                      {getProductLevels(row.product).map((l) => (
                        <Picker.Item key={l} label={l} value={l} />
                      ))}
                    </Picker>
                  </View>
                  <View style={[styles.td, styles.tdPickerWrap, styles.colTerm]}>
                    <Text style={styles.pickerLabel} pointerEvents="none">{row.term || 'Term 1'}</Text>
                    <Picker selectedValue={row.term} onValueChange={(v) => updateProductRow(row.id, 'term', v)} style={styles.tablePickerOverlay} color="#111827">
                      {TERMS.map((t) => (
                        <Picker.Item key={t} label={t} value={t} />
                      ))}
                    </Picker>
                  </View>
                  <WebInput
                    style={[styles.tableInput, styles.colPrice]}
                    value={String(row.unit_price)}
                    onChangeText={(v) => updateProductRow(row.id, 'unit_price', Number(v) || 0)}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                  <Text style={[styles.td, styles.colTotal]}>{(row.strength || 0) * (row.unit_price || 0)}</Text>
                  <TouchableOpacity style={[styles.td, styles.colAction]} onPress={() => removeProductRow(row.id)}>
                    <Text style={styles.removeBtn}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <View style={styles.tableFooter}>
                <Text style={styles.footerLabel}>Grand Total (Qty):</Text>
                <Text style={styles.footerValue}>{productRows.reduce((s, r) => s + (Number(r.strength) || 0), 0)}</Text>
              </View>
            </View>
          </ScrollView>
        </View>

        {/* Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmitToSeniorCoordinator}
            disabled={submitting}
          >
            </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText?: (t: string) => void;
  placeholder?: string;
  editable?: boolean;
}) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <WebInput
        style={[styles.input, !editable && styles.inputDisabled]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder} editable={editable}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, ...typography.body.medium, color: colors.textSecondary },
  header: { paddingHorizontal: 20, paddingTop: 50, paddingBottom: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 24, color: colors.textLight, fontWeight: 'bold' },
  headerTitle: { ...typography.heading.h1, color: colors.textLight, flex: 1, textAlign: 'center' },
  content: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 40 },
  errorBlock: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { ...typography.body.medium, color: colors.error },
  mandatoryNote: { ...typography.body.small, color: colors.textSecondary, marginBottom: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { ...typography.heading.h3, color: colors.textPrimary, marginBottom: 12 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  fieldContainer: { marginBottom: 14 },
  label: { ...typography.label.medium, color: colors.textPrimary, marginBottom: 6 },
  input: { ...typography.body.medium, backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, color: colors.textPrimary },
  inputDisabled: { backgroundColor: colors.background, opacity: 0.8 },
  pickerWrap: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.backgroundLight },
  picker: { height: 48 },
  dateTouchable: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12 },
  dateText: { ...typography.body.medium, color: colors.textPrimary },
  placeholderText: { color: colors.textSecondary },
  calendarIcon: { fontSize: 18 },
  datePickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  datePickerBox: { backgroundColor: colors.backgroundLight, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: Platform.OS === 'ios' ? 24 : 16 },
  datePickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  datePickerTitle: { ...typography.heading.h3, color: colors.textPrimary },
  doneText: { ...typography.label.medium, color: colors.primary, fontWeight: '600' },
  addProductButton: { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  addProductButtonText: { ...typography.label.small, color: colors.textLight, fontWeight: '600' },
  tableScroll: { marginHorizontal: -20 },
  tableWrap: { minWidth: 1100, paddingRight: 20 },
  tableHeader: { flexDirection: 'row', backgroundColor: colors.background, padding: 10, borderBottomWidth: 2, borderBottomColor: colors.border, alignItems: 'center' },
  th: { ...typography.label.small, color: colors.textPrimary, fontWeight: '600' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, padding: 8, alignItems: 'center', minHeight: 44 },
  td: { ...typography.body.small, color: colors.textPrimary, justifyContent: 'center', paddingHorizontal: 4 },
  tdPickerWrap: { backgroundColor: colors.backgroundLight, position: 'relative' },
  pickerLabel: {
    fontSize: 12,
    color: '#111827',
    paddingVertical: 8,
    paddingHorizontal: 4,
    zIndex: 0,
  },
  tablePickerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    opacity: 0.01,
    zIndex: 1,
    height: 36,
    minWidth: 70,
  },
  tableInput: { backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, borderRadius: 6, padding: 6, fontSize: 12, minHeight: 32, color: colors.textPrimary },
  tablePicker: {
    height: 36,
    minWidth: 70,
    color: '#111827',
    backgroundColor: colors.backgroundLight,
    fontSize: 14,
  },
  colProduct: { width: 110 },
  colClass: { width: 52 },
  colCategory: { width: 100 },
  colSpecs: { width: 70 },
  colSubject: { width: 70 },
  colQty: { width: 64 },
  colLevel: { width: 56 },
  colTerm: { width: 72 },
  colPrice: { width: 72 },
  colTotal: { width: 64 },
  colAction: { width: 48 },
  removeBtn: { fontSize: 18, color: colors.error, fontWeight: 'bold' },
  tableFooter: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', padding: 12, backgroundColor: colors.background, borderTopWidth: 2, borderTopColor: colors.border, gap: 8 },
  footerLabel: { ...typography.body.medium, fontWeight: '600', color: colors.textPrimary },
  footerValue: { ...typography.body.medium, fontWeight: '600', color: colors.primary },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelButton: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelButtonText: { ...typography.label.medium, color: colors.textPrimary, fontWeight: '600' },
  submitButton: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  submitButtonDisabled: { opacity: 0.6 },
  submitGradient: { paddingVertical: 14, alignItems: 'center' },
  submitButtonText: { ...typography.label.medium, color: colors.textLight, fontWeight: '600' },
});
