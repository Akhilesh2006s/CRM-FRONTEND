import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { colors, spacing } from '../../theme/colors';
import { apiService } from '../../services/api';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { Card, CardTitle, InfoRow, ActionRow, EmptyState } from '../../ui/Kit';
import { WebInput, WebButton, WebSelect, WebLabel } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';

type Person = { _id?: string; name?: string; email?: string };
type TrainingRequest = {
  _id: string;
  requestedBy?: Person | string | null;
  schoolName: string;
  schoolCode?: string;
  zone?: string;
  subject: string;
  preferredDate: string;
  remarks?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  rejectionReason?: string;
};

const STATUS_ITEMS = [
  { label: 'Pending', value: 'Pending' },
  { label: 'Approved', value: 'Approved' },
  { label: 'Rejected', value: 'Rejected' },
  { label: 'All', value: 'All' },
];

function personName(value?: Person | string | null) {
  if (!value) return '—';
  if (typeof value === 'string') return value;
  return value.name || '—';
}

function errMsg(e: any, fallback: string) {
  return e?.response?.data?.message || e?.message || fallback;
}

function fmtDate(value?: string) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function TrainingRequestsReviewScreen() {
  const [status, setStatus] = useState('Pending');
  const [items, setItems] = useState<TrainingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectError, setRejectError] = useState('');
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = status === 'All' ? '' : `?status=${status}`;
      const data = await apiService.get(`/training-requests${query}`);
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setBanner({ type: 'error', message: errMsg(e, 'Failed to load training requests') });
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (id: string) => {
    setActing(true);
    try {
      await apiService.put(`/training-requests/${id}/approve`, {});
      setBanner({ type: 'success', message: 'Training request approved' });
      load();
    } catch (e: any) {
      setBanner({ type: 'error', message: errMsg(e, 'Failed to approve') });
    } finally {
      setActing(false);
    }
  };

  const confirmReject = async () => {
    if (!rejectId) return;
    const reason = rejectionReason.trim();
    if (!reason) {
      setRejectError('Rejection reason is required');
      return;
    }
    setActing(true);
    try {
      await apiService.put(`/training-requests/${rejectId}/reject`, { rejectionReason: reason });
      setBanner({ type: 'success', message: 'Training request rejected' });
      setRejectId(null);
      setRejectionReason('');
      load();
    } catch (e: any) {
      setRejectError(errMsg(e, 'Failed to reject'));
    } finally {
      setActing(false);
    }
  };

  return (
    <ScreenShell
      title="Training Requests"
      subtitle="Approve or reject training requests raised by BDEs and trainers."
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      {banner ? (
        <MessageBanner type={banner.type} message={banner.message} onDismiss={() => setBanner(null)} />
      ) : null}

      <PageSection title="Filter">
        <WebSelect label="Status" value={status} onValueChange={(v) => setStatus(v || 'Pending')} items={STATUS_ITEMS} />
      </PageSection>

      {loading ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : items.length === 0 ? (
        <EmptyState icon="🎓" title="No training requests" />
      ) : (
        items.map((item) => (
          <Card key={item._id}>
            <CardTitle
              title={item.schoolCode ? `${item.schoolName} (${item.schoolCode})` : item.schoolName}
              subtitle={item.zone || undefined}
              badge={item.status}
              tone={item.status === 'Approved' ? 'success' : item.status === 'Rejected' ? 'error' : 'warning'}
            />
            <InfoRow label="Requested by" value={personName(item.requestedBy)} />
            <InfoRow label="Subject" value={item.subject} />
            <InfoRow label="Preferred date" value={fmtDate(item.preferredDate)} />
            <InfoRow
              label={item.status === 'Rejected' ? 'Reason' : 'Remarks'}
              value={item.status === 'Rejected' ? item.rejectionReason || '—' : item.remarks || '—'}
            />
            {item.status === 'Pending' ? (
              <ActionRow>
                <View style={{ flex: 1 }}>
                  <WebButton title="Approve" variant="success" onPress={() => approve(item._id)} disabled={acting} />
                </View>
                <View style={{ flex: 1 }}>
                  <WebButton
                    title="Reject"
                    variant="destructive"
                    disabled={acting}
                    onPress={() => {
                      setRejectId(item._id);
                      setRejectionReason('');
                      setRejectError('');
                    }}
                  />
                </View>
              </ActionRow>
            ) : null}
          </Card>
        ))
      )}

      <Modal visible={Boolean(rejectId)} transparent animationType="fade" onRequestClose={() => setRejectId(null)}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Reject training request</Text>
            <WebLabel>Reason *</WebLabel>
            <WebInput
              value={rejectionReason}
              onChangeText={(v) => {
                setRejectionReason(v);
                if (rejectError) setRejectError('');
              }}
              multiline
              numberOfLines={3}
              style={styles.textarea}
            />
            {rejectError ? <Text style={styles.errorText}>{rejectError}</Text> : null}
            <View style={styles.actions}>
              <View style={{ flex: 1 }}>
                <WebButton title="Cancel" variant="outline" onPress={() => setRejectId(null)} />
              </View>
              <View style={{ flex: 1 }}>
                <WebButton
                  title={acting ? 'Rejecting…' : 'Reject'}
                  variant="destructive"
                  disabled={acting}
                  onPress={confirmReject}
                />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  empty: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.lg },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', padding: spacing.md },
  dialog: { backgroundColor: colors.backgroundLight, borderRadius: 14, padding: spacing.md },
  dialogTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  errorText: { color: colors.error, fontSize: 13, marginTop: -4, marginBottom: 4 },
});
