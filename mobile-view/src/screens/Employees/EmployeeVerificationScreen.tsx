import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radii } from '../../theme/colors';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';
import { ExpenseBillModal } from '../../components/expenses/ExpenseBillViewer';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

type Approval = {
  roleKey: string;
  status: string;
  note?: string;
  at?: string;
  userId?: { name?: string; role?: string } | string | null;
};

type Employee = {
  _id: string;
  empCode?: string;
  name: string;
  email: string;
  phone?: string;
  mobile?: string;
  department?: string;
  designation?: string;
  dateOfBirth?: string;
  dateOfJoining?: string;
  role: string;
  zone?: string;
  cluster?: string;
  temporaryAddress?: string;
  permanentAddress?: string;
  aadhaarUrl?: string;
  locationPhotoUrl?: string;
  passportPhotoUrl?: string;
  references?: { relation: string; name?: string; mobile: string; aadhaarUrl?: string }[];
  verificationStatus?: string;
  isActive?: boolean;
  approvals?: Approval[];
  executiveManagerId?: { name?: string } | string | null;
  verticalManagerId?: { name?: string } | string | null;
  onboardingChecklist?: string[];
  onboardingOtherNote?: string;
  hasEmployeeRelationship?: boolean | null;
  employeeRelationshipDetails?: { fullName?: string; relationship?: string; department?: string; designation?: string };
};

type ViewMode = 'all' | 'pending' | 'approved' | 'rejected';

const APPROVAL_LABELS: Record<string, string> = {
  admin: 'Admin',
  hr_manager: 'HR Manager',
  zonal_manager: 'Zonal Manager',
  training_head: 'Training Head',
  vertical_manager: 'Product Head',
};

const ROLE_NAMES: Record<string, string> = {
  'Executive Manager': 'Zonal Manager',
  Manager: 'Product Manager',
  Executive: 'BDE',
  'Sales BDE': 'BDE',
  Employee: 'BDE',
};

function formatEmployeeCode(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  const withoutPrefix = raw.replace(/^VESPL/i, '');
  return `VESPL${/^\d+$/.test(withoutPrefix) ? withoutPrefix.padStart(4, '0') : withoutPrefix}`;
}

const formatDate = (d?: string) => (d ? new Date(d).toLocaleDateString('en-IN') : '—');

/** Web: app/dashboard/employees/verification/page.tsx */
export default function EmployeeVerificationScreen() {
  const { user } = useAuth();
  const role = user?.role || '';
  const isHrManager = role === 'HR Manager';
  const isHr = isHrManager || role === 'HR Executive';
  const isAdmin = role === 'Admin' || role === 'Super Admin';

  const [list, setList] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>(isHr ? 'all' : 'pending');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [viewer, setViewer] = useState<{ url: string; title: string } | null>(null);

  const canActOn = (employee: Employee, roleKey: string) => {
    // HR Manager can approve before or after the Vertical Head; both are needed to activate.
    if (employee.verificationStatus === 'rejected') return false;
    if (isAdmin) return true;
    if (isHrManager) return roleKey === 'hr_manager';
    if (role === 'Executive Manager') return roleKey === 'zonal_manager';
    if (role === 'Manager') return ['vertical_manager', 'training_head'].includes(roleKey);
    return false;
  };

  const approvalStatusLabel = (employee: Employee) => {
    if (employee.verificationStatus === 'approved' || (!employee.verificationStatus && employee.isActive)) return 'Approved';
    if (employee.verificationStatus === 'rejected') return 'Rejected';
    const approvals = employee.approvals || [];
    const heads = approvals.filter((a) => a.roleKey !== 'hr_manager');
    const headPending = heads.length === 0 || heads.some((a) => a.status === 'pending');
    const hrPending = approvals.some((a) => a.roleKey === 'hr_manager' && a.status === 'pending');
    if (headPending && hrPending) return 'Pending — Vertical Head and HR Manager';
    if (headPending) return 'Pending — Vertical Head';
    if (hrPending) return 'Pending — HR Manager';
    return 'Pending';
  };

  const load = useCallback(async () => {
    try {
      const data = await apiService.get(`/employees/verification/pending?status=${view}`);
      setList(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.response?.data?.message || e?.message || `Failed to load ${view} employees` });
      setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [view]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const decide = async (employeeId: string, roleKey: string, decision: 'approve' | 'reject') => {
    setMessage(null);
    if (decision === 'reject' && !String(notes[employeeId] || '').trim()) {
      setMessage({ type: 'error', text: 'A rejection note is required' });
      return;
    }
    setActing(`${employeeId}-${roleKey}-${decision}`);
    try {
      await apiService.post(`/employees/${employeeId}/approvals`, { roleKey, decision, note: notes[employeeId] || '' });
      setMessage({ type: 'success', text: decision === 'approve' ? 'Approved' : 'Rejected' });
      load();
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.message || 'Action failed' });
    } finally {
      setActing(null);
    }
  };

  const UploadLink = ({ url, title }: { url?: string; title: string }) =>
    url ? (
      <TouchableOpacity onPress={() => setViewer({ url, title })}>
        <Text style={styles.link}>View upload</Text>
      </TouchableOpacity>
    ) : (
      <Text style={styles.value}>—</Text>
    );

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {typeof children === 'string' ? <Text style={styles.value}>{children}</Text> : children}
    </View>
  );

  const emptyText =
    view === 'rejected'
      ? 'No rejected employee applications.'
      : view === 'approved'
        ? 'No approved employee applications.'
        : view === 'all'
          ? 'No employees found.'
          : isHr
            ? 'No pending employee applications.'
            : 'No employees pending verification.';

  return (
    <ScreenShell
      title={isHr ? 'Employee Approval Status' : 'Employee Verification'}
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      <Text style={styles.intro}>
        {isHr
          ? 'The respective Vertical Head completes background verification first. HR can view the status throughout, and the HR Manager receives final approval access only after the head approves.'
          : 'Review the employee’s complete details and background information. After your approval, the request is routed to the HR Manager for final approval.'}
      </Text>

      {isAdmin || isHr ? (
        <View style={styles.tabRow}>
          {(
            [
              ['all', 'All employees'],
              ['pending', 'Pending approvals'],
              ['rejected', 'Rejected'],
              ['approved', 'Approved'],
            ] as [ViewMode, string][]
          ).map(([v, label]) => (
            <TouchableOpacity key={v} style={[styles.tabBtn, view === v && styles.tabBtnActive]} onPress={() => setView(v)}>
              <Text style={[styles.tabText, view === v && styles.tabTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {message ? <MessageBanner type={message.type} message={message.text} onDismiss={() => setMessage(null)} /> : null}

      {list.length === 0 ? (
        <Text style={styles.empty}>{emptyText}</Text>
      ) : (
        list.map((emp) => {
          const statusLabel = approvalStatusLabel(emp);
          const badge =
            emp.verificationStatus === 'approved'
              ? { bg: '#D1FAE5', text: '#065F46' }
              : emp.verificationStatus === 'rejected'
                ? { bg: '#FEE2E2', text: '#991B1B' }
                : { bg: '#FEF3C7', text: '#92400E' };
          const canActAny = (emp.approvals || []).some((a) => a.status === 'pending' && canActOn(emp, a.roleKey));
          return (
            <View key={emp._id} style={styles.card}>
              <Text style={styles.name}>{emp.empCode ? `${formatEmployeeCode(emp.empCode)} · ${emp.name}` : emp.name}</Text>
              <Text style={styles.meta}>
                {ROLE_NAMES[emp.role] || emp.role} · {emp.email}
                {emp.zone ? ` · Zone: ${emp.zone}` : ''}
                {emp.cluster ? ` · Cluster: ${emp.cluster}` : ''}
              </Text>
              <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.badgeText, { color: badge.text }]}>{statusLabel}</Text>
              </View>

              <Field label="Official company number">{emp.phone || '—'}</Field>
              <Field label="Personal mobile">{emp.mobile || '—'}</Field>
              <Field label="Department / Designation">{[emp.department, emp.designation].filter(Boolean).join(' · ') || '—'}</Field>
              <Field label="Joining date">{formatDate(emp.dateOfJoining)}</Field>
              <Field label="Date of birth">{formatDate(emp.dateOfBirth)}</Field>
              <Field label="Assigned Zonal Manager">
                {typeof emp.executiveManagerId === 'object' ? emp.executiveManagerId?.name || '—' : '—'}
              </Field>
              <Field label="Assigned Product Head">
                {typeof emp.verticalManagerId === 'object' ? emp.verticalManagerId?.name || '—' : '—'}
              </Field>
              <Field label="Temporary address">{emp.temporaryAddress || '—'}</Field>
              <Field label="Permanent address">{emp.permanentAddress || '—'}</Field>
              <Field label="Aadhaar">
                <UploadLink url={emp.aadhaarUrl} title="Aadhaar" />
              </Field>
              <Field label="Location">
                <UploadLink url={emp.locationPhotoUrl} title="Location" />
              </Field>
              <Field label="Passport photo">
                <UploadLink url={emp.passportPhotoUrl} title="Passport photo" />
              </Field>
              <Field label="Onboarding checklist">
                {(emp.onboardingChecklist?.length ? emp.onboardingChecklist.join(', ') : '—') +
                  (emp.onboardingOtherNote ? ` (Other: ${emp.onboardingOtherNote})` : '')}
              </Field>
              <Field label="Employee relationship declaration">
                {(emp.hasEmployeeRelationship === true ? 'Yes' : emp.hasEmployeeRelationship === false ? 'No' : '—') +
                  (emp.hasEmployeeRelationship && emp.employeeRelationshipDetails
                    ? ` — ${[
                        emp.employeeRelationshipDetails.fullName,
                        emp.employeeRelationshipDetails.relationship,
                        emp.employeeRelationshipDetails.department,
                        emp.employeeRelationshipDetails.designation,
                      ]
                        .filter(Boolean)
                        .join(' · ')}`
                    : '')}
              </Field>

              {emp.references && emp.references.length > 0 ? (
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>References</Text>
                  {emp.references.map((r, i) => (
                    <View key={i} style={styles.refRow}>
                      <Text style={styles.value}>
                        {r.relation}
                        {r.name ? ` — ${r.name}` : ''} — {r.mobile}
                      </Text>
                      {r.aadhaarUrl ? (
                        <TouchableOpacity onPress={() => setViewer({ url: r.aadhaarUrl!, title: `Reference ${i + 1} Aadhaar` })}>
                          <Text style={styles.link}>View Aadhaar</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}

              <Text style={[styles.fieldLabel, { marginTop: 8 }]}>Approvals</Text>
              {(emp.approvals || []).map((a) => {
                const actionable = a.status === 'pending' && canActOn(emp, a.roleKey);
                return (
                  <View
                    key={a.roleKey}
                    style={[styles.approvalRow, a.roleKey === 'hr_manager' && a.status === 'pending' && styles.approvalRowHighlight]}
                  >
                    <Text style={styles.value}>
                      <Text style={{ fontWeight: '600' }}>{APPROVAL_LABELS[a.roleKey] || a.roleKey}</Text>
                      <Text style={styles.meta}> ({a.status})</Text>
                    </Text>
                    {a.note ? <Text style={styles.reason}>Reason: {a.note}</Text> : null}
                    {a.status === 'rejected' && typeof a.userId === 'object' && a.userId?.name ? (
                      <Text style={styles.meta}>
                        Rejected by {a.userId.name}
                        {a.at ? ` on ${new Date(a.at).toLocaleString()}` : ''}
                      </Text>
                    ) : null}
                    {actionable ? (
                      <View style={styles.actionRow}>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.approveBtn]}
                          disabled={acting !== null}
                          onPress={() => decide(emp._id, a.roleKey, 'approve')}
                        >
                          <Text style={styles.actionText}>Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.rejectBtn]}
                          disabled={acting !== null}
                          onPress={() => decide(emp._id, a.roleKey, 'reject')}
                        >
                          <Text style={[styles.actionText, { color: colors.error }]}>Reject</Text>
                        </TouchableOpacity>
                      </View>
                    ) : isHr && a.status === 'pending' ? (
                      <Text style={styles.meta}>View only — action assigned to {APPROVAL_LABELS[a.roleKey] || a.roleKey}</Text>
                    ) : null}
                  </View>
                );
              })}

              {canActAny ? (
                <WebInput
                  value={notes[emp._id] || ''}
                  onChangeText={(t) => setNotes((n) => ({ ...n, [emp._id]: t }))}
                  placeholder="Approval note (required when rejecting)"
                  multiline
                  style={{ minHeight: 60, textAlignVertical: 'top', marginTop: 8 }}
                />
              ) : null}
            </View>
          );
        })
      )}

      <ExpenseBillModal url={viewer?.url} title={viewer?.title} visible={!!viewer} onClose={() => setViewer(null)} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: 12 },
  tabRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  tabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundLight,
  },
  tabBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  tabTextActive: { color: colors.primaryForeground },
  empty: { textAlign: 'center', color: colors.textSecondary, paddingVertical: 32 },
  card: {
    backgroundColor: colors.backgroundMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 14,
    marginBottom: 12,
  },
  name: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  meta: { fontSize: 12, color: colors.textSecondary },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.sm, marginVertical: 8 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  field: { marginBottom: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.textPrimary },
  value: { fontSize: 13, color: colors.textSecondary },
  link: { fontSize: 13, color: colors.primary, textDecorationLine: 'underline' },
  refRow: { marginBottom: 4 },
  approvalRow: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 10,
    marginTop: 6,
    gap: 4,
  },
  approvalRowHighlight: { borderColor: '#FCD34D' },
  reason: { fontSize: 13, color: '#B91C1C' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn: { flex: 1, paddingVertical: 8, borderRadius: radii.md, alignItems: 'center' },
  approveBtn: { backgroundColor: colors.primary },
  rejectBtn: { backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.error },
  actionText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});
