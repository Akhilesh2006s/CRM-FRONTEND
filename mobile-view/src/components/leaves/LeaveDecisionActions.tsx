import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { colors } from '../../theme/colors';
import { WebInput, WebButton } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { showAlert } from '../../utils/showAlert';
import {
  type LeaveApprovalFields,
  decisionRoleText,
  showOverride,
  waitingText,
} from '../../lib/leaveApproval';
import { ApproveWithChangesButton, LeaveHistoryButton } from './LeaveFinalApproverTools';

/**
 * Approve / Reject / Approve-all (override) controls for one leave, via PUT /leaves/:id/approve.
 * Renders the "waiting for ..." text when the viewer cannot decide.
 */
export default function LeaveDecisionActions({
  leave,
  isOwn = false,
  onDone,
}: {
  leave: LeaveApprovalFields & {
    _id: string;
    startDate?: string;
    endDate?: string;
    dayType?: string;
    days?: number;
    employeeId?: any;
  };
  isOwn?: boolean;
  onDone: () => void;
}) {
  const [acting, setActing] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');

  const employeeId = typeof leave.employeeId === 'object' && leave.employeeId ? leave.employeeId._id : leave.employeeId;
  const history =
    leave.canViewHistory && employeeId ? (
      <LeaveHistoryButton employeeId={String(employeeId)} name={leave.employeeId?.name} />
    ) : null;
  if (leave.status !== 'Pending') return history;
  if (!leave.canDecide)
    return (
      <View style={styles.root}>
        <Text style={styles.waiting}>{waitingText(leave, isOwn)}</Text>
        {history}
      </View>
    );

  const approve = async (override = false) => {
    setActing(true);
    try {
      const updated: any = await apiService.put(`/leaves/${leave._id}/approve`, { status: 'Approved', override });
      showAlert(
        'Success',
        updated?.status === 'Approved'
          ? 'Leave approved by all approvers.'
          : `Your approval is recorded. ${updated?.approvalSummary || ''}`.trim()
      );
      onDone();
    } catch (e: any) {
      showAlert('Error', e?.message || 'Failed to approve leave');
    } finally {
      setActing(false);
    }
  };

  const confirmReject = async () => {
    const r = reason.trim();
    if (!r) {
      showAlert('Error', 'Rejection reason is required');
      return;
    }
    setActing(true);
    try {
      await apiService.put(`/leaves/${leave._id}/approve`, { status: 'Rejected', rejectionReason: r });
      showAlert('Success', 'Leave rejected — employee will see the reason in My Leaves');
      setRejectOpen(false);
      setReason('');
      onDone();
    } catch (e: any) {
      showAlert('Error', e?.message || 'Failed to reject leave');
    } finally {
      setActing(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.roleText}>{decisionRoleText(leave)}</Text>
      <View style={styles.row}>
        <TouchableOpacity style={[styles.btn, styles.approve]} disabled={acting} onPress={() => approve(false)}>
          <Text style={styles.btnText}>Approve</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.reject]} disabled={acting} onPress={() => setRejectOpen(true)}>
          <Text style={styles.btnText}>Reject</Text>
        </TouchableOpacity>
      </View>
      {leave.canChangeDates && leave.startDate && leave.endDate ? (
        <ApproveWithChangesButton
          leave={{ _id: leave._id, startDate: leave.startDate, endDate: leave.endDate, dayType: leave.dayType, days: leave.days }}
          disabled={acting}
          onDone={onDone}
        />
      ) : null}
      {showOverride(leave) ? (
        <TouchableOpacity style={[styles.btn, styles.override]} disabled={acting} onPress={() => approve(true)}>
          <Text style={styles.overrideText}>Approve all (override)</Text>
        </TouchableOpacity>
      ) : null}

      {history}

      <Modal visible={rejectOpen} transparent animationType="slide" onRequestClose={() => setRejectOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Reject leave request</Text>
            <Text style={styles.sheetDesc}>A rejection reason is required. The employee will see it in My Leaves.</Text>
            <WebInput
              value={reason}
              onChangeText={setReason}
              placeholder="Enter reason for rejection"
              multiline
              style={{ minHeight: 80, textAlignVertical: 'top' }}
            />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <WebButton title="Cancel" variant="outline" onPress={() => setRejectOpen(false)} disabled={acting} />
              </View>
              <View style={{ flex: 1 }}>
                <WebButton
                  title={acting ? 'Rejecting…' : 'Reject leave'}
                  variant="destructive"
                  onPress={confirmReject}
                  disabled={acting || !reason.trim()}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  waiting: { fontSize: 13, color: colors.textTertiary },
  roleText: { fontSize: 13, color: colors.textTertiary },
  row: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, minHeight: 44, justifyContent: 'center', borderRadius: 10, alignItems: 'center' },
  approve: { backgroundColor: colors.success },
  reject: { backgroundColor: colors.error },
  override: { borderWidth: 1, borderColor: '#DCE3EC', backgroundColor: colors.backgroundLight, flex: 0 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  overrideText: { color: colors.textPrimary, fontWeight: '600', fontSize: 14 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.backgroundLight,
    padding: 16,
    paddingBottom: 24,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    gap: 8,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  sheetDesc: { fontSize: 13, color: colors.textSecondary, marginBottom: 4 },
});
