/**
 * Executive Manager: PO Change Request detail — view Previous/New PDF, Reason, mandatory Remarks, Approve/Reject.
 */
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
  Linking,
} from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, DataTable, WebLabel } from '../../ui/WebPrimitives';
import { apiService, getApiUrl } from '../../services/api';

let WebView: any;
try {
  WebView = require('react-native-webview').WebView;
} catch {
  WebView = null;
}

function getUploadsBaseUrl(): string {
  const apiUrl = getApiUrl();
  return apiUrl.replace(/\/api\/?$/, '');
}

function buildPdfUrl(raw: string | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:')) return trimmed;
  const base = getUploadsBaseUrl();
  let path: string;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const match = trimmed.match(/^https?:\/\/[^/]+(\/.*)?$/);
    path = (match && match[1]) ? match[1] : `/${trimmed.split('/').pop() || 'file'}`;
    if (!path.startsWith('/')) path = '/' + path;
  } else {
    path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }
  return `${base}${path}`;
}

export default function POChangeRequestDetailScreen({ navigation, route }: any) {
  const orderId = route?.params?.orderId as string | undefined;
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [managerRemarks, setManagerRemarks] = useState('');
  const [acting, setActing] = useState<'approve' | 'reject' | null>(null);

  useEffect(() => {
    if (orderId) loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    if (!orderId) return;
    try {
      setLoading(true);
      const data = await apiService.get(`/dc-orders/${orderId}`);
      setOrder(data);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load request');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const openPdf = (url: string | null) => {
    if (!url) return;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open document'));
  };

  const handleApprove = () => {
    const remarks = managerRemarks.trim();
    if (!remarks) {
      Alert.alert('Required', 'Remarks are mandatory for approval.');
      return;
    }
    Alert.alert(
      'Approve request',
      'New PO PDF will replace the current one. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Approve', onPress: () => submitDecision(true, remarks) },
      ]
    );
  };

  const handleReject = () => {
    const remarks = managerRemarks.trim();
    if (!remarks) {
      Alert.alert('Required', 'Remarks are mandatory for rejection.');
      return;
    }
    Alert.alert(
      'Reject request',
      'Current PO PDF will remain. Executive will see your remarks. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reject', onPress: () => submitDecision(false, remarks) },
      ]
    );
  };

  const submitDecision = async (approved: boolean, remarks: string) => {
    if (!orderId) return;
    setActing(approved ? 'approve' : 'reject');
    try {
      await apiService.put(`/dc-orders/${orderId}/approve-po-change`, {
        approved,
        managerRemarks: remarks,
      });
      Alert.alert(
        approved ? 'Approved' : 'Rejected',
        approved
          ? 'PO PDF updated. Executive can now Request DC.'
          : 'Request rejected. Executive will see your remarks and Request DC remains enabled.',
        [{ text: 'OK', onPress: () => navigation.navigate('POChangeRequests') }]
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to submit');
    } finally {
      setActing(null);
    }
  };

  if (loading && !order) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!order || !order.poChangeRequest || order.poChangeRequest.status !== 'PENDING_MANAGER_APPROVAL') {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Request not found or already processed.</Text>
        <TouchableOpacity style={styles.backLink} onPress={() => navigation.navigate('POChangeRequests')}>
          <Text style={styles.backLinkText}>Back to list</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const req = order.poChangeRequest;
  const prevUrl = buildPdfUrl(req.oldPdfUrl);
  const newUrl = buildPdfUrl(req.newPdfUrl);
  const requestedAt = req.requestedAt ? new Date(req.requestedAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '-';
  const executiveName = req.requestedBy?.name || req.requestedBy?.email || 'Executive';

  return (
    <ScreenShell
      title="PO Change Request"
      loading={loading}
    >
<ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Pending</Text>
        </View>
        <Text style={styles.clientName}>{order.school_name}</Text>
        <Text style={styles.meta}>Executive: {executiveName}</Text>
        <Text style={styles.meta}>Request date: {requestedAt}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Previous PO PDF</Text>
          {req.oldPdfUrl ? (
            <TouchableOpacity style={styles.pdfButton} onPress={() => openPdf(prevUrl)}>
              <Text style={styles.pdfButtonText}>View / Download</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.hint}>No previous PDF</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Updated PO PDF</Text>
          {req.newPdfUrl ? (
            <TouchableOpacity style={styles.pdfButton} onPress={() => openPdf(newUrl)}>
              <Text style={styles.pdfButtonText}>View / Download</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.hint}>No new PDF</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reason for update</Text>
          <Text style={styles.reasonText}>{req.remarks || '—'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your remarks (mandatory) *</Text>
          <WebInput
            style={styles.remarksInput}
            value={managerRemarks}
            onChangeText={setManagerRemarks}
            placeholder="Enter remarks for approval or rejection. Executive will see this."
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.approveBtn, acting && styles.disabled]}
            onPress={handleApprove}
            disabled={!!acting}
          >
            {acting === 'approve' ? <ActivityIndicator size="small" color={colors.textLight} /> : <Text style={styles.actionBtnText}>Approve</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.rejectBtn, acting && styles.disabled]}
            onPress={handleReject}
            disabled={!!acting}
          >
            {acting === 'reject' ? <ActivityIndicator size="small" color={colors.textLight} /> : <Text style={styles.actionBtnText}>Reject</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { ...typography.body.medium, color: colors.textSecondary, marginTop: 12 },
  backLink: { marginTop: 16 },
  backLinkText: { ...typography.body.medium, color: colors.primary, fontWeight: '600' },
  header: { paddingHorizontal: 20, paddingTop: 50, paddingBottom: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 24, color: colors.textLight, fontWeight: 'bold' },
  headerTitle: { ...typography.heading.h3, color: colors.textLight, flex: 1, textAlign: 'center' },
  content: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 40 },
  badge: { alignSelf: 'flex-start', backgroundColor: colors.warning + '30', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginBottom: 12 },
  badgeText: { ...typography.body.small, fontWeight: '600', color: colors.textPrimary },
  clientName: { ...typography.heading.h4, color: colors.textPrimary, marginBottom: 8 },
  meta: { ...typography.body.small, color: colors.textSecondary, marginBottom: 4 },
  section: { marginTop: 24 },
  sectionTitle: { ...typography.heading.h4, color: colors.textPrimary, marginBottom: 8 },
  pdfButton: { paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.primary, borderRadius: 10, alignSelf: 'flex-start' },
  pdfButtonText: { ...typography.body.medium, color: colors.textLight, fontWeight: '600' },
  hint: { ...typography.body.small, color: colors.textSecondary },
  reasonText: { ...typography.body.medium, color: colors.textPrimary, backgroundColor: colors.backgroundDark, padding: 12, borderRadius: 8 },
  remarksInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, ...typography.body.medium, color: colors.textPrimary, minHeight: 100, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 28 },
  actionBtn: { flex: 1, paddingVertical: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 52 },
  approveBtn: { backgroundColor: colors.success },
  rejectBtn: { backgroundColor: colors.error },
  actionBtnText: { ...typography.heading.h4, color: colors.textLight, fontWeight: '600' },
  disabled: { opacity: 0.7 },
});
