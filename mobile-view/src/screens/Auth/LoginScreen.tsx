import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  Alert,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/api';
import { colors, gradients } from '../../theme/colors';
import { typography } from '../../theme/typography';

export default function LoginScreen() {
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  // Keep the field being typed in above the keyboard.
  const revealFields = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'reset'>('request');
  const [forgotId, setForgotId] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleLogin = async () => {
    setError(null);
    if (!mobile || !password) {
      setError('Please enter your official company number and password');
      return;
    }

    setLoading(true);
    try {
      await login(mobile, password);
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const requestOtp = async () => {
    if (!forgotId.trim()) {
      Alert.alert('Required', 'Enter mobile or email');
      return;
    }
    setForgotLoading(true);
    try {
      const data = await apiService.post('/auth/forgot-password', {
        mobile: forgotId.trim(),
        email: forgotId.trim(),
      });
      if (data?.otp) {
        Alert.alert('OTP sent', `Dev OTP: ${data.otp}`);
        setForgotOtp(String(data.otp));
      } else {
        Alert.alert('OTP sent', data?.message || 'If account exists, OTP sent');
      }
      setForgotStep('reset');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to send OTP');
    } finally {
      setForgotLoading(false);
    }
  };

  const submitReset = async () => {
    if (!forgotOtp.trim() || !forgotNewPassword.trim()) {
      Alert.alert('Required', 'OTP and new password are required');
      return;
    }
    setForgotLoading(true);
    try {
      await apiService.post('/auth/reset-password', {
        mobile: forgotId.trim(),
        email: forgotId.trim(),
        otp: forgotOtp.trim(),
        newPassword: forgotNewPassword,
      });
      Alert.alert('Success', 'Password reset. You can sign in now.');
      setForgotOpen(false);
      setForgotStep('request');
      setForgotOtp('');
      setForgotNewPassword('');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Reset failed');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.logoContainer}>
              <Image
                source={require('../../../assets/logo-login.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <Text style={styles.title}>Viswam Edutech</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.welcomeHeader}>
                <View style={styles.welcomeIconWrap}>
                  <Ionicons name="log-in-outline" size={22} color={colors.primary} />
                </View>
                <Text style={styles.welcomeText}>Welcome Back!</Text>
                <Text style={styles.welcomeSubtext}>Sign in to continue to your dashboard</Text>
              </View>

              <View style={styles.form}>
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                <View style={styles.inputContainer}>
                  <View style={styles.labelRow}>
                    <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
                    <Text style={styles.inputLabel}>Official Company Number</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Official Company Number"
                    placeholderTextColor={colors.textMuted}
                    value={mobile}
                    onChangeText={(value) => setMobile(value.replace(/\D/g, '').slice(0, 15))}
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                    autoComplete="username"
                    onFocus={revealFields}
                    onSubmitEditing={handleLogin}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <View style={styles.labelRow}>
                    <Ionicons name="lock-closed-outline" size={16} color={colors.textSecondary} />
                    <Text style={styles.inputLabel}>Password</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your password"
                    placeholderTextColor={colors.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    onFocus={revealFields}
                    onSubmitEditing={handleLogin}
                  />
                </View>

                <Pressable
                  onPress={() => {
                    setForgotId(mobile);
                    setForgotStep('request');
                    setForgotOpen(true);
                  }}
                  style={styles.forgotLink}
                >
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.button, loading && styles.buttonDisabled, pressed && { opacity: 0.85 }]}
                  onPress={handleLogin}
                  disabled={loading}
                  accessibilityRole="button"
                >
                  <View style={styles.buttonGradient}>
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <View style={styles.buttonContent}>
                        <Ionicons name="arrow-forward-circle" size={20} color="#fff" />
                        <Text style={styles.buttonText}>Sign In</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      <Modal visible={forgotOpen} transparent animationType="fade" onRequestClose={() => setForgotOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reset password</Text>
            {forgotStep === 'request' ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Mobile or email"
                  placeholderTextColor={colors.textMuted}
                  value={forgotId}
                  onChangeText={setForgotId}
                  autoCapitalize="none"
                />
                <Pressable style={styles.button} onPress={requestOtp} disabled={forgotLoading}>
                  <View style={styles.buttonGradient}>
                    {forgotLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.buttonText}>Send OTP</Text>
                    )}
                  </View>
                </Pressable>
              </>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="OTP"
                  placeholderTextColor={colors.textMuted}
                  value={forgotOtp}
                  onChangeText={setForgotOtp}
                  keyboardType="number-pad"
                />
                <TextInput
                  style={[styles.input, { marginTop: 12 }]}
                  placeholder="New password"
                  placeholderTextColor={colors.textMuted}
                  value={forgotNewPassword}
                  onChangeText={setForgotNewPassword}
                  secureTextEntry
                />
                <Pressable style={[styles.button, { marginTop: 12 }]} onPress={submitReset} disabled={forgotLoading}>
                  <View style={styles.buttonGradient}>
                    {forgotLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.buttonText}>Reset password</Text>
                    )}
                  </View>
                </Pressable>
                <Pressable onPress={() => setForgotStep('request')} style={{ marginTop: 12 }}>
                  <Text style={styles.forgotText}>Back</Text>
                </Pressable>
              </>
            )}
            <Pressable onPress={() => setForgotOpen(false)} style={{ marginTop: 16 }}>
              <Text style={[styles.forgotText, { textAlign: 'center' }]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  overlay: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoImage: {
    width: 220,
    height: 96,
    marginBottom: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  card: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 14,
    padding: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  welcomeHeader: {
    marginBottom: 20,
    alignItems: 'center',
  },
  welcomeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  welcomeText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
    textAlign: 'center',
  },
  welcomeSubtext: {
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginLeft: 6,
  },
  input: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
    fontSize: 15,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: '#DCE3EC',
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginBottom: 8,
    paddingVertical: 4,
  },
  forgotText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  button: {
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 8,
  },
  buttonGradient: {
    minHeight: 48,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryDark,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  errorText: {
    fontSize: 13,
    color: colors.error,
    backgroundColor: colors.errorLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    overflow: 'hidden',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 14,
    padding: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
  },
});
