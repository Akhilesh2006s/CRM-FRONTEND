import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { apiService } from '../services/api';
import { getCurrentLocation } from '../services/location';
import { takeLivePhoto } from '../services/photo';
import { enableLiveGps, liveGpsState, startDayTracking, stopDayTracking, type LiveGpsState } from '../services/tracking';
import DailySelfieCheckInScreen from '../screens/Attendance/DailySelfieCheckInScreen';
import MissedExitCard from './MissedExitCard';

/** India date of an instant, e.g. '2026-11-03'. */
const istDate = (v: string | Date) => new Date(new Date(v).getTime() + 330 * 60000).toISOString().slice(0, 10);
import { useAuth } from '../context/AuthContext';
import { colors, gradients } from '../theme/colors';
import { typography } from '../theme/typography';

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

  return (
    <>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardIcon}>⏰</Text>
          <Text style={[styles.cardTitle, { flex: 1 }]}>Attendance</Text>
          {currentAttendance && !oldDay ? (
            <TouchableOpacity style={styles.endDayTop} onPress={handleCheckOut} disabled={loading} activeOpacity={0.7}>
              <Text style={styles.checkOutButtonText}>{loading ? 'Ending…' : 'End Day'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {currentAttendance ? (
          <View style={styles.attendanceStatus}>
            <View style={styles.statusBadge}>
              <Text style={styles.statusIcon}>✓</Text>
              <Text style={styles.statusText}>Day started</Text>
            </View>
            <Text style={styles.statusTime}>
              Started: {new Date(currentAttendance.startTime).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </Text>
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
            style={styles.checkInButton}
            onPress={() => setShowModal(true)}
            disabled={loading}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={gradients.success as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.checkInButtonText}>Start Day</Text>
            </LinearGradient>
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
  gpsWarn: { alignSelf: 'stretch', backgroundColor: '#FEE2E2', borderColor: '#F87171', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
  gpsWarnTitle: { color: '#B91C1C', fontWeight: '700', fontSize: 14 },
  gpsWarnText: { color: '#7F1D1D', fontSize: 13, marginTop: 4 },
  endDayTop: { backgroundColor: colors.error, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18 },
  oldDay: { color: '#B45309', fontWeight: '600', fontSize: 13, marginBottom: 12 },
  gpsOn: { color: '#15803D', fontWeight: '600', fontSize: 13, marginBottom: 12 },
  card: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  cardTitle: {
    ...typography.heading.h2,
    color: colors.textPrimary,
  },
  attendanceStatus: {
    alignItems: 'flex-start',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 12,
  },
  statusIcon: {
    fontSize: 16,
    color: colors.success,
    marginRight: 8,
    fontWeight: '700',
  },
  statusText: {
    fontSize: 14,
    color: colors.success,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  statusTime: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  checkInButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  checkOutButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: colors.error,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonGradient: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInButtonText: {
    color: colors.textLight,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  checkOutButtonText: {
    color: colors.textLight,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 60,
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textLight,
    letterSpacing: -0.5,
  },
  closeButton: {
    fontSize: 28,
    color: colors.textLight,
    fontWeight: '700',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    textAlign: 'center',
    lineHeight: 36,
  },
  modalContent: {
    padding: 24,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  reasonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reasonButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginRight: 8,
    marginBottom: 8,
  },
  reasonButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  reasonButtonText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  reasonButtonTextSelected: {
    color: colors.textLight,
    fontWeight: '700',
  },
  photoButton: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 150,
  },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  photoButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  locationButton: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  locationButtonSuccess: {
    backgroundColor: colors.successLight,
    borderColor: colors.success,
  },
  locationButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  locationText: {
    marginTop: 8,
    fontSize: 12,
    color: colors.textSecondary,
  },
  input: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.textPrimary,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: colors.textLight,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

