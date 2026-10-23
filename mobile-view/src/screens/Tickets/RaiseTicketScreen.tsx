/**
 * Raise Ticket — web app/dashboard/complaints/raise/page.tsx.
 * Any employee can raise a ticket for coordinator review and see their own tickets.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors } from '../../theme/colors';
import { apiService } from '../../services/api';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebLabel } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';
import { fmtTicketDate, ticketStatusLabel, type Ticket } from './ticketHelpers';

const emptyForm = { subject: '', description: '', schoolName: '', schoolCode: '' };

export default function RaiseTicketScreen() {
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiService.get('/complaints/my');
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.message || 'Failed to load tickets' });
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onSubmit = async () => {
    setMessage(null);
    if (!form.subject.trim() || !form.description.trim()) {
      setMessage({ type: 'error', text: 'Subject and description are required' });
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, string> = { subject: form.subject.trim(), description: form.description.trim() };
      if (form.schoolName.trim()) payload.schoolName = form.schoolName.trim();
      if (form.schoolCode.trim()) payload.schoolCode = form.schoolCode.trim();
      await apiService.post('/complaints', payload);
      setMessage({ type: 'success', text: 'Ticket sent to the coordinator' });
      setForm(emptyForm);
      load();
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.message || 'Failed to send ticket' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenShell
      title="Raise Ticket"
      subtitle="Any employee can raise a ticket for coordinator review."
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      {message ? <MessageBanner type={message.type} message={message.text} onDismiss={() => setMessage(null)} /> : null}

      <PageSection title="New ticket">
        <WebLabel>Subject *</WebLabel>
        <WebInput value={form.subject} onChangeText={(t) => setForm((f) => ({ ...f, subject: t }))} placeholder="Subject" />
        <WebLabel>School name</WebLabel>
        <WebInput value={form.schoolName} onChangeText={(t) => setForm((f) => ({ ...f, schoolName: t }))} placeholder="School name (optional)" />
        <WebLabel>School code</WebLabel>
        <WebInput value={form.schoolCode} onChangeText={(t) => setForm((f) => ({ ...f, schoolCode: t }))} placeholder="School code (optional)" />
        <WebLabel>Description *</WebLabel>
        <WebInput
          value={form.description}
          onChangeText={(t) => setForm((f) => ({ ...f, description: t }))}
          placeholder="Describe the issue"
          multiline
          numberOfLines={4}
          style={styles.textArea}
        />
        <WebButton title={submitting ? 'Sending…' : 'Send to coordinator'} onPress={onSubmit} disabled={submitting} loading={submitting} />
      </PageSection>

      <PageSection title="My tickets">
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : items.length === 0 ? (
          <Text style={styles.empty}>No tickets yet</Text>
        ) : (
          items.map((item) => {
            const solved = item.status === 'Resolved';
            return (
              <View key={item._id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.subject}>{item.subject}</Text>
                  <View style={[styles.badge, solved ? styles.badgeSolved : styles.badgePending]}>
                    <Text style={[styles.badgeText, { color: solved ? colors.success : colors.warning }]}>
                      {ticketStatusLabel(item.status)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.desc}>{item.description}</Text>
                {item.resolutionNote ? <Text style={styles.note}>Note: {item.resolutionNote}</Text> : null}
                <Text style={styles.meta}>
                  {item.schoolName || '—'} · Raised {fmtTicketDate(item.createdAt)}
                </Text>
              </View>
            );
          })
        )}
      </PageSection>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  empty: { textAlign: 'center', color: colors.textSecondary, paddingVertical: 12 },
  card: { backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, marginBottom: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  subject: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeSolved: { backgroundColor: colors.successLight },
  badgePending: { backgroundColor: colors.warningLight },
  badgeText: { fontSize: 12, fontWeight: '600' },
  desc: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  note: { fontSize: 12, color: colors.textTertiary, marginTop: 4 },
  meta: { fontSize: 12, color: colors.textTertiary, marginTop: 6 },
});
