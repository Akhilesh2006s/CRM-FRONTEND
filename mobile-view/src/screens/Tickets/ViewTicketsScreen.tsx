/**
 * View Tickets — web components/tickets/TicketsInbox.tsx (All / Solved / Pending).
 * Coordinator inbox (Admin, Super Admin, Coordinator roles with complaints.inbox): mark tickets solved with a note.
 * Optional route param `view`: 'all' | 'solved' | 'pending'.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useAuth } from '../../context/AuthContext';
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

/** Roles that see every ticket and can assign them; others see only tickets assigned to them. */
const REVIEW_ROLES = new Set(['Coordinator', 'Senior Coordinator', 'Admin', 'Super Admin']);
type Assignee = { _id: string; name?: string; role?: string };

export default function ViewTicketsScreen({ route }: any) {
  const { user } = useAuth() as any;
  const isReviewer = Boolean(user?.isSuperAdmin) || REVIEW_ROLES.has(String(user?.role || ''));
  const [assignId, setAssignId] = useState<string | null>(null);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [assigneeId, setAssigneeId] = useState('');
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

  const openAssign = async (id: string) => {
    setAssignId(id);
    setAssigneeId('');
    if (assignees.length) return;
    try {
      const data = await apiService.get('/complaints/assignees');
      setAssignees(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.response?.data?.message || e?.message || 'Failed to load people to assign' });
    }
  };

  const confirmAssign = async () => {
    if (!assignId || !assigneeId) return;
    setActing(true);
    try {
      await apiService.put(`/complaints/${assignId}/assign`, { userId: assigneeId });
      setMessage({ type: 'success', text: 'Ticket assigned' });
      setAssignId(null);
      load();
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.response?.data?.message || e?.message || 'Failed to assign ticket' });
    } finally {
      setActing(false);
    }
  };

  const confirmResolve = async () => {
    if (!resolveId) return;
    if (!resolutionNote.trim()) {
      setMessage({ type: 'error', text: 'Enter a remark before marking the ticket as solved.' });
      return;
    }
    setActing(true);
    try {
      await apiService.put(`/complaints/${resolveId}/resolve`, { resolutionNote });
      setMessage({ type: 'success', text: 'Ticket marked solved' });
      setResolveId(null);
      setResolutionNote('');
      load();
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.response?.data?.message || e?.message || 'Failed to solve ticket' });
    } finally {
      setActing(false);
    }
  };

  return (
    <ScreenShell
      title="View Tickets"
      subtitle={isReviewer ? 'Tickets raised by all employees, oldest first.' : 'Tickets assigned to you, oldest first.'}
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
            <InfoRow
              label="Assigned to"
              value={item.assignedTo && typeof item.assignedTo === 'object' ? `${item.assignedTo.name || ''}${item.assignedTo.role ? ` (${item.assignedTo.role})` : ''}` : ''}
            />
            <InfoRow label="Remark" value={item.resolutionNote || ''} />
            {item.status === 'Open' ? (
              <ActionRow>
                {isReviewer ? (
                  <WebButton title="Assign" variant="outline" disabled={acting} onPress={() => openAssign(item._id)} />
                ) : null}
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

      <Modal visible={Boolean(assignId)} transparent animationType="fade" onRequestClose={() => setAssignId(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Assign ticket</Text>
            <WebLabel>Assign to</WebLabel>
            {assignees.length === 0 ? <Text style={styles.desc}>Loading…</Text> : null}
            {assignees.map((a) => (
              <TouchableOpacity
                key={a._id}
                style={[styles.option, assigneeId === a._id && styles.optionOn]}
                onPress={() => setAssigneeId(a._id)}
              >
                <Text style={[styles.optionText, assigneeId === a._id && styles.optionTextOn]}>
                  {a.name || 'Unnamed'} ({a.role})
                </Text>
              </TouchableOpacity>
            ))}
            <View style={styles.modalBtns}>
              <View style={{ flex: 1 }}>
                <WebButton title="Cancel" variant="outline" onPress={() => setAssignId(null)} />
              </View>
              <View style={{ flex: 1 }}>
                {acting ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <WebButton title="Assign" onPress={confirmAssign} disabled={!assigneeId} />
                )}
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(resolveId)} transparent animationType="fade" onRequestClose={() => setResolveId(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Mark ticket solved</Text>
            {message?.type === 'error' ? <Text style={styles.err}>{message.text}</Text> : null}
            <WebLabel>Remark *</WebLabel>
            <WebInput
              value={resolutionNote}
              onChangeText={setResolutionNote}
              placeholder="What was done to solve this ticket (required)"
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
                  <WebButton title="Mark solved" onPress={confirmResolve} disabled={acting || !resolutionNote.trim()} />
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
  err: { color: colors.error, fontSize: 13, marginBottom: 8 },
  option: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, marginBottom: 6 },
  optionOn: { borderColor: colors.primary, backgroundColor: '#EEF2FF' },
  optionText: { fontSize: 14, color: colors.textPrimary },
  optionTextOn: { color: colors.primary, fontWeight: '700' },
});
