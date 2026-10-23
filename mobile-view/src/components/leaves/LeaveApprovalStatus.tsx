import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import {
  type LeaveApprovalFields,
  decisionText,
  leaveStatusColors,
  slotLabel,
} from '../../lib/leaveApproval';

/**
 * Dual-approval status for a leave: overall badge, a one-line summary
 * ("Approved by Zonal Manager, pending HR Manager") and each approver's decision.
 * RN port of web components/leaves/LeaveApprovalStatus.tsx.
 */
export default function LeaveApprovalStatus({
  leave,
  compact = false,
  showRejectionReason = false,
}: {
  leave: LeaveApprovalFields;
  compact?: boolean;
  /** Always show the rejection reason for rejected leaves (e.g. the employee's own list). */
  showRejectionReason?: boolean;
}) {
  const approvals = leave.approvals || [];
  const legacy = approvals.some((a) => a.legacy);
  const c = leaveStatusColors(leave.status);
  return (
    <View style={styles.root}>
      <View style={[styles.badge, { backgroundColor: c.bg }]}>
        <Text style={[styles.badgeText, { color: c.text }]}>{leave.status}</Text>
      </View>
      {leave.approvalSummary && leave.approvalSummary !== leave.status ? (
        <Text style={styles.summary}>{leave.approvalSummary}</Text>
      ) : null}
      {!compact && !legacy && approvals.length > 0
        ? approvals.map((a) => (
            <View key={a.slot}>
              <Text style={styles.item}>
                <Text style={styles.itemLabel}>{a.label || slotLabel(a.slot)}: </Text>
                <Text
                  style={{
                    color: a.status === 'Approved' ? '#15803D' : a.status === 'Rejected' ? '#B91C1C' : '#A16207',
                  }}
                >
                  {decisionText(a)}
                </Text>
                {a.override ? <Text style={styles.muted}> (Admin override)</Text> : null}
              </Text>
              {a.remarks ? <Text style={[styles.muted, styles.remarks]}>“{a.remarks}”</Text> : null}
            </View>
          ))
        : null}
      {(legacy || compact || showRejectionReason) && leave.status === 'Rejected' && leave.rejectionReason ? (
        <Text style={styles.muted}>Reason: {leave.rejectionReason}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 3 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  summary: { fontSize: 12, color: colors.textPrimary },
  item: { fontSize: 12, color: colors.textSecondary },
  itemLabel: { fontWeight: '600', color: colors.textSecondary },
  muted: { fontSize: 12, color: colors.textMuted },
  remarks: { paddingLeft: 8 },
});
