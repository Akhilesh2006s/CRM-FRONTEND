/**
 * Executive Manager: PO Change Request detail — view Previous/New PDF, Reason, mandatory Remarks, Approve/Reject.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator, Linking } from 'react-native';
import { colors } from '../../theme/colors';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebLabel } from '../../ui/WebPrimitives';
import { Card, CardTitle, InfoRow } from '../../ui/Kit';
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
        <View style={styles.backLink}>
          <WebButton title="Back to list" variant="outline" onPress={() => navigation.navigate('POChangeRequests')} />
        </View>
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
<Card>
        <CardTitle title={order.school_name || '—'} badge="Pending" tone="warning" />
        <InfoRow label="Executive" value={executiveName} />
        <InfoRow label="Requested" value={requestedAt} />
      </Card>

      <PageSection title="PO documents">
        <WebLabel>Previous PO PDF</WebLabel>
        {req.oldPdfUrl ? (
          <View style={styles.btnWrap}>
            <WebButton title="View / Download" variant="outline" onPress={() => openPdf(prevUrl)} />
          </View>
        ) : (
          <Text style={styles.hint}>No previous PDF</Text>
        )}
        <WebLabel>Updated PO PDF</WebLabel>
        {req.newPdfUrl ? (
          <View style={styles.btnWrap}>
            <WebButton title="View / Download" variant="outline" onPress={() => openPdf(newUrl)} />
          </View>
        ) : (
          <Text style={styles.hint}>No new PDF</Text>
        )}
      </PageSection>

      <PageSection title="Reason for update">
        <Text style={styles.reasonText}>{req.remarks || '—'}</Text>
      </PageSection>

      <PageSection title="Your decision">
        <WebLabel>Remarks *</WebLabel>
        <WebInput
          style={styles.remarksInput}
          value={managerRemarks}
          onChangeText={setManagerRemarks}
          placeholder="Remarks for approval or rejection"
          multiline
          numberOfLines={4}
        />
        <Text style={styles.hint}>Required. The Executive will see this.</Text>
        <View style={styles.actions}>
          <View style={{ flex: 1 }}>
            <WebButton title="Approve" variant="success" onPress={handleApprove} disabled={!!acting} loading={acting === 'approve'} />
          </View>
          <View style={{ flex: 1 }}>
            <WebButton title="Reject" variant="destructive" onPress={handleReject} disabled={!!acting} loading={acting === 'reject'} />
          </View>
        </View>
      </PageSection>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: colors.background },
  loadingText: { fontSize: 14, color: colors.textSecondary, marginTop: 12, textAlign: 'center' },
  backLink: { marginTop: 16, minWidth: 160 },
  btnWrap: { alignSelf: 'flex-start', marginBottom: 12 },
  hint: { fontSize: 13, color: colors.textTertiary, marginBottom: 12 },
  reasonText: { fontSize: 14, color: colors.textPrimary, lineHeight: 20 },
  remarksInput: { minHeight: 100, textAlignVertical: 'top', marginBottom: 6 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
});
