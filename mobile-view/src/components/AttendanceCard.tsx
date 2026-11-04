import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../services/api';
import { getCurrentLocation } from '../services/location';
import { takeLivePhoto } from '../services/photo';
import { enableLiveGps, liveGpsState, startDayTracking, stopDayTracking, type LiveGpsState } from '../services/tracking';
import DailySelfieCheckInScreen from '../screens/Attendance/DailySelfieCheckInScreen';
import MissedExitCard from './MissedExitCard';

/** India date of an instant, e.g. '2026-11-03'. */
const istDate = (v: string | Date) => new Date(new Date(v).getTime() + 330 * 60000).toISOString().slice(0, 10);
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

/** Same reasons / labels as web app/dashboard/attendance/page.tsx (Office is the default). */
export const ATTENDANCE_REASONS = [
  { label: 'Office', value: 'office' },
  { label: 'Field work', value: 'employee' },
  { label: 'Collection', value: 'collection' },
  { label: 'Service', value: 'service' },
  { label: 'Training', value: 'training' },
  { label: 'Other', value: 'other' },
];

export function attendanceReasonLabel(value?: string | null): string {
  if (!value) return '—';
  return ATTENDANCE_REASONS.find((r) => r.value === value)?.label || value;
}

export default function AttendanceCard({ onChange }: { onChange?: () => void } = {}) {
  const { user, checkAuth } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gps, setGps] = useState<LiveGpsState | null>(null);
  const [currentAttendance, setCurrentAttendance] = useState<any>(null);
  // A day left open from an earlier date is ended by entering the time; today's day uses End Day.
  const oldDay = Boolean(currentAttendance) && istDate(currentAttendance.startTime) !== istDate(new Date());
  // Start Day (selfie) is taken once, right after login (CheckInGate); the card only opens it on tap.
  const isFirstTime = false;

  useEffect(() => {
    checkCurrentAttendance();
  }, [user]);

  const checkCurrentAttendance = async () => {
    try {
      const data = await apiService.get('/attendance/current');
      setCurrentAttendance(data.attendance ?? null);
      setGps(data.attendance && !data.attendance.endTime ? await liveGpsState() : null);
    } catch (error) {
      console.error('Error checking attendance:', error);
    }
  };

  // Start Day done from the home card: same screen as after login; live GPS starts with it.
  const onStarted = async () => {
    setShowModal(false);
    await startDayTracking();
    await checkAuth().catch(() => undefined);
    await checkCurrentAttendance();
    setGps(await liveGpsState());
    onChange?.();
  };

  const fixGps = async () => {
    setGps('starting');
    setGps(await enableLiveGps());
  };

  // Forgot End Day (earlier today or a previous day): reason + actual end time; goes for review.
  const reportMissedEndDay = async (reason: string, exitTime: string) => {
    try {
      await apiService.post(`/field-day/missed/day/${currentAttendance._id}`, { reason, exitTime });
    } catch (e: any) {
      throw new Error(e?.response?.data?.message || e?.message || 'Could not save.');
    }
    await stopDayTracking();
    await checkCurrentAttendance();
    onChange?.();
    Alert.alert('Saved', 'End Day time recorded and sent for review. Start your day again for today.');
  };

  // End Day takes an exit photo and the location: office days end in the office, field days in the field.
  const handleCheckOut = () => {
    Alert.alert('End Day', 'End your day now? GPS tracking stops after this.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'End Day', style: 'destructive', onPress: () => void endDay() },
    ]);
  };

  const endDay = async () => {
    setLoading(true);
    try {
      const exitPhoto = await takeLivePhoto({ front: true });
      if (!exitPhoto) return;
      const here = await getCurrentLocation();
      const res: any = await apiService.post('/attendance/check-out', {
        photo: exitPhoto,
        latitude: here.latitude,
        longitude: here.longitude,
        accuracy: here.accuracy,
      });
      setCurrentAttendance(null);
      await stopDayTracking();
      await checkCurrentAttendance();
      onChange?.();
      Alert.alert(res?.needsReview ? 'Sent for review' : 'Day ended', res?.message || 'Your day has ended.');
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.message || error?.message || 'Could not end the day');
    } finally {
      setLoading(false);
    }
  };

  const startedAt = currentAttendance
    ? new Date(currentAttendance.startTime).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconBox, currentAttendance ? styles.iconBoxOn : null]}>
            <Ionicons name="time-outline" size={20} color={currentAttendance ? colors.success : colors.primaryDark} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.cardTitle}>Attendance</Text>
            <Text style={styles.cardSub} numberOfLines={1}>
              {currentAttendance ? `Started ${startedAt}` : 'Your day has not started yet'}
            </Text>
          </View>
          {currentAttendance && !oldDay ? (
            <TouchableOpacity style={styles.endDayTop} onPress={handleCheckOut} disabled={loading} activeOpacity={0.7}>
              <Text style={styles.endDayText}>{loading ? 'Ending…' : 'End Day'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {currentAttendance ? (
          <View style={styles.attendanceStatus}>
            <View style={styles.statusBadge}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              <Text style={styles.statusText}>Day started</Text>
            </View>
            {oldDay ? (
              <>
                <Text style={styles.oldDay}>This day was not ended. Enter the time you ended it.</Text>
                <View style={{ alignSelf: 'stretch' }}>
                  <MissedExitCard title="End Day" startAt={currentAttendance.startTime} onSubmit={reportMissedEndDay} />
                </View>
              </>
            ) : null}
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.checkInButton, loading && styles.buttonDisabled]}
            onPress={() => setShowModal(true)}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Ionicons name="play-circle-outline" size={20} color="#FFFFFF" />
            <Text style={styles.checkInButtonText}>Start Day</Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          if (!isFirstTime) {
            setShowModal(false);
          }
        }}
      >
        <DailySelfieCheckInScreen onDone={() => void onStarted()} onClose={isFirstTime ? undefined : () => setShowModal(false)} />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxOn: { backgroundColor: colors.successLight },
  headerText: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  cardSub: { fontSize: 13, color: colors.textTertiary, marginTop: 2 },
  endDayTop: {
    backgroundColor: colors.error,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 40,
    justifyContent: 'center',
  },
  endDayText: { color: colors.textLight, fontSize: 15, fontWeight: '700' },
  attendanceStatus: { alignItems: 'flex-start', marginTop: 12 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.successLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: { fontSize: 13, color: '#15803D', fontWeight: '700' },
  oldDay: { color: '#B45309', fontWeight: '600', fontSize: 13, marginTop: 12, marginBottom: 8 },
  checkInButton: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: colors.success,
  },
  checkInButtonText: { color: colors.textLight, fontSize: 16, fontWeight: '700' },
  buttonDisabled: { opacity: 0.6 },
});
