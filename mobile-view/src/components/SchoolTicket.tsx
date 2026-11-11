import React, { useCallback, useEffect, useState } from 'react';
import { Alert, View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { apiService } from '../services/api';
import { colors } from '../theme/colors';
import { Badge } from '../ui/Kit';
import { WebSelect } from '../ui/WebPrimitives';
import { TICKET_PURPOSES, ticketPurposeText } from '../screens/Tickets/ticketHelpers';

type Ticket = {
  _id: string;
  subject: string;
  description: string;
  schoolCode?: string;
  status: 'Open' | 'Resolved';
  resolutionNote?: string;
  createdAt: string;
};

const date = (v?: string) => (v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

/**
 * Raise a ticket for this school from My Clients. School code, name and area / town are filled
 * from the school record; the ticket goes to the coordinators' ticket inbox.
 */
export default function SchoolTicket({ schoolCode, schoolName, town }: { schoolCode?: string; schoolName: string; town?: string }) {
  const [purpose, setPurpose] = useState('');
  const [purposeOther, setPurposeOther] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [tickets, setTickets] = useState<Ticket[] | null>(null);

  const load = useCallback(async () => {
    try {
      const all: Ticket[] = await apiService.get('/complaints/my');
      const code = String(schoolCode || '').toUpperCase();
      setTickets((Array.isArray(all) ? all : []).filter((t) => code && String(t.schoolCode || '').toUpperCase() === code));
    } catch {
      setTickets([]);
    }
  }, [schoolCode]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    const subject = ticketPurposeText(purpose, purposeOther);
    if (!subject || !description.trim()) {
      return Alert.alert('Details needed', purpose === 'Others' && !purposeOther.trim() ? 'Enter the purpose.' : 'Select the purpose and enter the description.');
    }
    setSaving(true);
    try {
      await apiService.post('/complaints', { subject, description: description.trim(), schoolCode, schoolName, town });
      setPurpose('');
      setPurposeOther('');
      setDescription('');
      Alert.alert('Ticket raised', 'Your ticket was sent to the coordinator.');
      await load();
    } catch (e: any) {
      Alert.alert('Could not raise ticket', e?.response?.data?.message || e?.message || 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View>
      <View style={styles.school}>
        <Row label="School code" value={schoolCode || '—'} />
        <Row label="School name" value={schoolName || '—'} />
        <Row label="Area / Town" value={town || '—'} />
      </View>

      <Text style={styles.label}>Purpose *</Text>
      <WebSelect
        value={purpose}
        placeholder="Select purpose"
        onValueChange={(v) => {
          setPurpose(v);
          if (v !== 'Others') setPurposeOther('');
        }}
        items={TICKET_PURPOSES.map((p) => ({ label: p, value: p }))}
      />
      {purpose === 'Others' ? (
        <TextInput
          style={styles.input}
          value={purposeOther}
          onChangeText={setPurposeOther}
          placeholder="Enter the purpose"
          placeholderTextColor={colors.textMuted}
        />
      ) : null}
      <Text style={styles.label}>Description *</Text>
      <TextInput
        style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]}
        value={description}
        onChangeText={setDescription}
        placeholder="Describe the issue"
        placeholderTextColor={colors.textMuted}
        multiline
      />
      <TouchableOpacity style={[styles.submit, saving && { opacity: 0.6 }]} onPress={submit} disabled={saving} activeOpacity={0.85}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Raise Ticket</Text>}
      </TouchableOpacity>

      <Text style={styles.section}>Tickets for this school</Text>
      {tickets === null ? (
        <ActivityIndicator color={colors.primary} />
      ) : tickets.length === 0 ? (
        <Text style={styles.muted}>None yet</Text>
      ) : (
        tickets.map((t) => (
          <View key={t._id} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle}>{t.subject}</Text>
              <Badge label={t.status === 'Resolved' ? 'Solved' : 'Pending'} tone={t.status === 'Resolved' ? 'success' : 'warning'} />
            </View>
            <Text style={styles.muted}>{date(t.createdAt)}</Text>
            {t.description ? <Text style={styles.desc}>{t.description}</Text> : null}
            {t.resolutionNote ? <Text style={styles.desc}>Note: {t.resolutionNote}</Text> : null}
          </View>
        ))
      )}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowKey}>{label}</Text>
      <Text style={styles.rowVal}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  school: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10, marginBottom: 6 },
  row: { flexDirection: 'row', paddingVertical: 3 },
  rowKey: { width: 110, fontSize: 13, color: colors.textTertiary },
  rowVal: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginTop: 10, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#DCE3EC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: '#fff',
  },
  submit: { marginTop: 14, backgroundColor: colors.primaryDark, borderRadius: 10, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  section: { fontSize: 14, fontWeight: '700', color: colors.primary, marginTop: 18, marginBottom: 6 },
  muted: { fontSize: 12, color: colors.textSecondary },
  card: { borderWidth: 1, borderColor: '#EEF2F7', borderRadius: 10, padding: 10, marginTop: 8, backgroundColor: '#fff' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  desc: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
});
