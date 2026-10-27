import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api';
import { navigateRoot } from '../navigation/navigationRef';
import { Advance, advanceCurrentAmount, advanceMoney } from '../lib/advance';

const NON_EMPLOYEE_ROLES = ['Vendor', 'Partner', 'Franchise'];

/** Dashboard card: "N advance requests are waiting for your approval" → Advance Approvals. */
export default function PendingAdvanceApprovalsCard() {
  const { user } = useAuth();
  const [waiting, setWaiting] = useState<Advance[]>([]);
  const allowed = !!user && !NON_EMPLOYEE_ROLES.includes(user.role || '') && (user.isSuperAdmin
    || user.role === 'Super Admin' || !!user.permissions?.includes('advance.approvals.page.view'));

  useFocusEffect(useCallback(() => {
    if (!allowed) return undefined;
    let active = true;
    apiService.get('/advances/approvals?status=Pending')
      .then((rows: Advance[]) => { if (active) setWaiting(rows.filter((row) => row.canDecide)); })
      .catch(() => { if (active) setWaiting([]); });
    return () => { active = false; };
  }, [allowed]));

  if (!allowed || waiting.length === 0) return null;
  const total = waiting.reduce((sum, row) => sum + advanceCurrentAmount(row), 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>
        {waiting.length} advance request{waiting.length === 1 ? ' is' : 's are'} waiting for your approval
      </Text>
      <Text style={styles.body}>
        {waiting.slice(0, 3).map((row) => `${row.employeeId?.name || 'Employee'} (${advanceMoney(advanceCurrentAmount(row))})`).join(', ')}
        {waiting.length > 3 ? ` and ${waiting.length - 3} more` : ''} · Total {advanceMoney(total)}
      </Text>
      <TouchableOpacity style={styles.button} onPress={() => navigateRoot('AdvanceApprovals')}>
        <Text style={styles.buttonText}>Review advances</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A', borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12 },
  title: { fontSize: 15, fontWeight: '700', color: '#78350F' },
  body: { fontSize: 13, color: '#92400E', marginTop: 4 },
  button: { alignSelf: 'flex-start', backgroundColor: '#D97706', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, marginTop: 10 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});
