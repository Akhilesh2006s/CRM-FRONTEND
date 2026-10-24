import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { colors, radii, spacing } from '../../theme/colors';
import { apiService } from '../../services/api';
import ScreenShell from '../../ui/ScreenShell';
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
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function statusColors(status?: string) {
  switch (status) {
    case 'Approved':
      return { bg: colors.successLight, fg: colors.success };
    case 'Rejected':
      return { bg: colors.errorLight, fg: colors.error };
    default:
      return { bg: colors.warningLight, fg: colors.warning };
  }
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

      <WebSelect label="Status" value={status} onValueChange={(v) => setStatus(v || 'Pending')} items={STATUS_ITEMS} />

      {loading ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : items.length === 0 ? (
        <Text style={styles.empty}>No training requests</Text>
      ) : (
        items.map((item) => {
          const sc = statusColors(item.status);
          return (
            <View key={item._id} style={styles.card}>
              <View style={styles.cardHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>
                    {item.schoolName}
                    {item.schoolCode ? ` (${item.schoolCode})` : ''}
                  </Text>
                  {item.zone ? <Text style={styles.zone}>{item.zone}</Text> : null}
                </View>
                <View style={[styles.badge, { backgroundColor: sc.bg }]}>
                  <Text style={[styles.badgeText, { color: sc.fg }]}>{item.status}</Text>
                </View>
              </View>
              <Row label="Requested by" value={personName(item.requestedBy)} />
              <Row label="Subject" value={item.subject} />
              <Row label="Preferred date" value={fmtDate(item.preferredDate)} />
              <Row
                label={item.status === 'Rejected' ? 'Reason' : 'Remarks'}
                value={item.status === 'Rejected' ? item.rejectionReason || '—' : item.remarks || '—'}
              />
              {item.status === 'Pending' ? (
                <View style={styles.actions}>
                  <View style={{ flex: 1 }}>
                    <WebButton title="Approve" onPress={() => approve(item._id)} disabled={acting} />
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
                </View>
              ) : null}
            </View>
          );
        })
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.lg },
  card: {
    backgroundColor: colors.backgroundLight,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  zone: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  row: { flexDirection: 'row', paddingVertical: 3, gap: 8 },
  rowLabel: { width: 110, fontSize: 13, color: colors.textTertiary },
  rowValue: { flex: 1, fontSize: 13, color: colors.textPrimary },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', padding: spacing.md },
  dialog: { backgroundColor: colors.backgroundLight, borderRadius: radii.lg, padding: spacing.md },
  dialogTitle: { fontSize: 17, fontWeight: '600', color: colors.textPrimary, marginBottom: 12 },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  errorText: { color: colors.error, fontSize: 13, marginTop: -4, marginBottom: 4 },
});
