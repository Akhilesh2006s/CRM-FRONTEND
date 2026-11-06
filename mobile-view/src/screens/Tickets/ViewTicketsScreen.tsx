/**
 * View Tickets — web components/tickets/TicketsInbox.tsx (All / Solved / Pending).
 * Coordinator inbox (Admin, Super Admin, Coordinator roles with complaints.inbox): mark tickets solved with a note.
 * Optional route param `view`: 'all' | 'solved' | 'pending'.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { colors } from '../../theme/colors';
import { apiService } from '../../services/api';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton, WebLabel } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';
import { Card, CardTitle, InfoRow, ChipRow, ActionRow, EmptyState } from '../../ui/Kit';
import { fmtTicketDate, personDesignation, personName, ticketStatusLabel, type Ticket } from './ticketHelpers';

export type TicketsView = 'all' | 'solved' | 'pending';

const VIEWS: { view: TicketsView; label: string; status?: Ticket['status'] }[] = [
  { view: 'all', label: 'All Tickets' },
  { view: 'solved', label: 'Solved Tickets', status: 'Resolved' },
  { view: 'pending', label: 'Pending Tickets', status: 'Open' },
];

export default function ViewTicketsScreen({ route }: any) {
  const initial = (route?.params?.view as TicketsView) || 'all';
  const [view, setView] = useState<TicketsView>(VIEWS.some((v) => v.view === initial) ? initial : 'all');
  const current = VIEWS.find((v) => v.view === view) || VIEWS[0];
  const [items, setItems] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState(false);
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [search, setSearch] = useState('');

  /** Every word typed must appear somewhere on the ticket card. */
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = words.length
    ? items.filter((item) => {
        const text = [
          personName(item.raisedBy),
          personDesignation(item.raisedBy),
          item.subject,
          item.description,
          item.schoolName,
          item.schoolCode,
          item.resolutionNote,
          ticketStatusLabel(item.status),
          fmtTicketDate(item.createdAt),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return words.every((w) => text.includes(w));
      })
    : items;

  const load = useCallback(async () => {
    try {
      const data = await apiService.get(`/complaints${current.status ? `?status=${current.status}` : ''}`);
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.response?.data?.message || e?.message || 'Failed to load tickets' });
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [current.status]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const confirmResolve = async () => {
    if (!resolveId) return;
    setActing(true);
    try {
      await apiService.put(`/complaints/${resolveId}/resolve`, { resolutionNote });
      setMessage({ type: 'success', text: 'Ticket marked solved' });
      setResolveId(null);
      setResolutionNote('');
      load();
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.message || 'Failed to solve ticket' });
    } finally {
      setActing(false);
    }
  };

  return (
    <ScreenShell
      title="View Tickets"
      subtitle="Tickets raised by all employees."
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      <ChipRow
        items={VIEWS.map((v) => ({ key: v.view, label: v.label }))}
        value={view}
        onChange={(k) => setView(k as TicketsView)}
      />
      <WebInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search name, subject, school, code…"
        style={styles.search}
      />

      {message ? <MessageBanner type={message.type} message={message.text} onDismiss={() => setMessage(null)} /> : null}

      {shown.length === 0 ? (
        <EmptyState
          icon="🎫"
          title={items.length === 0 ? `No ${current.label.toLowerCase()}` : 'No matching tickets'}
          message={items.length === 0 ? undefined : 'Try different search words.'}
        />
      ) : (
        shown.map((item) => (
          <Card key={item._id}>
            <CardTitle
              title={item.subject}
              subtitle={`${personName(item.raisedBy)} · ${personDesignation(item.raisedBy)}`}
              badge={ticketStatusLabel(item.status)}
              tone={item.status === 'Resolved' ? 'success' : 'warning'}
            />
            {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
            <InfoRow
              label="School"
              value={item.schoolName ? `${item.schoolName}${item.schoolCode ? ` (${item.schoolCode})` : ''}` : item.schoolCode || ''}
            />
            <InfoRow label="Area / Town" value={item.town || ''} />
            <InfoRow label="Raised on" value={fmtTicketDate(item.createdAt)} />
            <InfoRow label="Note" value={item.resolutionNote || ''} />
            {item.status === 'Open' ? (
              <ActionRow>
                <WebButton
                  title="Mark solved"
                  variant="success"
                  disabled={acting}
                  onPress={() => {
                    setResolveId(item._id);
                    setResolutionNote('');
                  }}
                />
              </ActionRow>
            ) : null}
          </Card>
        ))
      )}

      <Modal visible={Boolean(resolveId)} transparent animationType="fade" onRequestClose={() => setResolveId(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Mark ticket solved</Text>
            <WebLabel>Note</WebLabel>
            <WebInput
              value={resolutionNote}
              onChangeText={setResolutionNote}
              placeholder="Optional note for the person who raised the ticket"
              multiline
              numberOfLines={3}
              style={styles.textArea}
            />
            <View style={styles.modalBtns}>
              <View style={{ flex: 1 }}>
                <WebButton title="Cancel" variant="outline" onPress={() => setResolveId(null)} />
              </View>
              <View style={{ flex: 1 }}>
                {acting ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <WebButton title="Mark solved" onPress={confirmResolve} disabled={acting} />
                )}
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  search: { marginTop: 12, marginBottom: 12 },
  desc: { fontSize: 14, color: colors.textSecondary, marginBottom: 8, lineHeight: 20 },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', padding: 16 },
  modal: { backgroundColor: colors.backgroundLight, borderRadius: 14, padding: 16 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  modalBtns: { flexDirection: 'row', gap: 8, marginTop: 4 },
});
