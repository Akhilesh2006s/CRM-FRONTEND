import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput } from '../../ui/WebPrimitives';
import { Card, CardTitle, InfoRow, ChipRow, EmptyState, toneFor } from '../../ui/Kit';
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

const formatDate = (d?: string) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');

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
  const [searchQuery, setSearchQuery] = useState('');

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

  const uploadLink = (url: string | undefined, title: string) =>
    url ? (
      <TouchableOpacity onPress={() => setViewer({ url, title })}>
        <Text style={styles.link}>View upload</Text>
      </TouchableOpacity>
    ) : undefined;

  const nameOf = (v: { name?: string } | string | null | undefined) => (v && typeof v === 'object' ? v.name || '' : '');

  const words = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = list.filter((emp) => {
    if (!words.length) return true;
    const text = [
      emp.name,
      emp.empCode ? formatEmployeeCode(emp.empCode) : '',
      emp.email,
      emp.phone,
      emp.mobile,
      emp.role,
      ROLE_NAMES[emp.role],
      emp.department,
      emp.designation,
      emp.zone,
      emp.cluster,
      nameOf(emp.executiveManagerId),
      nameOf(emp.verticalManagerId),
      approvalStatusLabel(emp),
    ]
      .map((v) => String(v || '').toLowerCase())
      .join(' ');
    return words.every((w) => text.includes(w));
  });

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
          ? 'The Vertical Head verifies first; the HR Manager gives final approval after that.'
          : 'Review the details below. After your approval it goes to the HR Manager.'}
      </Text>

      {isAdmin || isHr ? (
        <View style={{ marginTop: -12, marginBottom: 12 }}>
          <ChipRow
            items={[
              { key: 'all', label: 'All employees' },
              { key: 'pending', label: 'Pending approvals' },
              { key: 'rejected', label: 'Rejected' },
              { key: 'approved', label: 'Approved' },
            ]}
            value={view}
            onChange={(k) => setView(k as ViewMode)}
          />
        </View>
      ) : null}

      <WebInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Search name, code, mobile, email, role, zone…" />

      {message ? <MessageBanner type={message.type} message={message.text} onDismiss={() => setMessage(null)} /> : null}

      {filtered.length === 0 ? (
        <EmptyState icon="🪪" title={emptyText} message={searchQuery ? 'Try a different search.' : undefined} />
      ) : (
        filtered.map((emp) => {
          const statusLabel = approvalStatusLabel(emp);
          const canActAny = (emp.approvals || []).some((a) => a.status === 'pending' && canActOn(emp, a.roleKey));
          const checklist =
            (emp.onboardingChecklist?.length ? emp.onboardingChecklist.join(', ') : '') +
            (emp.onboardingOtherNote ? ` (Other: ${emp.onboardingOtherNote})` : '');
          const relation =
            emp.hasEmployeeRelationship === true || emp.hasEmployeeRelationship === false
              ? (emp.hasEmployeeRelationship ? 'Yes' : 'No') +
                (emp.hasEmployeeRelationship && emp.employeeRelationshipDetails
                  ? ` — ${[
                      emp.employeeRelationshipDetails.fullName,
                      emp.employeeRelationshipDetails.relationship,
                      emp.employeeRelationshipDetails.department,
                      emp.employeeRelationshipDetails.designation,
                    ]
                      .filter(Boolean)
                      .join(' · ')}`
                  : '')
              : '';
          return (
            <Card key={emp._id}>
              <CardTitle
                title={emp.name}
                subtitle={[emp.empCode ? formatEmployeeCode(emp.empCode) : '', ROLE_NAMES[emp.role] || emp.role].filter(Boolean).join(' · ')}
                badge={statusLabel}
                tone={toneFor(statusLabel)}
              />

              <InfoRow label="Email" value={emp.email} />
              <InfoRow label="Company no." value={emp.phone} phone />
              <InfoRow label="Personal mobile" value={emp.mobile} phone />
              <InfoRow label="Zone" value={emp.zone} />
              <InfoRow label="Cluster" value={emp.cluster} />
              <InfoRow label="Dept / Desig." value={[emp.department, emp.designation].filter(Boolean).join(' · ')} />
              <InfoRow label="Joining date" value={emp.dateOfJoining ? formatDate(emp.dateOfJoining) : ''} />
              <InfoRow label="Date of birth" value={emp.dateOfBirth ? formatDate(emp.dateOfBirth) : ''} />
              <InfoRow label="Zonal Manager" value={nameOf(emp.executiveManagerId)} />
              <InfoRow label="Product Head" value={nameOf(emp.verticalManagerId)} />
              <InfoRow label="Temp. address" value={emp.temporaryAddress} />
              <InfoRow label="Perm. address" value={emp.permanentAddress} />
              <InfoRow label="Aadhaar" value={uploadLink(emp.aadhaarUrl, 'Aadhaar')} />
              <InfoRow label="Location" value={uploadLink(emp.locationPhotoUrl, 'Location')} />
              <InfoRow label="Passport photo" value={uploadLink(emp.passportPhotoUrl, 'Passport photo')} />
              <InfoRow label="Onboarding" value={checklist} />
              <InfoRow label="Relative in co." value={relation} />

              {emp.references && emp.references.length > 0 ? (
                <View>
                  <Text style={styles.blockTitle}>References</Text>
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

              <Text style={styles.blockTitle}>Approvals</Text>
              {(emp.approvals || []).map((a) => {
                const actionable = a.status === 'pending' && canActOn(emp, a.roleKey);
                return (
                  <View
                    key={a.roleKey}
                    style={[styles.approvalRow, a.roleKey === 'hr_manager' && a.status === 'pending' && styles.approvalRowHighlight]}
                  >
                    <View style={styles.approvalHead}>
                      <Text style={styles.approvalName}>{APPROVAL_LABELS[a.roleKey] || a.roleKey}</Text>
                      <Text
                        style={[
                          styles.approvalStatus,
                          { color: a.status === 'approved' ? colors.success : a.status === 'rejected' ? colors.error : '#B45309' },
                        ]}
                      >
                        {a.status}
                      </Text>
                    </View>
                    {a.note ? <Text style={styles.reason}>Reason: {a.note}</Text> : null}
                    {a.status === 'rejected' && typeof a.userId === 'object' && a.userId?.name ? (
                      <Text style={styles.meta}>
                        Rejected by {a.userId.name}
                        {a.at ? ` on ${new Date(a.at).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}` : ''}
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
                  style={{ minHeight: 64, textAlignVertical: 'top', marginTop: 12, marginBottom: 0 }}
                />
              ) : null}
            </Card>
          );
        })
      )}

      <ExpenseBillModal url={viewer?.url} title={viewer?.title} visible={!!viewer} onClose={() => setViewer(null)} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: 12 },
  meta: { fontSize: 13, color: colors.textTertiary },
  value: { fontSize: 14, color: colors.textPrimary },
  link: { fontSize: 14, color: colors.primaryDark, textDecorationLine: 'underline' },
  blockTitle: { fontSize: 13, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 4 },
  refRow: { paddingVertical: 4 },
  approvalRow: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    gap: 4,
  },
  approvalRowHighlight: { borderColor: '#FCD34D' },
  approvalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  approvalName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  approvalStatus: { fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
  reason: { fontSize: 13, color: '#B91C1C' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  approveBtn: { backgroundColor: colors.success },
  rejectBtn: { backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.error },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
