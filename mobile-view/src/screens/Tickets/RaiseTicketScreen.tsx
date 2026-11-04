/**
 * Raise Ticket — web app/dashboard/complaints/raise/page.tsx.
 * Any employee can raise a ticket for coordinator review and see their own tickets.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors } from '../../theme/colors';
import { apiService } from '../../services/api';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebLabel } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';
import { Card, CardTitle, InfoRow, EmptyState } from '../../ui/Kit';
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
      subtitle="Send an issue to the coordinator."
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
          <EmptyState icon="🎫" title="No tickets yet" message="Tickets you raise will show here." />
        ) : (
          items.map((item) => (
            <Card key={item._id} style={styles.card}>
              <CardTitle
                title={item.subject}
                badge={ticketStatusLabel(item.status)}
                tone={item.status === 'Resolved' ? 'success' : 'warning'}
              />
              {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
              <InfoRow label="School" value={item.schoolName || ''} />
              <InfoRow label="Raised on" value={fmtTicketDate(item.createdAt)} />
              <InfoRow label="Note" value={item.resolutionNote || ''} />
            </Card>
          ))
        )}
      </PageSection>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  card: { marginBottom: 8, padding: 12, shadowOpacity: 0, elevation: 0 },
  desc: { fontSize: 14, color: colors.textSecondary, marginBottom: 8, lineHeight: 20 },
});
