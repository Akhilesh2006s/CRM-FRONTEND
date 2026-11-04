import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { Card, CardTitle, InfoRow, ActionRow, EmptyState } from '../../ui/Kit';
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
      <View style={styles.intro}>
        <Text style={styles.introText}>
          Each leave needs two approvals: BDE — Zonal Manager + HR Manager; Trainer — Product Head + HR Manager; other
          roles — Admin + HR Manager. Any rejection rejects the leave.
        </Text>
      </View>
      {loadError ? <MessageBanner type="error" message={loadError} onDismiss={() => setLoadError(null)} /> : null}

      {leaves.length === 0 ? (
        <EmptyState icon="✅" title="No pending leaves" message="All caught up." />
      ) : (
        leaves.map((leave) => (
          <Card key={leave._id} style={leave.canDecide ? styles.cardActionable : undefined}>
            <CardTitle
              title={employeeName(leave)}
              subtitle={formatEmployeeCode(typeof leave.employeeId === 'object' && leave.employeeId ? leave.employeeId.empCode : undefined)}
              badge={leave.canDecide ? 'Your action' : 'Pending'}
              tone={leave.canDecide ? 'info' : 'warning'}
            />
            <InfoRow label="Leave" value={`${leaveTypeLabel(leave.leaveType)} · ${leaveDayTypeLabel(leave)}`} />
            <InfoRow label="Days" value={formatLeaveDays(leaveDayCount(leave))} />
            <InfoRow label="From" value={formatDate(leave.startDate)} />
            <InfoRow label="To" value={formatDate(leave.endDate)} />
            <InfoRow label="Reason" value={leave.reason || '-'} />
            <View style={styles.section}>
              <LeaveApprovalStatus leave={leave} />
            </View>
            <ActionRow>
              <View style={{ flex: 1 }}>
                <LeaveDecisionActions leave={leave} isOwn={isOwnLeave(leave)} onDone={loadData} />
              </View>
            </ActionRow>
          </Card>
        ))
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  intro: { backgroundColor: colors.accent, borderRadius: 12, padding: 12, marginBottom: 12 },
  introText: { fontSize: 13, color: colors.accentForeground, lineHeight: 18 },
  cardActionable: { borderColor: colors.primaryLight },
  section: { marginTop: 8 },
});
