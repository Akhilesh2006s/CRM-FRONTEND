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

export default function DCEmpScreen({ navigation }: any) {
  const [activeTab, setActiveTab] = useState<'samples' | 'kits'>('samples');
  const [sampleRequests, setSampleRequests] = useState<any[]>([]);
  const [empDCs, setEmpDCs] = useState<any[]>([]);
  const [loadingSamples, setLoadingSamples] = useState(true);
  const [loadingKits, setLoadingKits] = useState(true);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  const [form, setForm] = useState({
    employee_id: '',
    kit_type: 'Sales',
    distribution_date: '',
    expected_return_date: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await Promise.all([loadSampleRequests(), loadEmpDCs(), loadEmployees()]);
  };

  const loadSampleRequests = async () => {
    try {
      setLoadingSamples(true);
      const data = await apiService.get('/sample-requests/pending');
      setSampleRequests(Array.isArray(data) ? data : []);
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
      setEmpDCs(Array.isArray(data) ? data : []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load employee kits');
    } finally {
      setLoadingKits(false);
    }
  };

  const loadEmployees = async () => {
    try {
      const data = await apiService.get('/employees?isActive=true');
      setEmployees(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('Failed to load employees:', error);
    }
  };

  const handleAccept = async (requestId: string) => {
    setProcessingRequest(requestId);
    try {
      await apiService.put(`/sample-requests/${requestId}/accept`);
      Alert.alert('Success', 'Sample request accepted and EmpDC created');
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to accept request');
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setProcessingRequest(requestId);
    try {
      await apiService.put(`/sample-requests/${requestId}/reject`, {
        rejection_reason: 'Rejected by admin'
      });
      Alert.alert('Success', 'Sample request rejected');
      loadSampleRequests();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to reject request');
    } finally {
      setProcessingRequest(null);
    }
  };

  const submitKit = async () => {
    if (!form.employee_id || !form.distribution_date) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    setSubmitting(true);
    try {
      await apiService.post('/emp-dc/create', form);
      Alert.alert('Success', 'Employee kit created successfully!');
      setForm({ employee_id: '', kit_type: 'Sales', distribution_date: '', expected_return_date: '' });
      loadEmpDCs();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create kit');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('en-IN');
    } catch {
      return '-';
    }
  };

  return (
    <ScreenShell
      title="EMP DC"
    >
<View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'samples' && styles.tabActive]}
          onPress={() => setActiveTab('samples')}
        >
          <Text style={[styles.tabText, activeTab === 'samples' && styles.tabTextActive]}>
            Sample Requests
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'kits' && styles.tabActive]}
          onPress={() => setActiveTab('kits')}
        >
          <Text style={[styles.tabText, activeTab === 'kits' && styles.tabTextActive]}>
            Employee Kits
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {activeTab === 'samples' ? (
          <View>
            <Text style={styles.sectionTitle}>Pending Sample Requests</Text>
            {loadingSamples ? (
              <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
            ) : sampleRequests.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No pending sample requests</Text>
              </View>
            ) : (
              sampleRequests.map((request) => (
                <View key={request._id} style={styles.requestCard}>
                  <View style={styles.requestHeader}>
                    <Text style={styles.requestCode}>{request.request_code}</Text>
                    <Text style={styles.requestDate}>{formatDate(request.createdAt)}</Text>
                  </View>
                  <Text style={styles.requestEmployee}>
                    Employee: {typeof request.employee_id === 'object' ? request.employee_id?.name : request.employee_id}
                  </Text>
                  <Text style={styles.requestPurpose}>{request.purpose}</Text>
                  {request.products && request.products.length > 0 && (
                    <View style={styles.productsList}>
                      {request.products.map((p: any, idx: number) => (
                        <Text key={idx} style={styles.productItem}>
                          • {p.product_name} (Qty: {p.quantity})
                        </Text>
                      ))}
                    </View>
                  )}
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
                </View>
              ))
            )}
          </View>
        ) : (
          <View>
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Create Employee Kit</Text>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Employee ID *</Text>
                <WebInput
                  style={styles.input}
                  placeholder="User ObjectId"
                  value={form.employee_id}
                  onChangeText={(text) => setForm({ ...form, employee_id: text })}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Kit Type *</Text>
                <View style={styles.kitTypeContainer}>
                  {['Sales', 'Training', 'Field'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.kitTypeButton, form.kit_type === type && styles.kitTypeButtonActive]}
                      onPress={() => setForm({ ...form, kit_type: type })}
                    >
                      <Text style={[styles.kitTypeText, form.kit_type === type && styles.kitTypeTextActive]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Distribution Date *</Text>
                <WebInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  value={form.distribution_date}
                  onChangeText={(text) => setForm({ ...form, distribution_date: text })}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Expected Return Date</Text>
                <WebInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  value={form.expected_return_date}
                  onChangeText={(text) => setForm({ ...form, expected_return_date: text })}
                />
              </View>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={submitKit}
                disabled={submitting || !form.employee_id || !form.distribution_date}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.textLight} />
                ) : (
                  <Text style={styles.submitButtonText}>Create Kit</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.listCard}>
              <Text style={styles.listTitle}>Employee Kits</Text>
              {loadingKits ? (
                <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
              ) : empDCs.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No employee kits</Text>
                </View>
              ) : (
                empDCs.map((kit) => (
                  <View key={kit._id} style={styles.kitCard}>
                    <View style={styles.kitHeader}>
                      <Text style={styles.kitCode}>{kit.emp_dc_code}</Text>
                      <Text style={styles.kitStatus}>{kit.status}</Text>
                    </View>
                    <Text style={styles.kitEmployee}>
                      Employee: {typeof kit.employee_id === 'object' ? kit.employee_id?.name : kit.employee_id}
                    </Text>
                    <Text style={styles.kitType}>Kit Type: {kit.kit_type}</Text>
                    <Text style={styles.kitDate}>Distribution: {formatDate(kit.distribution_date)}</Text>
                  </View>
                ))
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
});


