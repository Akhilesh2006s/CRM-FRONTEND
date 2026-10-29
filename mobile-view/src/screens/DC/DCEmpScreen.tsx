import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, DataTable, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useDcCatalog } from '../../hooks/useDcCatalog';

import DateField from '../../ui/DateField';
type KitProduct = { product: string; quantity: string };

/** BDEs request samples and see their own requests / kits; reviewers accept, reject and issue kits (web dc/emp). */
const BDE_ROLES = ['Executive', 'Sales BDE', 'Employee'];

export default function DCEmpScreen({ navigation }: any) {
  const { user } = useAuth();
  const isBde = BDE_ROLES.includes(String(user?.role || ''));
  const { productNames } = useDcCatalog();
  const [activeTab, setActiveTab] = useState<'samples' | 'kits'>('samples');
  const [sampleRequests, setSampleRequests] = useState<any[]>([]);
  const [empDCs, setEmpDCs] = useState<any[]>([]);
  const [loadingSamples, setLoadingSamples] = useState(true);
  const [loadingKits, setLoadingKits] = useState(true);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  const [returningId, setReturningId] = useState<string | null>(null);
  const [form, setForm] = useState({
    employee_id: '',
    kit_type: 'Sales',
    distribution_date: '',
    expected_return_date: '',
  });
  const [kitProducts, setKitProducts] = useState<KitProduct[]>([{ product: '', quantity: '1' }]);
  const [submitting, setSubmitting] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBde]);

  const loadData = async () => {
    await Promise.all([loadSampleRequests(), loadEmpDCs(), isBde ? Promise.resolve() : loadEmployees()]);
  };

  const loadSampleRequests = async () => {
    try {
      setLoadingSamples(true);
      // A BDE sees all of their own requests with status; reviewers see the pending queue.
      const data = await apiService.get(isBde ? '/sample-requests/my' : '/sample-requests/pending');
      setSampleRequests(Array.isArray(data) ? data : data?.data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load sample requests');
    } finally {
      setLoadingSamples(false);
    }
  };

  const loadEmpDCs = async () => {
    try {
      setLoadingKits(true);
      const data = await apiService.get('/emp-dc/list');
      setEmpDCs(Array.isArray(data) ? data : data?.data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load employee kits');
    } finally {
      setLoadingKits(false);
    }
  };

  const loadEmployees = async () => {
    try {
      const res = await apiService.get('/employees?isActive=true');
      const rows: any[] = Array.isArray(res) ? res : res?.data || res?.employees || [];
      setEmployees(
        rows.filter((e) => e && e._id).sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
      );
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Could not load employees');
    }
  };

  const handleAccept = async (requestId: string) => {
    setProcessingRequest(requestId);
    try {
      await apiService.put(`/sample-requests/${requestId}/accept`, {});
      Alert.alert('Success', 'Accepted — EmpDC created and sample DC sent to warehouse queue');
      loadSampleRequests();
      loadEmpDCs();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to accept sample request');
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setProcessingRequest(requestId);
    try {
      await apiService.put(`/sample-requests/${requestId}/reject`, {
        rejection_reason: 'Rejected by admin',
      });
      Alert.alert('Success', 'Sample request rejected');
      loadSampleRequests();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to reject sample request');
    } finally {
      setProcessingRequest(null);
    }
  };

  const updateKitProduct = (idx: number, patch: Partial<KitProduct>) =>
    setKitProducts((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const submitKit = async () => {
    if (!form.employee_id) {
      Alert.alert('Error', 'Select the employee who receives the kit.');
      return;
    }
    if (!form.distribution_date) {
      Alert.alert('Error', 'Enter the distribution date.');
      return;
    }
    const products = kitProducts
      .filter((p) => p.product.trim())
      .map((p) => ({ product: p.product.trim(), quantity: Math.floor(Number(p.quantity)) || 0 }));
    const badQty = products.find((p) => p.quantity < 1);
    if (badQty) {
      Alert.alert('Error', `Enter a quantity of at least 1 for ${badQty.product}.`);
      return;
    }
    setSubmitting(true);
    try {
      await apiService.post('/emp-dc/create', { ...form, products });
      Alert.alert('Success', 'Employee kit created');
      setForm({ employee_id: '', kit_type: 'Sales', distribution_date: '', expected_return_date: '' });
      setKitProducts([{ product: '', quantity: '1' }]);
      loadEmpDCs();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create the employee kit.');
    } finally {
      setSubmitting(false);
    }
  };

  const markReturned = async (kit: any) => {
    setReturningId(kit._id);
    try {
      await apiService.put(`/emp-dc/${kit._id}/return`, {});
      Alert.alert('Success', `${kit.emp_dc_code} marked returned`);
      loadEmpDCs();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to mark the kit returned.');
    } finally {
      setReturningId(null);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return '-';
    }
  };

  const statusColors = (status: string) =>
    status === 'Accepted'
      ? { bg: colors.successLight, fg: colors.success }
      : status === 'Rejected'
        ? { bg: colors.errorLight, fg: colors.error }
        : { bg: colors.warningLight, fg: '#92400E' };

  return (
    <ScreenShell title="EMP DC (Employee Kits)">
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'samples' && styles.tabActive]}
          onPress={() => setActiveTab('samples')}
        >
          <Text style={[styles.tabText, activeTab === 'samples' && styles.tabTextActive]}>Sample Requests</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'kits' && styles.tabActive]}
          onPress={() => setActiveTab('kits')}
        >
          <Text style={[styles.tabText, activeTab === 'kits' && styles.tabTextActive]}>Employee Kits</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {activeTab === 'samples' ? (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{isBde ? 'My Sample Requests' : 'Pending Sample Requests'}</Text>
              {isBde ? (
                <WebButton title="+ Request samples" onPress={() => navigation?.navigate?.('SamplesRequest')} />
              ) : null}
            </View>
            {loadingSamples ? (
              <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
            ) : sampleRequests.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {isBde ? 'You have not requested any samples yet.' : 'No pending sample requests'}
                </Text>
              </View>
            ) : (
              sampleRequests.map((request) => {
                const delivery = [request.area, request.city].filter(Boolean).join(', ');
                const transport = [request.transport_name, request.pincode].filter(Boolean).join(' · ');
                const sc = statusColors(String(request.status || 'Pending'));
                return (
                  <View key={request._id} style={styles.requestCard}>
                    <View style={styles.requestHeader}>
                      <Text style={styles.requestCode}>{request.request_code}</Text>
                      <Text style={styles.requestDate}>{formatDate(request.createdAt)}</Text>
                    </View>
                    {request.school_name ? <Text style={styles.requestEmployee}>School: {request.school_name}</Text> : null}
                    <Text style={styles.requestEmployee}>
                      Employee: {typeof request.employee_id === 'object' ? request.employee_id?.name : request.employee_id}
                    </Text>
                    <Text style={styles.requestPurpose}>{request.purpose}</Text>
                    {delivery || transport ? (
                      <Text style={styles.productItem}>
                        Delivery: {delivery || '—'}
                        {transport ? ` (${transport})` : ''}
                      </Text>
                    ) : null}
                    {request.products && request.products.length > 0 && (
                      <View style={styles.productsList}>
                        {request.products.map((p: any, idx: number) => (
                          <Text key={idx} style={styles.productItem}>
                            • {p.product_name}
                            {p.class ? ` · Cl ${p.class}` : ''}
                            {p.level ? ` · ${p.level}` : ''} (Qty: {p.quantity})
                          </Text>
                        ))}
                      </View>
                    )}
                    {isBde ? (
                      <View style={[styles.badge, { backgroundColor: sc.bg }]}>
                        <Text style={[styles.badgeText, { color: sc.fg }]}>{request.status || 'Pending'}</Text>
                      </View>
                    ) : (
                      <View style={styles.requestActions}>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.acceptButton]}
                          onPress={() => handleAccept(request._id)}
                          disabled={processingRequest === request._id}
                        >
                          {processingRequest === request._id ? (
                            <ActivityIndicator color={colors.textLight} />
                          ) : (
                            <Text style={styles.actionButtonText}>Accept</Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.rejectButton]}
                          onPress={() => handleReject(request._id)}
                          disabled={processingRequest === request._id}
                        >
                          <Text style={[styles.actionButtonText, styles.rejectButtonText]}>Reject</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        ) : (
          <View>
            {!isBde ? (
              <View style={styles.formCard}>
                <Text style={styles.formTitle}>Create Employee Kit</Text>
                <WebSelect
                  label="Employee *"
                  value={form.employee_id}
                  onValueChange={(v) => setForm({ ...form, employee_id: v })}
                  placeholder="Select employee"
                  items={employees.map((emp) => ({
                    value: String(emp._id),
                    label: `${emp.name || emp.email || 'Employee'}${emp.empCode ? ` (${emp.empCode})` : ''}${emp.role ? ` · ${emp.role}` : ''}`,
                  }))}
                />
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Kit Type</Text>
                  <View style={styles.kitTypeContainer}>
                    {['Sales', 'Training', 'Field'].map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[styles.kitTypeButton, form.kit_type === type && styles.kitTypeButtonActive]}
                        onPress={() => setForm({ ...form, kit_type: type })}
                      >
                        <Text style={[styles.kitTypeText, form.kit_type === type && styles.kitTypeTextActive]}>{type}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Distribution Date *</Text>
                  <DateField placeholder="Distribution Date *" value={form.distribution_date} onChange={(text) => setForm({ ...form, distribution_date: text })} />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Expected Return</Text>
                  <DateField placeholder="Expected Return" value={form.expected_return_date} onChange={(text) => setForm({ ...form, expected_return_date: text })} />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Kit products</Text>
                  {kitProducts.map((item, idx) => (
                    <View key={idx} style={styles.kitProductRow}>
                      <View style={{ flex: 1 }}>
                        <WebSelect
                          compact
                          value={item.product}
                          onValueChange={(v) => updateKitProduct(idx, { product: v })}
                          placeholder="Select product"
                          items={productNames.map((name) => ({ label: name, value: name }))}
                        />
                      </View>
                      <WebInput
                        style={styles.qtyInput}
                        placeholder="Qty"
                        keyboardType="number-pad"
                        value={item.quantity}
                        onChangeText={(t) => updateKitProduct(idx, { quantity: t.replace(/[^0-9]/g, '') })}
                      />
                      <TouchableOpacity
                        onPress={() =>
                          setKitProducts((rows) =>
                            rows.length > 1 ? rows.filter((_, i) => i !== idx) : [{ product: '', quantity: '1' }]
                          )
                        }
                      >
                        <Text style={styles.removeText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  <WebButton
                    title="+ Add product"
                    variant="outline"
                    onPress={() => setKitProducts((rows) => [...rows, { product: '', quantity: '1' }])}
                  />
                </View>
                <WebButton
                  title={submitting ? 'Creating…' : 'Create Kit'}
                  onPress={submitKit}
                  loading={submitting}
                  disabled={submitting}
                />
              </View>
            ) : null}

            <View style={styles.listCard}>
              <Text style={styles.listTitle}>{isBde ? 'My Kits' : 'Employee Kits'}</Text>
              {loadingKits ? (
                <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
              ) : empDCs.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No employee kits</Text>
                </View>
              ) : (
                empDCs.map((kit) => {
                  const returned = kit.status === 'returned';
                  return (
                    <View key={kit._id} style={styles.kitCard}>
                      <View style={styles.kitHeader}>
                        <Text style={styles.kitCode}>{kit.emp_dc_code}</Text>
                        <Text style={styles.kitStatus}>
                          {String(kit.status || '').replace(/^./, (c: string) => c.toUpperCase())}
                        </Text>
                      </View>
                      <Text style={styles.kitEmployee}>
                        Employee: {typeof kit.employee_id === 'object' ? kit.employee_id?.name : kit.employee_id}
                      </Text>
                      <Text style={styles.kitType}>Kit: {kit.kit_type}</Text>
                      <Text style={styles.kitType}>
                        Products:{' '}
                        {Array.isArray(kit.products) && kit.products.length
                          ? kit.products.map((p: any) => `${p.product} × ${p.quantity}`).join(', ')
                          : '-'}
                      </Text>
                      <Text style={styles.kitDate}>Date: {formatDate(kit.distribution_date)}</Text>
                      <Text style={styles.kitDate}>Expected Return: {formatDate(kit.expected_return_date)}</Text>
                      <View style={styles.kitAction}>
                        {isBde ? (
                          <Text style={styles.kitStatus}>{returned ? 'Returned' : 'With you'}</Text>
                        ) : returned ? (
                          <Text style={styles.kitStatus}>Returned</Text>
                        ) : (
                          <WebButton
                            title={returningId === kit._id ? 'Saving…' : 'Mark Returned'}
                            variant="outline"
                            disabled={returningId === kit._id}
                            onPress={() => markReturned(kit)}
                          />
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </ScreenShell>
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
  tabContainer: { flexDirection: 'row', backgroundColor: colors.backgroundLight, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, padding: 16, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { ...typography.body.medium, color: colors.textSecondary },
  tabTextActive: { color: colors.primary, fontWeight: '600' },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32 },
  sectionTitle: { ...typography.heading.h3, color: colors.textPrimary, marginBottom: 16 },
  loader: { padding: 20 },
  emptyContainer: { padding: 20, alignItems: 'center' },
  emptyText: { ...typography.body.medium, color: colors.textSecondary },
  requestCard: { backgroundColor: colors.backgroundLight, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  requestHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  requestCode: { ...typography.heading.h4, color: colors.textPrimary },
  requestDate: { ...typography.body.small, color: colors.textSecondary },
  requestEmployee: { ...typography.body.medium, color: colors.textPrimary, marginBottom: 4 },
  requestPurpose: { ...typography.body.medium, color: colors.textPrimary, marginBottom: 8 },
  productsList: { marginBottom: 12 },
  productItem: { ...typography.body.small, color: colors.textSecondary, marginBottom: 4 },
  requestActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  actionButton: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center' },
  acceptButton: { backgroundColor: colors.success },
  rejectButton: { backgroundColor: colors.error },
  actionButtonText: { ...typography.body.medium, color: colors.textLight, fontWeight: '600' },
  rejectButtonText: { color: colors.textLight },
  formCard: { backgroundColor: colors.backgroundLight, borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  formTitle: { ...typography.heading.h3, color: colors.textPrimary, marginBottom: 16 },
  formGroup: { marginBottom: 16 },
  label: { ...typography.body.medium, color: colors.textPrimary, marginBottom: 8, fontWeight: '600' },
  input: { backgroundColor: colors.background, borderRadius: 12, padding: 12, ...typography.body.medium, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border },
  kitTypeContainer: { flexDirection: 'row', gap: 8 },
  kitTypeButton: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, alignItems: 'center' },
  kitTypeButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  kitTypeText: { ...typography.body.medium, color: colors.textPrimary },
  kitTypeTextActive: { color: colors.textLight, fontWeight: '600' },
  submitButton: { backgroundColor: colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  submitButtonText: { ...typography.body.medium, color: colors.textLight, fontWeight: '600' },
  listCard: { backgroundColor: colors.backgroundLight, borderRadius: 16, padding: 20, shadowColor: colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  listTitle: { ...typography.heading.h3, color: colors.textPrimary, marginBottom: 16 },
  kitCard: { backgroundColor: colors.background, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  kitHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  kitCode: { ...typography.heading.h4, color: colors.textPrimary },
  kitStatus: { ...typography.body.small, color: colors.textSecondary },
  kitEmployee: { ...typography.body.medium, color: colors.textPrimary, marginBottom: 4 },
  kitType: { ...typography.body.medium, color: colors.textPrimary, marginBottom: 4 },
  kitDate: { ...typography.body.small, color: colors.textSecondary },
  kitAction: { marginTop: 8, alignItems: 'flex-start' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, marginTop: 4 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  kitProductRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  qtyInput: { width: 70, marginBottom: 0 },
  removeText: { color: colors.error, fontSize: 13, fontWeight: '600' },
});


