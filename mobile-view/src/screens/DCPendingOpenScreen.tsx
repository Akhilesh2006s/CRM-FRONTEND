/**
 * Pending DC Open screen - form aligned with navbar-landing Pending DC "Open" view.
 * GET /dc/:id, GET /dc-orders/:id; Lead Info & More Info & Delivery (read-only);
 * DC Details editable; Products table; Save (PUT /dc/:id), Submit to Warehouse (POST /dc/:id/manager-request).
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
import { useAuth } from '../../context/AuthContext';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, DataTable, WebLabel } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';

const CLASSES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const CATEGORIES = ['New Students', 'Existing Students', 'Both'];
const DC_CATEGORIES = ['Term 1', 'Term 2', 'Term 3', 'Full Year'];
const TERMS = ['Term 1', 'Term 2', 'Both'];

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
};

type DcOrderData = {
  _id?: string;
  school_name?: string;
  school_type?: string;
  dc_code?: string;
  contact_person?: string;
  contact_mobile?: string;
  email?: string;
  address?: string;
  location?: string;
  zone?: string;
  cluster?: string;
  remarks?: string;
  assigned_to?: { _id: string; name?: string } | string;
  transport_name?: string;
  transport_location?: string;
  transportation_landmark?: string;
  pincode?: string;
  pendingEdit?: {
    transport_name?: string;
    transport_location?: string;
    transportation_landmark?: string;
    pincode?: string;
  };
};

export default function DCPendingOpenScreen({ navigation, route }: any) {
  const dcId = route?.params?.dcId as string | undefined;
  const fromTermWise = route?.params?.fromTermWise === true;
  const scrollRef = useRef<ScrollView>(null);
  const { user } = useAuth();

  const [dc, setDc] = useState<any>(null);
  const [dcOrder, setDcOrder] = useState<DcOrderData | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // DC Details (editable)
  const [financeRemarks, setFinanceRemarks] = useState('');
  const [splApproval, setSplApproval] = useState('');
  const [dcDate, setDcDate] = useState('');
  const [showDcDatePicker, setShowDcDatePicker] = useState(false);
  const [dcRemarks, setDcRemarks] = useState('');
  const [dcCategory, setDcCategory] = useState('Term 1');
  const [dcNotes, setDcNotes] = useState('');
  const [smeRemarks, setSmeRemarks] = useState('');

  const [productRows, setProductRows] = useState<ProductRow[]>([]);

  const isSeniorCoordinator = user?.role === 'Senior Coordinator';
  const isAdmin = user?.role === 'Admin' || user?.role === 'Super Admin';
  const isTermWiseDc = fromTermWise || dc?.status === 'scheduled_for_later';
  const canSubmitToWarehouse = !isTermWiseDc && (isSeniorCoordinator || isAdmin);

  useEffect(() => {
    if (fromTermWise && dcId) {
      (async () => {
        try {
          const fullDC = await apiService.get(`/dc/${dcId}`);
          const orderId =
            fullDC.dcOrderId && typeof fullDC.dcOrderId === 'object' && fullDC.dcOrderId._id
              ? fullDC.dcOrderId._id
              : typeof fullDC.dcOrderId === 'string'
                ? fullDC.dcOrderId
                : null;
          if (orderId) {
            navigation.replace('ClientEditPO', { orderId, dcId });
            return;
          }
        } catch {
          /* fall through to pending open */
        }
        loadData();
        loadProducts();
      })();
      return;
    }
    if (dcId) {
      loadData();
      loadProducts();
    } else {
      setLoading(false);
      setErrorMessage('No DC selected');
    }
  }, [dcId, fromTermWise]);

  const loadData = async () => {
    try {
      setLoading(true);
      const fullDC = await apiService.get(`/dc/${dcId}`);
      setDc(fullDC);

      setFinanceRemarks(fullDC.financeRemarks || '');
      setSplApproval(fullDC.splApproval || '');
      setDcDate(fullDC.dcDate ? new Date(fullDC.dcDate).toISOString().split('T')[0] : '');
      setDcRemarks(fullDC.dcRemarks || '');
      setDcCategory(fullDC.dcCategory || 'Term 1');
      setDcNotes(fullDC.dcNotes || '');
      setSmeRemarks(fullDC.smeRemarks || '');

      const orderId =
        fullDC.dcOrderId && typeof fullDC.dcOrderId === 'object' && fullDC.dcOrderId._id
          ? fullDC.dcOrderId._id
          : typeof fullDC.dcOrderId === 'string'
            ? fullDC.dcOrderId
            : null;
      if (orderId) {
        try {
          const orderData = await apiService.get(`/dc-orders/${orderId}`);
          setDcOrder(orderData);
        } catch {
          setDcOrder(null);
        }
      } else {
        setDcOrder(null);
      }

      // Product rows from DC.productDetails or fallback
      if (fullDC.productDetails && Array.isArray(fullDC.productDetails) && fullDC.productDetails.length > 0) {
        setProductRows(
          fullDC.productDetails.map((p: any, idx: number) => ({
            id: String(idx + 1),
            product: p.product || p.productName || 'Abacus',
            class: p.class || '1',
            category: p.category || 'New Students',
            specs: p.specs || 'Regular',
            subject: p.subject,
            strength: Number(p.strength) ?? Number(p.quantity) ?? 0,
            level: p.level || 'L1',
            term: p.term || 'Term 1',
          }))
        );
      } else {
        const rawProduct = fullDC.product || 'Abacus';
        setProductRows([
          {
            id: '1',
            product: rawProduct,
            class: '1',
            category: 'New Students',
            specs: 'Regular',
            strength: fullDC.requestedQuantity || 0,
            level: 'L1',
            term: 'Term 1',
          },
        ]);
      }
    } catch (e: any) {
      setErrorMessage(e?.message || 'Failed to load DC');
      setDc(null);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const data = await apiService.get('/products/active').catch(() => apiService.get('/products'));
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
      {
        id: String(Date.now()),
        product: 'Abacus',
        class: '1',
        category: 'New Students',
        specs: 'Regular',
        strength: 0,
        level: 'L1',
        term: 'Term 1',
      },
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

  const handleSave = async () => {
    if (!dc) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    setSaving(true);
    try {
      const totalQuantity = productRows.reduce((sum, row) => sum + (Number(row.strength) || 0), 0);
      const productDetails = productRows.map((row) => ({
        product: row.product,
        class: row.class || '1',
        category: row.category || 'New Students',
        productName: row.product,
        quantity: Number(row.strength) || 0,
        strength: Number(row.strength) || 0,
        level: row.level || 'L1',
        specs: row.specs || 'Regular',
        subject: row.subject,
        term: row.term || 'Term 1',
      }));

      await apiService.put(`/dc/${dcId}`, {
        financeRemarks,
        splApproval,
        dcDate: dcDate || undefined,
        dcRemarks,
        dcCategory,
        dcNotes,
        smeRemarks,
        productDetails,
        requestedQuantity: totalQuantity || dc.requestedQuantity,
      });

      setSuccessMessage('DC saved successfully.');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (e: any) {
      setErrorMessage(e?.message || 'Failed to save DC');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitToWarehouse = async () => {
    if (!dc) return;
    const totalQuantity = productRows.reduce((sum, row) => sum + (Number(row.strength) || 0), 0);
    if (totalQuantity <= 0) {
      setErrorMessage('Please add at least one product with quantity (Strength) > 0');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    setErrorMessage(null);
    setSubmitting(true);
    try {
      const productDetails = productRows.map((row) => ({
        product: row.product,
        class: row.class || '1',
        category: row.category || 'New Students',
        productName: row.product,
        quantity: Number(row.strength) || 0,
        strength: Number(row.strength) || 0,
        level: row.level || 'L1',
        specs: row.specs || 'Regular',
        subject: row.subject,
        term: row.term || 'Term 1',
      }));

      await apiService.put(`/dc/${dcId}`, {
        financeRemarks,
        splApproval,
        dcDate: dcDate || undefined,
        dcRemarks,
        dcCategory,
        dcNotes,
        smeRemarks,
        productDetails,
        requestedQuantity: totalQuantity,
      });

      await apiService.post(`/dc/${dcId}/manager-request`, {
        requestedQuantity: totalQuantity,
        remarks: dcRemarks || smeRemarks || '',
      });

      setSuccessMessage('DC submitted to Warehouse successfully.');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      setTimeout(() => navigation.goBack(), 1500);
    } catch (e: any) {
      setErrorMessage(e?.message || 'Failed to submit to Warehouse');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setSubmitting(false);
    }
  };

  const clearMessages = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const getDCNumber = () => {
    if (!dc?.createdAt) return `DC-${(dc?._id || '').slice(-6)}`;
    const year = new Date(dc.createdAt).getFullYear();
    const shortYear = year.toString().slice(-2);
    const nextYear = (year + 1).toString().slice(-2);
    const id = (dc._id || '').slice(-4);
    return `${shortYear}-${nextYear}/${id}`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading DC...</Text>
      </View>
    );
  }

  if (!dc && !loading) {
    return (
    <ScreenShell title="Pending DC - Open" loading={loading}>
<View style={styles.errorBlock}>
          <Text style={styles.errorText}>{errorMessage || 'DC not found'}</Text>
        </View>
    </ScreenShell>
  );
  }

  const order = dcOrder || (dc?.dcOrderId && typeof dc.dcOrderId === 'object' ? dc.dcOrderId : null);
  const assignedName =
    order?.assigned_to && typeof order.assigned_to === 'object' && 'name' in order.assigned_to
      ? (order.assigned_to as { name?: string }).name
      : dc?.employeeId && typeof dc.employeeId === 'object' && 'name' in dc.employeeId
        ? (dc.employeeId as { name?: string }).name
        : '-';

  const shellTitle = isTermWiseDc
    ? `Edit PO${order?.school_name ? ` - ${order.school_name}` : ''}`
    : `Pending DC${order?.school_name ? ` - ${order.school_name}` : ''}`;

  return (
    <ScreenShell title={shellTitle} noScroll>
      <ScrollView ref={scrollRef} style={styles.content} contentContainerStyle={styles.contentContainer}>
        {successMessage && (
          <MessageBanner type="success" message={successMessage} onDismiss={clearMessages} />
        )}
        {errorMessage && (
          <MessageBanner type="error" message={errorMessage} onDismiss={clearMessages} />
        )}

        <View style={styles.dcMeta}>
          <Text style={styles.dcMetaText}>DC No: {getDCNumber()}</Text>
          {order && (
            <Text style={styles.dcMetaText}>
              Due: {(order as any).due_amount ?? 0} ({(order as any).due_percentage ?? 0}%)
            </Text>
          )}
        </View>

        {!isTermWiseDc && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lead Information</Text>
          <FormField label="School Type" value={order?.school_type || '-'} editable={false} />
          <FormField label="School Name" value={order?.school_name || dc?.customerName || '-'} editable={false} />
          <FormField label="School Code" value={order?.dc_code || '-'} editable={false} />
          <FormField label="Contact Person" value={order?.contact_person || '-'} editable={false} />
          <FormField label="Contact Mobile" value={order?.contact_mobile || dc?.customerPhone || '-'} editable={false} />
          <FormField label="Assigned To" value={assignedName} editable={false} />
        </View>
        )}

        {!isTermWiseDc && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>More Information</Text>
          <FormField label="Town" value={order?.location || (order?.address || '').split(',')[0] || '-'} editable={false} />
          <FormField label="Address" value={order?.address || order?.location || dc?.customerAddress || '-'} editable={false} />
          <FormField label="Zone" value={order?.zone || '-'} editable={false} />
          <FormField label="Cluster" value={order?.cluster || '-'} editable={false} />
          <FormField label="Remarks" value={order?.remarks || '-'} editable={false} />
        </View>
        )}

        {!isTermWiseDc && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery and Address</Text>
          <FormField
            label="Transport Name"
            value={order?.pendingEdit?.transport_name || order?.transport_name || '-'}
            editable={false}
          />
          <FormField
            label="Transport Location"
            value={order?.pendingEdit?.transport_location || order?.transport_location || '-'}
            editable={false}
          />
          <FormField
            label="Transportation Landmark"
            value={order?.pendingEdit?.transportation_landmark || order?.transportation_landmark || '-'}
            editable={false}
          />
          <FormField label="Pincode" value={order?.pendingEdit?.pincode || order?.pincode || '-'} editable={false} />
        </View>
        )}

        {/* DC Details (editable) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DC Details</Text>
          <FormField label="Finance Remarks" value={financeRemarks} onChangeText={setFinanceRemarks} placeholder="Finance Remarks" />
          <FormField label="SPL Approval" value={splApproval} onChangeText={setSplApproval} placeholder="Special Approval" />
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>DC Date</Text>
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
                  <Text style={styles.datePickerTitle}>DC Date</Text>
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
          <FormField label="DC Remarks" value={dcRemarks} onChangeText={setDcRemarks} placeholder="DC Remarks" />
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>DC Category</Text>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={dcCategory} onValueChange={setDcCategory} style={styles.picker}>
                {DC_CATEGORIES.map((c) => (
                  <Picker.Item key={c} label={c} value={c} />
                ))}
              </Picker>
            </View>
          </View>
          <FormField label="DC Notes" value={dcNotes} onChangeText={setDcNotes} placeholder="Notes" />
        </View>

        {/* Products */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Products</Text>
            <TouchableOpacity style={styles.addProductButton} onPress={addProductRow}>
              <Text style={styles.addProductButtonText}>+ Add</Text>
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
                <Text style={[styles.th, styles.colStrength]}>Strength</Text>
                <Text style={[styles.th, styles.colLevel]}>Level</Text>
                <Text style={[styles.th, styles.colTerm]}>Term</Text>
                <Text style={[styles.th, styles.colAction]}>Action</Text>
              </View>
              {productRows.map((row) => (
                <View key={row.id} style={styles.tableRow}>
                  <View style={[styles.td, styles.tdPickerWrap, styles.colProduct]}>
                    <Picker
                      selectedValue={row.product}
                      onValueChange={(v) => {
                        updateProductRow(row.id, 'product', v);
                        updateProductRow(row.id, 'level', getDefaultLevel(v));
                      }}
                      style={styles.tablePicker}
                      color="#111827"
                    >
                      {products.length
                        ? products.map((p: any) => (
                            <Picker.Item
                              key={p._id}
                              label={p.productName || p.name || p.product || 'Abacus'}
                              value={p.productName || p.name || p.product || 'Abacus'}
                            />
                          ))
                        : (
                            <Picker.Item label="Abacus" value="Abacus" />
                          )}
                    </Picker>
                  </View>
                  <View style={[styles.td, styles.tdPickerWrap, styles.colClass]}>
                    <Picker selectedValue={row.class} onValueChange={(v) => updateProductRow(row.id, 'class', v)} style={styles.tablePicker} color="#111827">
                      {CLASSES.map((c) => (
                        <Picker.Item key={c} label={c} value={c} />
                      ))}
                    </Picker>
                  </View>
                  <View style={[styles.td, styles.tdPickerWrap, styles.colCategory]}>
                    <Picker selectedValue={row.category} onValueChange={(v) => updateProductRow(row.id, 'category', v)} style={styles.tablePicker} color="#111827">
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
                    style={[styles.tableInput, styles.colStrength]}
                    value={String(row.strength)}
                    onChangeText={(v) => updateProductRow(row.id, 'strength', Number(v) || 0)}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                  <View style={[styles.td, styles.tdPickerWrap, styles.colLevel]}>
                    <Picker
                      selectedValue={row.level}
                      onValueChange={(v) => updateProductRow(row.id, 'level', v)}
                      style={styles.tablePicker}
                      color="#111827"
                    >
                      {getProductLevels(row.product).map((l) => (
                        <Picker.Item key={l} label={l} value={l} />
                      ))}
                    </Picker>
                  </View>
                  <View style={[styles.td, styles.tdPickerWrap, styles.colTerm]}>
                    {isTermWiseDc ? (
                      <Text style={styles.termReadOnly}>{row.term || 'Term 1'}</Text>
                    ) : (
                      <Picker
                        selectedValue={row.term || 'Term 1'}
                        onValueChange={(v) => updateProductRow(row.id, 'term', v)}
                        style={styles.tablePicker}
                        color="#111827"
                      >
                        {TERMS.map((t) => (
                          <Picker.Item key={t} label={t} value={t} />
                        ))}
                      </Picker>
                    )}
                  </View>
                  <TouchableOpacity style={[styles.td, styles.colAction]} onPress={() => removeProductRow(row.id)}>
                    <Text style={styles.removeBtn}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <View style={styles.tableFooter}>
                <Text style={styles.footerLabel}>Total:</Text>
                <Text style={styles.footerValue}>{productRows.reduce((sum, r) => sum + (Number(r.strength) || 0), 0)}</Text>
              </View>
            </View>
          </ScrollView>
        </View>

        {(isSeniorCoordinator || isAdmin) && !isTermWiseDc && (
          <View style={styles.section}>
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>SME Remarks</Text>
              <WebInput
                style={styles.input}
                value={smeRemarks}
                onChangeText={setSmeRemarks}
                placeholder="SME Remarks"
              />
            </View>
          </View>
        )}

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.textLight} size="small" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
          {canSubmitToWarehouse && (
            <TouchableOpacity
              style={[styles.warehouseButton, submitting && styles.buttonDisabled]}
              onPress={handleSubmitToWarehouse}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.textLight} size="small" />
              ) : (
                <Text style={styles.warehouseButtonText}>Submit to Warehouse</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </ScreenShell>
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
  dcMeta: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  dcMetaText: { ...typography.body.small, color: colors.textSecondary },
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
  tableWrap: { minWidth: 800, paddingRight: 20 },
  tableHeader: { flexDirection: 'row', backgroundColor: colors.background, padding: 10, borderBottomWidth: 2, borderBottomColor: colors.border, alignItems: 'center' },
  th: { ...typography.label.small, color: colors.textPrimary, fontWeight: '600' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, padding: 8, alignItems: 'center', minHeight: 44 },
  td: { ...typography.body.small, color: colors.textPrimary, justifyContent: 'center', paddingHorizontal: 4 },
  tableInput: { backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, borderRadius: 6, padding: 6, fontSize: 12, minHeight: 32, color: colors.textPrimary },
  tablePicker: { height: 36, minWidth: 70, color: '#111827', backgroundColor: colors.backgroundLight, fontSize: 14 },
  tdPickerWrap: { backgroundColor: colors.backgroundLight },
  colProduct: { width: 100 },
  colClass: { width: 48 },
  colCategory: { width: 95 },
  colSpecs: { width: 68 },
  colSubject: { width: 68 },
  colStrength: { width: 64 },
  colLevel: { width: 56 },
  colTerm: { width: 72 },
  colAction: { width: 48 },
  termReadOnly: { ...typography.body.small, color: colors.textPrimary },
  removeBtn: { fontSize: 18, color: colors.error, fontWeight: 'bold' },
  tableFooter: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', padding: 12, backgroundColor: colors.background, borderTopWidth: 2, borderTopColor: colors.border, gap: 8 },
  footerLabel: { ...typography.body.medium, fontWeight: '600', color: colors.textPrimary },
  footerValue: { ...typography.body.medium, fontWeight: '600', color: colors.primary },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16, marginBottom: 24 },
  cancelButton: {
    flex: 1,
    minWidth: 100,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelButtonText: { ...typography.label.medium, color: colors.textPrimary, fontWeight: '600' },
  saveButton: { flex: 1, minWidth: 100, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  saveButtonText: { ...typography.label.medium, color: colors.textLight, fontWeight: '600' },
  warehouseButton: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.error, alignItems: 'center' },
  warehouseButtonText: { ...typography.label.medium, color: colors.textLight, fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
});
