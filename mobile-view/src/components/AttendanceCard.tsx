import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { apiService } from '../services/api';
import { getCurrentLocation, getTownFromPincode } from '../services/location';
import { useAuth } from '../context/AuthContext';
import { colors, gradients } from '../theme/colors';
import { typography } from '../theme/typography';

const ATTENDANCE_REASONS = [
  { label: 'Employee', value: 'employee' },
  { label: 'Collection', value: 'collection' },
  { label: 'Service', value: 'service' },
  { label: 'Training', value: 'training' },
  { label: 'Office', value: 'office' },
  { label: 'Other', value: 'other' },
];

export default function AttendanceCard() {
  const { user, checkAuth } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [attendanceReason, setAttendanceReason] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [pincode, setPincode] = useState('');
  const [town, setTown] = useState('');
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [locationData, setLocationData] = useState<{ latitude: number; longitude: number } | null>(null);
  const [currentAttendance, setCurrentAttendance] = useState<any>(null);
  const [isFirstTime, setIsFirstTime] = useState(false);

  useEffect(() => {
    checkCurrentAttendance();
    if (user) {
      if (!user.hasCompletedFirstTimeSetup) {
        // Only auto-open modal for first-time users (not already open)
        setIsFirstTime(true);
        if (!showModal) {
          setShowModal(true);
        }
      } else {
        // User has completed setup
        setIsFirstTime(false);
        // Close modal if it was open for first-time setup
        // (user.hasCompletedFirstTimeSetup is true in this else block)
      }
    }
  }, [user]);

  const checkCurrentAttendance = async () => {
    try {
      const data = await apiService.get('/attendance/current');
      setCurrentAttendance(data.attendance ?? null);
    } catch (error) {
      console.error('Error checking attendance:', error);
    }
  };

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
      Alert.alert('Success', 'Location captured successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to get location');
    } finally {
      setLoading(false);
    }
  };

  const handlePincodeChange = async (text: string) => {
    setPincode(text);
    if (text.length === 6) {
      try {
        const result = await getTownFromPincode(text);
        setTown(result.town);
      } catch (error) {
        // Town lookup failed, user can enter manually
      }
    }
  };

  const handleCheckIn = async () => {
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
      Alert.alert('Error', 'Please enter a valid 6-digit pincode');
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

      // Fetch updated user data from backend to get the latest hasCompletedFirstTimeSetup
      try {
        const updatedUser = await apiService.get('/auth/me');
        await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
        // Update user in context by calling checkAuth
        await checkAuth();
      } catch (error) {
        console.error('Error fetching updated user:', error);
        // Still continue even if user fetch fails
        await checkAuth();
      }
      
      await checkCurrentAttendance();
      
      // Wait a bit for state to update
      await new Promise(resolve => setTimeout(resolve, 100));
      
      Alert.alert('Success', isFirstTime ? 'First time setup completed!' : 'Attendance checked in successfully', [
        {
          text: 'OK',
          onPress: () => {
            setShowModal(false);
            // Reset form
            setAttendanceReason('');
            setPhoto(null);
            setPincode('');
            setTown('');
            setRemarks('');
            setLocationData(null);
          }
        }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to submit attendance');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setLoading(true);
    try {
      await apiService.post('/attendance/check-out', {});
      setCurrentAttendance(null);
      await checkCurrentAttendance();
      Alert.alert('Success', 'Attendance checked out successfully');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to check out');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardIcon}>⏰</Text>
          <Text style={styles.cardTitle}>Attendance</Text>
        </View>
        {currentAttendance ? (
          <View style={styles.attendanceStatus}>
            <View style={styles.statusBadge}>
              <Text style={styles.statusIcon}>✓</Text>
              <Text style={styles.statusText}>Checked In</Text>
            </View>
            <Text style={styles.statusTime}>
              Started: {new Date(currentAttendance.startTime).toLocaleTimeString()}
            </Text>
            <TouchableOpacity 
              style={styles.checkOutButton} 
              onPress={handleCheckOut}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={[colors.error, colors.error]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.buttonGradient}
              >
                <Text style={styles.checkOutButtonText}>Check Out</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.checkInButton}
            onPress={() => setShowModal(true)}
            disabled={loading}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={gradients.success}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.checkInButtonText}>Check In</Text>
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
        <ScrollView style={styles.modalContainer}>
          <LinearGradient
            colors={gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.modalHeader}
          >
            <Text style={styles.modalTitle}>
              {isFirstTime ? 'First Time Setup' : 'Check In'}
            </Text>
            {!isFirstTime && (
              <TouchableOpacity onPress={() => setShowModal(false)} activeOpacity={0.7}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            )}
          </LinearGradient>

          <View style={styles.modalContent}>
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
                style={styles.input}
                placeholder="Enter 6-digit pincode"
                value={pincode}
                onChangeText={handlePincodeChange}
                keyboardType="numeric"
                maxLength={6}
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
              onPress={handleCheckIn}
              disabled={loading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.buttonGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
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

