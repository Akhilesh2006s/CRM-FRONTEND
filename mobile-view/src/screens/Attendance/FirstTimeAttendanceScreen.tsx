import React, { useState } from 'react';
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
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import LogoutButton from '../../components/LogoutButton';
import { apiService } from '../../services/api';
import { getCurrentLocation, getPincodeFromLocation, getTownFromPincode } from '../../services/location';

const ATTENDANCE_REASONS = [
  { label: 'Employee', value: 'employee' },
  { label: 'Collection', value: 'collection' },
  { label: 'Service', value: 'service' },
  { label: 'Training', value: 'training' },
  { label: 'Office', value: 'office' },
  { label: 'Other', value: 'other' },
];

export default function FirstTimeAttendanceScreen({ navigation }: any) {
  const { user, checkAuth } = useAuth();
  const [attendanceReason, setAttendanceReason] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [pincode, setPincode] = useState('');
  const [town, setTown] = useState('');
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [locationData, setLocationData] = useState<{ latitude: number; longitude: number } | null>(null);

  const capturePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to capture photo');
    }
  };

  const getLocation = async () => {
    try {
      setLoading(true);
      const location = await getCurrentLocation();
      setLocationData(location);
      // Pincode always comes from the GPS location; it cannot be typed or changed.
      const found = await getPincodeFromLocation(location);
      setPincode(found.pincode);
      let name = found.town;
      if (found.pincode) {
        try {
          const result = await getTownFromPincode(found.pincode);
          if (result?.town) name = result.town;
        } catch {
          // keep the town from the location lookup
        }
      }
      if (name) setTown((t) => t || name);
      Alert.alert(
        found.pincode ? 'Success' : 'Pincode not detected',
        found.pincode
          ? 'Location captured successfully'
          : 'Location captured, but its pincode could not be found. Tap Capture Location again.',
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to get location');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!attendanceReason) {
      Alert.alert('Error', 'Please select attendance reason');
      return;
    }
    if (!photo) {
      Alert.alert('Error', 'Please capture a photo');
      return;
    }
    if (!locationData) {
      Alert.alert('Error', 'Please capture location');
      return;
    }
    if (!pincode || pincode.length !== 6) {
      Alert.alert('Error', 'Pincode not detected for your location. Tap Capture Location again.');
      return;
    }
    if (!town) {
      Alert.alert('Error', 'Please enter town name');
      return;
    }

    setLoading(true);
    try {
      await apiService.post('/attendance/check-in', {
        attendanceReason,
        photo,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        pincode,
        town,
        remarks,
      });

      // Refresh auth state to trigger navigation
      await checkAuth();
      Alert.alert('Success', 'Attendance submitted successfully');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to submit attendance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>First Time Setup</Text>
        <LogoutButton />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>First Time Setup</Text>
        <Text style={styles.subtitle}>Please complete your attendance details</Text>

        <View style={styles.section}>
          <Text style={styles.label}>Attendance Reason *</Text>
          <View style={styles.reasonGrid}>
            {ATTENDANCE_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason.value}
                style={[
                  styles.reasonButton,
                  attendanceReason === reason.value && styles.reasonButtonSelected,
                ]}
                onPress={() => setAttendanceReason(reason.value)}
              >
                <Text
                  style={[
                    styles.reasonButtonText,
                    attendanceReason === reason.value && styles.reasonButtonTextSelected,
                  ]}
                >
                  {reason.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Photo *</Text>
          <TouchableOpacity style={styles.photoButton} onPress={capturePhoto}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.photo} />
            ) : (
              <Text style={styles.photoButtonText}>Capture Photo</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Location *</Text>
          <TouchableOpacity
            style={[styles.locationButton, locationData && styles.locationButtonSuccess]}
            onPress={getLocation}
            disabled={loading}
          >
            <Text style={styles.locationButtonText}>
              {locationData ? 'Location Captured ✓' : 'Capture Location'}
            </Text>
          </TouchableOpacity>
          {locationData && (
            <Text style={styles.locationText}>
              Lat: {locationData.latitude.toFixed(6)}, Lng: {locationData.longitude.toFixed(6)}
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Pincode *</Text>
          <TextInput
            style={[styles.input, styles.inputLocked]}
            placeholder="Filled automatically from your location"
            value={pincode}
            editable={false}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Town *</Text>
          <TextInput
            style={styles.input}
            placeholder="Town name (auto-filled from pincode)"
            value={town}
            onChangeText={setTown}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Remarks</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Optional remarks"
            value={remarks}
            onChangeText={setRemarks}
            multiline
            numberOfLines={4}
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Submit</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#007AFF',
  },
  headerSpacer: { width: 40 },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  reasonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reasonButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 8,
    marginBottom: 8,
  },
  reasonButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  reasonButtonText: {
    fontSize: 14,
    color: '#333',
  },
  reasonButtonTextSelected: {
    color: '#fff',
  },
  photoButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  photoButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  locationButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  locationButtonSuccess: {
    backgroundColor: '#d4edda',
    borderColor: '#28a745',
  },
  locationButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  locationText: {
    marginTop: 8,
    fontSize: 12,
    color: '#666',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
  },
  inputLocked: {
    backgroundColor: '#F1F5F9',
    color: '#334155',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

