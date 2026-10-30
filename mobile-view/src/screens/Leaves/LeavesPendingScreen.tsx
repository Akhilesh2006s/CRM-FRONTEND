import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, radii } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell from '../../ui/ScreenShell';
import MessageBanner from '../../components/MessageBanner';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { leaveTypeLabel, leaveDayTypeLabel, leaveDayCount, formatLeaveDays } from '../../lib/leaveTypes';
import { type LeaveApprovalFields, sortDecidableFirst } from '../../lib/leaveApproval';
import LeaveApprovalStatus from '../../components/leaves/LeaveApprovalStatus';
import LeaveDecisionActions from '../../components/leaves/LeaveDecisionActions';

type Leave = LeaveApprovalFields & {
  _id: string;
  employeeId: { _id?: string; name?: string; empCode?: string; role?: string } | string | null;
  reason?: string;
  startDate: string;
  endDate: string;
  leaveType?: string;
  dayType?: string;
  halfDaySession?: string | null;
  days?: number;
};

/** Display legacy numeric and current employee codes with the VESPL prefix (web lib/employeeCode.ts). */
function formatEmployeeCode(value?: string | null, fallback = '—') {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  const withoutPrefix = raw.replace(/^VESPL/i, '');
  return `VESPL${/^\d+$/.test(withoutPrefix) ? withoutPrefix.padStart(4, '0') : withoutPrefix}`;
}

const formatDate = (d?: string) => {
  if (!d) return '-';
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export default function LeavesPendingScreen() {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoadError(null);
      const data = await apiService.get('/leaves?status=Pending');
      setLeaves(sortDecidableFirst(Array.isArray(data) ? data : []));
    } catch (error: any) {
      setLoadError(error?.message || 'Failed to load leaves');
      setLeaves([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const isOwnLeave = (l: Leave) => !!l.employeeId && typeof l.employeeId === 'object' && l.employeeId._id === user?._id;

  const employeeName = (l: Leave) =>
    !l.employeeId ? 'Unknown' : typeof l.employeeId === 'string' ? l.employeeId : l.employeeId.name || 'Unknown';

  return (
    <ScreenShell
      title="Pending Leaves"
      subtitle={`Total: ${leaves.length}`}
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        loadData();
      }}
    >
      <Text style={styles.intro}>
        Each leave needs two approvals: BDE — Zonal Manager + HR Manager; Trainer — Product Head + HR Manager; other
        roles — Admin + HR Manager. Any rejection rejects the leave.
      </Text>
      {loadError ? <MessageBanner type="error" message={loadError} onDismiss={() => setLoadError(null)} /> : null}

      {leaves.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No pending leaves</Text>
        </View>
      ) : (
        leaves.map((leave) => (
          <View key={leave._id} style={[styles.card, leave.canDecide && styles.cardActionable]}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.employeeName}>{employeeName(leave)}</Text>
                <Text style={styles.code}>
                  {formatEmployeeCode(typeof leave.employeeId === 'object' && leave.employeeId ? leave.employeeId.empCode : undefined)}
                </Text>
              </View>
              <Text style={styles.leaveType}>
                {leaveTypeLabel(leave.leaveType)} · {leaveDayTypeLabel(leave)} · {formatLeaveDays(leaveDayCount(leave))}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>From:</Text>
              <Text style={styles.infoValue}>{formatDate(leave.startDate)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>To:</Text>
              <Text style={styles.infoValue}>{formatDate(leave.endDate)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Reason:</Text>
              <Text style={styles.infoValue}>{leave.reason || '-'}</Text>
            </View>
            <View style={styles.section}>
              <LeaveApprovalStatus leave={leave} />
            </View>
            <View style={styles.footer}>
              <LeaveDecisionActions leave={leave} isOwn={isOwnLeave(leave)} onDone={loadData} />
            </View>
          </View>
        ))
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: 12 },
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { ...typography.heading.h3, color: colors.textSecondary },
  card: {
    backgroundColor: colors.backgroundLight,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  cardActionable: { borderColor: colors.primaryLight },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 8 },
  employeeName: { ...typography.heading.h3, color: colors.textPrimary },
  code: { fontSize: 12, color: colors.textSecondary },
  leaveType: { ...typography.body.medium, color: colors.textSecondary },
  infoRow: { flexDirection: 'row', marginBottom: 4 },
  infoLabel: { ...typography.body.medium, color: colors.textSecondary, width: 70 },
  infoValue: { ...typography.body.medium, color: colors.textPrimary, flex: 1 },
  section: { marginTop: 8 },
  footer: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
});
