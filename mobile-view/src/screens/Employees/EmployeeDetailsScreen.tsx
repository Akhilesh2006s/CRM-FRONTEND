import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell from '../../ui/ScreenShell';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { employeeDateText, employeeDocName, openEmployeeDoc } from '../../utils/employeeDocs';

type Named = { _id: string; name?: string; role?: string };
type Product = { _id: string; productName: string };

const ROLE_LABELS: Record<string, string> = { Executive: 'BDE', Manager: 'Product Manager', 'Executive Manager': 'Zonal Manager' };
const roleLabel = (role?: string) => (role ? ROLE_LABELS[role] || role : '');
const idOf = (value: any) => String(value?._id || value || '');
const rupees = (value: unknown) =>
  Number(value) > 0 ? `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '';
const yesNo = (value: unknown) => (value === true ? 'Yes' : value === false ? 'No' : '');

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  const text = String(value ?? '').trim();
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, !text && styles.rowEmpty]}>{text || '—'}</Text>
    </View>
  );
}

function DocRow({ label, url }: { label: string; url?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {url ? (
        <TouchableOpacity style={styles.docLinkWrap} onPress={() => openEmployeeDoc(url)}>
          <Text style={styles.docLink} numberOfLines={1}>
            View ({employeeDocName(url)})
          </Text>
        </TouchableOpacity>
      ) : (
        <Text style={[styles.rowValue, styles.rowEmpty]}>—</Text>
      )}
    </View>
  );
}

/** Every detail entered when the employee was created (web: components/employees/EmployeeDetailsView.tsx). */
export default function EmployeeDetailsScreen({ navigation, route }: any) {
  const id: string = String(route?.params?.id || '');
  const { user } = useAuth();
  const [employee, setEmployee] = useState<Record<string, any> | null>(null);
  const [people, setPeople] = useState<Named[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [emp, list, prods] = await Promise.all([
        apiService.get(`/employees/${id}`),
        apiService.get('/employees?isActive=true').catch(() => []),
        apiService.get('/products/active').catch(() => []),
      ]);
      setEmployee(emp || null);
      setPeople(Array.isArray(list) ? list : []);
      setProducts(Array.isArray(prods) ? prods : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load employee');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const canEdit = !['HR Executive', 'Coordinator', 'Senior Coordinator'].includes(user?.role || '');
  const e = employee || {};
  const personName = (value: any) => {
    const pid = idOf(value);
    if (!pid) return '';
    if (value && typeof value === 'object' && value.name) return String(value.name);
    const found = people.find((p) => p._id === pid);
    return found ? `${found.name}${found.role ? ` (${roleLabel(found.role)})` : ''}` : 'Employee not in the active list';
  };
  const productName = (value: any) => products.find((p) => p._id === idOf(value))?.productName || 'Product';
  const zones: string[] = Array.isArray(e.zones) && e.zones.length ? e.zones : e.zone ? [e.zone] : [];
  const refs: any[] = Array.isArray(e.references) ? e.references : [];
  const rel = e.employeeRelationshipDetails || {};
  const bank = e.bankDetails || {};
  const ctc = Number(e.yearlySalary) || 0;
  const list = (items: any) => (Array.isArray(items) ? items.filter(Boolean).join(', ') : '');

  return (
    <ScreenShell title={e.name || 'Employee details'} loading={loading} refreshing={false} onRefresh={load}>
      <View style={styles.content}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {employee ? (
          <>
            {canEdit ? (
              <TouchableOpacity style={styles.editButton} onPress={() => navigation.navigate('EmployeeEdit', { id })}>
                <Text style={styles.editButtonText}>Edit employee</Text>
              </TouchableOpacity>
            ) : null}

            <Section title="Personal details">
              <Row label="Full name" value={e.name} />
              <Row label="First name" value={e.firstName} />
              <Row label="Last name" value={e.lastName} />
              <Row label="Employee code" value={e.empCode} />
              <Row label="Email" value={e.email} />
              <Row label="Date of birth" value={employeeDateText(e.dateOfBirth)} />
              <Row label="Date of joining" value={employeeDateText(e.dateOfJoining)} />
              <Row label="Status" value={e.isActive === false ? 'Inactive' : 'Active'} />
            </Section>

            <Section title="Contact">
              <Row label="Company contact number" value={e.phone && e.phone !== '0' ? e.phone : ''} />
              <Row label="Personal mobile" value={e.mobile} />
            </Section>

            <Section title="Emergency contacts / references">
              {refs.length === 0 ? <Row label="References" value="" /> : null}
              {refs.map((r, i) => (
                <View key={i} style={styles.subCard}>
                  <Text style={styles.subTitle}>Reference {i + 1}</Text>
                  <Row label="Relationship" value={r?.relation} />
                  <Row label="Name" value={r?.name} />
                  <Row label="Mobile" value={r?.mobile} />
                  <DocRow label="Aadhaar" url={r?.aadhaarUrl} />
                </View>
              ))}
            </Section>

            <Section title="Relatives / friends in the company">
              <Row label="Declared a connection" value={yesNo(e.hasEmployeeRelationship)} />
              {e.hasEmployeeRelationship === true ? (
                <>
                  <Row label="Full name" value={rel.fullName} />
                  <Row label="Relationship" value={rel.relationship} />
                  <Row label="Department" value={rel.department} />
                  <Row label="Designation" value={rel.designation} />
                </>
              ) : null}
            </Section>

            <Section title="Addresses">
              <Row label="Permanent address" value={e.permanentAddress} />
              <Row label="Temporary address" value={e.temporaryAddress || e.address1} />
              <Row label="Pincode" value={e.pincode} />
              <Row label="City" value={e.city} />
              <Row label="District" value={e.district} />
              <Row label="State" value={e.state} />
            </Section>

            <Section title="Work">
              <Row label="User type / role" value={roleLabel(e.role)} />
              <Row label="Designation" value={e.designation} />
              <Row label="Department" value={e.department} />
              <Row label={zones.length > 1 ? 'Zones' : 'Zone'} value={zones.join(', ')} />
              <Row label="Cluster" value={e.cluster} />
              <Row label="Reporting manager" value={personName(e.executiveManagerId)} />
              {e.role === 'Trainer' ? (
                <>
                  <Row label="Trainer products" value={list(e.trainerProducts)} />
                  <Row label="Product Head" value={personName(e.verticalManagerId)} />
                </>
              ) : null}
              {e.role === 'Manager' ? (
                <Row label="Assigned products" value={list((e.assignedProductIds || []).map(productName))} />
              ) : null}
              <Row label="Tagged employees" value={list((e.taggedEmployeeIds || []).map(personName))} />
              <Row label="Onboarding checklist" value={list(e.onboardingChecklist)} />
              {e.onboardingOtherNote ? <Row label="Onboarding note" value={e.onboardingOtherNote} /> : null}
            </Section>

            <Section title="Payroll / CTC">
              <Row label="CTC (per year)" value={rupees(ctc)} />
              <Row label="CTC per month" value={ctc > 0 ? rupees(Math.round(ctc / 12)) : ''} />
              <Row label="Monthly take-home" value={rupees(e.monthlyTakeHome)} />
              <Row label="UAN (PF)" value={e.uanNumber} />
              <Row label="ESI number" value={e.esiNumber} />
              <Row label="PF applicable" value={yesNo(typeof e.pfApplicable === 'boolean' ? e.pfApplicable : Boolean(e.uanNumber))} />
              <Row label="ESI applicable" value={yesNo(typeof e.esiApplicable === 'boolean' ? e.esiApplicable : Boolean(e.esiNumber))} />
              <Row label="Professional tax" value={yesNo(e.ptApplicable !== false)} />
              <Row label="Monthly TDS" value={rupees(e.monthlyTds)} />
            </Section>

            <Section title="Bank details">
              <Row label="Account holder" value={bank.accountHolderName} />
              <Row label="Account number" value={bank.accountNumber} />
              <Row label="IFSC" value={bank.ifsc} />
              <Row label="Bank name" value={bank.bankName} />
              <Row label="Branch" value={bank.branch} />
              <DocRow label="Passbook / cheque" url={e.bankPassbookUrl} />
            </Section>

            <Section title="Documents">
              <DocRow label="Aadhaar" url={e.aadhaarUrl} />
              <DocRow label="Location" url={e.locationPhotoUrl} />
              <DocRow label="Passport size photo" url={e.passportPhotoUrl} />
              <DocRow label="Bank passbook" url={e.bankPassbookUrl} />
              {refs.map((r, i) => (
                <DocRow key={i} label={`Reference ${i + 1} Aadhaar`} url={r?.aadhaarUrl} />
              ))}
            </Section>

            {e.offboardingStatus ? (
              <Section title="Offboarding">
                <Row label="Status" value={e.offboardingStatus} />
                <Row label="Checklist" value={list(e.offboardingChecklist)} />
              </Section>
            ) : null}

            <Section title="Record">
              <Row label="Added on" value={employeeDateText(e.createdAt)} />
              <Row label="Last updated" value={employeeDateText(e.updatedAt)} />
            </Section>
          </>
        ) : null}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  error: { color: colors.error, marginBottom: 12 },
  editButton: { alignSelf: 'flex-start', backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 12 },
  editButtonText: { ...typography.label.medium, color: colors.textLight, fontWeight: '600' },
  section: { backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, marginBottom: 12 },
  sectionTitle: { ...typography.label.medium, color: colors.textPrimary, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, paddingVertical: 5 },
  rowLabel: { ...typography.body.small, color: colors.textMuted, flexShrink: 0, maxWidth: '45%' },
  rowValue: { ...typography.body.medium, color: colors.textPrimary, flex: 1, textAlign: 'right' },
  rowEmpty: { color: colors.textMuted },
  docLinkWrap: { flex: 1, alignItems: 'flex-end' },
  docLink: { ...typography.body.medium, color: colors.primary, textDecorationLine: 'underline' },
  subCard: { borderWidth: 1, borderColor: colors.borderLight, backgroundColor: colors.backgroundMuted, borderRadius: 10, padding: 10, marginBottom: 8 },
  subTitle: { ...typography.label.small, color: colors.textSecondary, fontWeight: '600', marginBottom: 4 },
});
