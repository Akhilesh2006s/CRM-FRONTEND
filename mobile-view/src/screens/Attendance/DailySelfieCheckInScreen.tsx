import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useAuth } from '../../context/AuthContext';
import LogoutButton from '../../components/LogoutButton';
import { apiService } from '../../services/api';
import { getCurrentLocation, getTownFromPincode } from '../../services/location';

const ATTENDANCE_REASONS = [
  { label: 'Employee', value: 'employee' },
  { label: 'Collection', value: 'collection' },
  { label: 'Service', value: 'service' },
  { label: 'Training', value: 'training' },
  { label: 'Office', value: 'office' },
  { label: 'Other', value: 'other' },
];

/**
 * Shown after login until today's attendance exists: a live front-camera selfie plus
 * GPS location. The selfie is saved with the attendance and shown to admin / HR.
 */
export default function DailySelfieCheckInScreen({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [photo, setPhoto] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [attendanceReason, setAttendanceReason] = useState('employee');
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [pincode, setPincode] = useState('');
  const [town, setTown] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const locate = async () => {
    setLocating(true);
    try {
      const loc = await getCurrentLocation();
      setLocation(loc);
      try {
        const [place] = await Location.reverseGeocodeAsync(loc);
        if (place?.postalCode) setPincode((p) => p || String(place.postalCode));
        const name = place?.city || place?.subregion || place?.district || '';
        if (name) setTown((t) => t || name);
      } catch {
        // Address lookup is optional; the employee can type pincode / town.
      }
    } catch (error: any) {
      Alert.alert('Location needed', error?.message || 'Turn on location and try again.');
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => {
    void locate();
  }, []);

  const takeSelfie = async () => {
    if (!cameraRef.current) return;
    setCapturing(true);
    try {
      const shot = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.4 });
      if (shot?.base64) setPhoto(`data:image/jpeg;base64,${shot.base64}`);
    } catch {
      Alert.alert('Error', 'Could not take the selfie. Try again.');
    } finally {
      setCapturing(false);
    }
  };

  const onPincode = async (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 6);
    setPincode(digits);
    if (digits.length === 6) {
      try {
        const result = await getTownFromPincode(digits);
        if (result?.town) setTown(result.town);
      } catch {
        // Town can be typed.
      }
    }
  };

  const submit = async () => {
    if (!photo) return Alert.alert('Selfie needed', 'Take a selfie to check in.');
    if (!location) return Alert.alert('Location needed', 'Capture your location to check in.');
    if (pincode.length !== 6) return Alert.alert('Pincode needed', 'Enter a valid 6-digit pincode.');
    if (!town.trim()) return Alert.alert('Town needed', 'Enter your town.');
    setSubmitting(true);
    try {
      await apiService.post('/attendance/check-in', {
        attendanceReason,
        photo,
        latitude: location.latitude,
        longitude: location.longitude,
        pincode,
        town: town.trim(),
        remarks: remarks.trim(),
        source: 'login_selfie',
      });
      onDone();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to check in');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Check In</Text>
          <Text style={styles.subtitle}>Hi {user?.name || 'there'}, take a selfie to start your day.</Text>
        </View>
        <LogoutButton />
      </View>

      <View style={styles.cameraBox}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.camera} />
        ) : !permission ? (
          <ActivityIndicator style={styles.camera} />
        ) : !permission.granted ? (
          <View style={[styles.camera, styles.center]}>
            <Text style={styles.muted}>Camera permission is needed for the selfie.</Text>
            <TouchableOpacity style={styles.secondaryBtn} onPress={requestPermission}>
              <Text style={styles.secondaryText}>Allow Camera</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <CameraView ref={cameraRef} style={styles.camera} facing="front" />
        )}
      </View>
      {permission?.granted && (
        photo ? (
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setPhoto(null)}>
            <Text style={styles.secondaryText}>Retake Selfie</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.primaryBtn} onPress={takeSelfie} disabled={capturing}>
            {capturing ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Take Selfie</Text>}
          </TouchableOpacity>
        )
      )}

      <Text style={styles.label}>Location</Text>
      <View style={styles.row}>
        <Text style={[styles.muted, { flex: 1 }]}>
          {locating
            ? 'Getting your location…'
            : location
              ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
              : 'Location not captured'}
        </Text>
        <TouchableOpacity style={styles.smallBtn} onPress={locate} disabled={locating}>
          <Text style={styles.secondaryText}>{location ? 'Refresh' : 'Capture'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Pincode *</Text>
      <TextInput style={styles.input} value={pincode} onChangeText={onPincode} keyboardType="number-pad" placeholder="6-digit pincode" />
      <Text style={styles.label}>Town *</Text>
      <TextInput style={styles.input} value={town} onChangeText={setTown} placeholder="Town" />

      <Text style={styles.label}>Reason</Text>
      <View style={styles.chips}>
        {ATTENDANCE_REASONS.map((r) => (
          <TouchableOpacity
            key={r.value}
            style={[styles.chip, attendanceReason === r.value && styles.chipOn]}
            onPress={() => setAttendanceReason(r.value)}
          >
            <Text style={[styles.chipText, attendanceReason === r.value && styles.chipTextOn]}>{r.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Remarks</Text>
      <TextInput style={[styles.input, { minHeight: 60 }]} value={remarks} onChangeText={setRemarks} placeholder="Optional" multiline />

      <TouchableOpacity style={[styles.primaryBtn, { marginTop: 20 }]} onPress={submit} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Check In</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { padding: 16, paddingTop: 48, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '700', color: '#171717' },
  subtitle: { fontSize: 14, color: '#525252', marginTop: 4, maxWidth: 240 },
  cameraBox: { borderRadius: 16, overflow: 'hidden', backgroundColor: '#E5E5E5', marginBottom: 12 },
  camera: { width: '100%', aspectRatio: 3 / 4 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 16 },
  muted: { fontSize: 14, color: '#525252', textAlign: 'left' },
  label: { fontSize: 14, fontWeight: '600', color: '#262626', marginTop: 16, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D4D4D4', borderRadius: 8, padding: 12, fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: '#D4D4D4', backgroundColor: '#fff' },
  chipOn: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { color: '#262626', fontSize: 14 },
  chipTextOn: { color: '#fff', fontWeight: '600' },
  primaryBtn: { backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryBtn: { borderWidth: 1, borderColor: '#2563EB', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', marginTop: 8 },
  smallBtn: { borderWidth: 1, borderColor: '#2563EB', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  secondaryText: { color: '#2563EB', fontSize: 15, fontWeight: '600' },
});
