import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/api';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebLabel } from '../../ui/WebPrimitives';
import { Card, CardTitle, InfoRow, EmptyState, toneFor } from '../../ui/Kit';
import { colors } from '../../theme/colors';
import MessageBanner from '../../components/MessageBanner';
import {
  LEAVE_TYPE_OPTIONS,
  LEAVE_DAY_TYPES,
  HALF_DAY_SESSIONS,
  leaveTypeLabel,
  leaveDayTypeLabel,
  leaveDayCount,
  formatLeaveDays,
} from '../../lib/leaveTypes';

import DateField from '../../ui/DateField';
export default function LeaveListScreen({ navigation }: any) {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [leaveType, setLeaveType] = useState('');
  const [dayType, setDayType] = useState<string>('Full Day');
  const [halfDaySession, setHalfDaySession] = useState<string>('First Half');
  const isHalfDay = dayType === 'Half Day';
  // Half Day is a single date: the end date follows the start date.
  const effectiveEndDate = isHalfDay ? startDate : endDate;
  const [reason, setReason] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadLeaves();
  }, []);

  const loadLeaves = async () => {
    setLoading(true);
    try {
      // Backend exposes GET /leaves (no /leaves/employee/:id) — fetch all and filter to this user
      const data = await apiService.get('/leaves');
      const myLeaves = data.filter((leave: any) =>
        leave.employeeId?._id === user?._id || leave.employeeId === user?._id
      );
      setLeaves(myLeaves);
    } catch (error: any) {
      // If endpoint doesn't exist, try general endpoint
      try {
        const data = await apiService.get('/leaves');
        // Filter by current user
        const myLeaves = data.filter((leave: any) => 
          leave.employeeId?._id === user?._id || leave.employeeId === user?._id
        );
        setLeaves(myLeaves);
      } catch (err: any) {
        console.error('Failed to load leaves:', err);
        // Set empty array if endpoint doesn't exist
        setLeaves([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const clearMessages = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleSubmit = async () => {
    setSuccessMessage(null);
    setErrorMessage(null);
    if (!startDate || !effectiveEndDate || !leaveType || !reason) {
      setErrorMessage('Please fill all required fields');
      return;
    }

    setSubmitting(true);
    try {
      await apiService.post('/leaves/create', {
        employeeId: user?._id,
        startDate,
        endDate: effectiveEndDate,
        leaveType,
        dayType,
        ...(isHalfDay ? { halfDaySession } : {}),
        reason,
      });
      setSuccessMessage('Leave request submitted successfully.');
      setShowAddModal(false);
      resetForm();
      loadLeaves();
    } catch (error: any) {
      setErrorMessage(error.response?.data?.message || 'Failed to submit leave request');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setStartDate('');
    setEndDate('');
    setLeaveType('');
    setDayType('Full Day');
    setHalfDaySession('First Half');
    setReason('');
  };

  const leaveTypes = LEAVE_TYPE_OPTIONS;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved':
        return '#28a745';
      case 'Rejected':
        return '#dc3545';
      case 'Pending':
        return '#ffc107';
      default:
        return '#666';
    }
  };

  const fmt = (v?: string) =>
    v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A';

  return (
    <ScreenShell
      title="My Leaves"
      loading={loading}
      headerRight={
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)} hitSlop={8}>
          <Text style={styles.addButton}>+ Add</Text>
        </TouchableOpacity>
      }
    >
      {successMessage && <MessageBanner type="success" message={successMessage} onDismiss={clearMessages} />}
      {leaves.length === 0 ? (
        <EmptyState icon="🗓️" title="No leave requests" message="Tap + Add to request a leave." />
      ) : (
        leaves.map((leave) => (
          <Card key={leave._id}>
            <CardTitle
              title={leaveTypeLabel(leave.leaveType)}
              subtitle={`${leaveDayTypeLabel(leave)} · ${formatLeaveDays(leaveDayCount(leave))}`}
              badge={leave.status || 'Pending'}
              tone={toneFor(leave.status || 'Pending')}
            />
            <InfoRow label="From" value={fmt(leave.startDate)} />
            <InfoRow label="To" value={fmt(leave.endDate)} />
            <InfoRow label="Reason" value={leave.reason} />
          </Card>
        ))
      )}

      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Request Leave</Text>
            <TouchableOpacity onPress={() => setShowAddModal(false)} hitSlop={10}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            {errorMessage && showAddModal && (
              <MessageBanner type="error" message={errorMessage} onDismiss={clearMessages} />
            )}
            <PageSection title="Leave type">
              <WebLabel>Leave Type *</WebLabel>
              <View style={styles.typeGrid}>
                {leaveTypes.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[styles.typeButton, leaveType === type.value && styles.typeButtonSelected]}
                    onPress={() => setLeaveType(type.value)}
                  >
                    <Text style={[styles.typeButtonText, leaveType === type.value && styles.typeButtonTextSelected]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <WebLabel>Leave Duration *</WebLabel>
              <View style={styles.typeGrid}>
                {LEAVE_DAY_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeButton, dayType === t && styles.typeButtonSelected]}
                    onPress={() => setDayType(t)}
                  >
                    <Text style={[styles.typeButtonText, dayType === t && styles.typeButtonTextSelected]}>
                      {t === 'Half Day' ? 'Half-Day Leave' : 'Full-Day Leave'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {isHalfDay && (
                <>
                  <WebLabel>Which half *</WebLabel>
                  <View style={styles.typeGrid}>
                    {HALF_DAY_SESSIONS.map((s) => (
                      <TouchableOpacity
                        key={s}
                        style={[styles.typeButton, halfDaySession === s && styles.typeButtonSelected]}
                        onPress={() => setHalfDaySession(s)}
                      >
                        <Text style={[styles.typeButtonText, halfDaySession === s && styles.typeButtonTextSelected]}>{s}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </PageSection>

            <PageSection title="Dates">
              <WebLabel>{isHalfDay ? 'Leave Date *' : 'Start Date *'}</WebLabel>
              <DateField placeholder={isHalfDay ? 'Leave Date *' : 'Start Date *'} value={startDate} onChange={setStartDate} />

              {!isHalfDay && (
                <View style={{ marginTop: 12 }}>
                  <WebLabel>End Date *</WebLabel>
                  <DateField placeholder="End Date *" value={endDate} onChange={setEndDate} />
                </View>
              )}

              {startDate && effectiveEndDate ? (
                <Text style={styles.total}>
                  Total: {formatLeaveDays(leaveDayCount({ dayType, startDate, endDate: effectiveEndDate }))}
                </Text>
              ) : null}
            </PageSection>

            <PageSection title="Reason">
              <WebLabel>Reason *</WebLabel>
              <WebInput
                style={styles.textArea}
                placeholder="Enter reason for leave"
                value={reason}
                onChangeText={setReason}
                multiline
                numberOfLines={4}
              />
            </PageSection>

            <WebButton title="Submit Leave Request" onPress={handleSubmit} loading={submitting} disabled={submitting} />
          </ScrollView>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  addBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.accent },
  addButton: { color: colors.primaryDark, fontSize: 14, fontWeight: '700' },
  modalContainer: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 14,
    backgroundColor: colors.backgroundLight,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  closeButton: { fontSize: 18, color: colors.textTertiary, fontWeight: '700' },
  modalContent: { padding: 16, paddingBottom: 40 },
  textArea: { height: 100, textAlignVertical: 'top' },
  total: { marginTop: 12, fontSize: 14, fontWeight: '700', color: colors.primaryDark },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  typeButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: '#DCE3EC',
  },
  typeButtonSelected: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  typeButtonText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  typeButtonTextSelected: { color: '#FFFFFF' },
});
