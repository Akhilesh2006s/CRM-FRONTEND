import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { colors } from '../../theme/colors';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, WebLabel } from '../../ui/WebPrimitives';
import { Card, CardTitle, InfoRow, ActionRow, EmptyState, ChipRow, SectionTitle, toneFor } from '../../ui/Kit';
import { Act } from '../../components/dc/DcUi';
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

  const empName = (e: any) => (typeof e === 'object' ? e?.name : e);
  const cap = (v: any) => String(v || '').replace(/^./, (c: string) => c.toUpperCase());

  return (
    <ScreenShell title="EMP DC (Employee Kits)">
      <View style={styles.tabs}>
        <ChipRow
          items={[
            { key: 'samples', label: 'Sample Requests' },
            { key: 'kits', label: 'Employee Kits' },
          ]}
          value={activeTab}
          onChange={(k) => setActiveTab(k as 'samples' | 'kits')}
        />
      </View>

      {activeTab === 'samples' ? (
        <View>
          <SectionTitle>{isBde ? 'My Sample Requests' : 'Pending Sample Requests'}</SectionTitle>
          {isBde ? <WebButton title="+ Request samples" onPress={() => navigation?.navigate?.('SamplesRequest')} /> : null}
          {loadingSamples ? (
            <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
          ) : sampleRequests.length === 0 ? (
            <EmptyState title={isBde ? 'No sample requests yet' : 'No pending sample requests'} />
          ) : (
            sampleRequests.map((request) => {
              const delivery = [request.area, request.city].filter(Boolean).join(', ');
              const transport = [request.transport_name, request.pincode].filter(Boolean).join(' · ');
              const status = String(request.status || 'Pending');
              return (
                <Card key={request._id}>
                  <CardTitle
                    title={request.request_code || 'Sample request'}
                    subtitle={formatDate(request.createdAt)}
                    badge={isBde ? status : undefined}
                    tone={toneFor(status)}
                  />
                  <InfoRow label="School" value={request.school_name} />
                  <InfoRow label="Employee" value={empName(request.employee_id)} />
                  <InfoRow label="Purpose" value={request.purpose} />
                  {delivery || transport ? (
                    <InfoRow label="Delivery" value={`${delivery || '—'}${transport ? ` (${transport})` : ''}`} />
                  ) : null}
                  {request.products && request.products.length > 0 ? (
                    <InfoRow
                      label="Products"
                      value={
                        <View>
                          {request.products.map((p: any, idx: number) => (
                            <Text key={idx} style={styles.productItem}>
                              {p.product_name}
                              {p.class ? ` · Cl ${p.class}` : ''}
                              {p.level ? ` · ${p.level}` : ''} × {p.quantity}
                            </Text>
                          ))}
                        </View>
                      }
                    />
                  ) : null}
                  {!isBde ? (
                    <ActionRow>
                      <Act
                        title="Accept"
                        variant="success"
                        onPress={() => handleAccept(request._id)}
                        disabled={processingRequest === request._id}
                        loading={processingRequest === request._id}
                      />
                      <Act
                        title="Reject"
                        variant="destructive"
                        onPress={() => handleReject(request._id)}
                        disabled={processingRequest === request._id}
                      />
                    </ActionRow>
                  ) : null}
                </Card>
              );
            })
          )}
        </View>
      ) : (
        <View>
          {!isBde ? (
            <PageSection title="Create Employee Kit">
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
              <WebLabel>Kit Type</WebLabel>
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
              <View style={styles.dateRow}>
                <View style={styles.flex1}>
                  <WebLabel>Distribution Date *</WebLabel>
                  <DateField placeholder="Distribution Date *" value={form.distribution_date} onChange={(text) => setForm({ ...form, distribution_date: text })} />
                </View>
                <View style={styles.flex1}>
                  <WebLabel>Expected Return</WebLabel>
                  <DateField placeholder="Expected Return" value={form.expected_return_date} onChange={(text) => setForm({ ...form, expected_return_date: text })} />
                </View>
              </View>
              <WebLabel>Kit products</WebLabel>
              {kitProducts.map((item, idx) => (
                <View key={idx} style={styles.kitProductRow}>
                  <View style={styles.flex1}>
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
                    hitSlop={8}
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
              <WebButton
                title={submitting ? 'Creating…' : 'Create Kit'}
                onPress={submitKit}
                loading={submitting}
                disabled={submitting}
              />
            </PageSection>
          ) : null}

          <SectionTitle>{isBde ? 'My Kits' : 'Employee Kits'}</SectionTitle>
          {loadingKits ? (
            <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
          ) : empDCs.length === 0 ? (
            <EmptyState title="No employee kits" />
          ) : (
            empDCs.map((kit) => {
              const returned = kit.status === 'returned';
              const badge = isBde ? (returned ? 'Returned' : 'With you') : cap(kit.status);
              return (
                <Card key={kit._id}>
                  <CardTitle title={kit.emp_dc_code || 'Kit'} badge={badge || undefined} tone={returned ? 'success' : 'info'} />
                  <InfoRow label="Employee" value={empName(kit.employee_id)} />
                  <InfoRow label="Kit" value={kit.kit_type} />
                  <InfoRow
                    label="Products"
                    value={
                      Array.isArray(kit.products) && kit.products.length
                        ? kit.products.map((p: any) => `${p.product} × ${p.quantity}`).join(', ')
                        : '-'
                    }
                  />
                  <InfoRow label="Date" value={formatDate(kit.distribution_date)} />
                  <InfoRow label="Expected return" value={formatDate(kit.expected_return_date)} />
                  {!isBde && !returned ? (
                    <ActionRow>
                      <Act
                        title={returningId === kit._id ? 'Saving…' : 'Mark Returned'}
                        variant="outline"
                        disabled={returningId === kit._id}
                        onPress={() => markReturned(kit)}
                      />
                    </ActionRow>
                  ) : null}
                </Card>
              );
            })
          )}
        </View>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  tabs: { marginBottom: 8 },
  loader: { padding: 20 },
  productItem: { fontSize: 14, color: colors.textPrimary, marginBottom: 2 },
  kitTypeContainer: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  kitTypeButton: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#DCE3EC', backgroundColor: colors.backgroundLight, alignItems: 'center' },
  kitTypeButtonActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  kitTypeText: { fontSize: 14, color: colors.textPrimary },
  kitTypeTextActive: { color: colors.textLight, fontWeight: '600' },
  dateRow: { flexDirection: 'row', gap: 12 },
  flex1: { flex: 1 },
  kitProductRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  qtyInput: { width: 70, marginBottom: 0 },
  removeText: { color: colors.error, fontSize: 13, fontWeight: '600' },
});
