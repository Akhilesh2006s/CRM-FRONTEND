import React, { useState } from 'react';
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
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <View style={styles.content}>
            <View style={styles.logoContainer}>
              <Image
                source={require('../../../assets/logo-login.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <Text style={styles.title}>AMENITYFORGE</Text>
              <Text style={styles.subtitle}>Building Digital Excellence</Text>
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
                  <LinearGradient
                    colors={gradients.primary}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.buttonGradient}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <View style={styles.buttonContent}>
                        <Ionicons name="arrow-forward-circle" size={20} color="#fff" />
                        <Text style={styles.buttonText}>Sign In</Text>
                      </View>
                    )}
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </View>
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
                  <LinearGradient colors={gradients.primary} style={styles.buttonGradient}>
                    {forgotLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.buttonText}>Send OTP</Text>
                    )}
                  </LinearGradient>
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
                  <LinearGradient colors={gradients.primary} style={styles.buttonGradient}>
                    {forgotLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.buttonText}>Reset password</Text>
                    )}
                  </LinearGradient>
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
    backgroundColor: colors.accent,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoImage: {
    width: 280,
    height: 120,
    marginBottom: 20,
  },
  title: {
    ...typography.display.medium,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    ...typography.body.large,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  card: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 24,
    padding: 28,
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  welcomeHeader: {
    marginBottom: 28,
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
    ...typography.heading.h1,
    color: colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeSubtext: {
    ...typography.body.medium,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 18,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputLabel: {
    ...typography.label.medium,
    color: colors.textPrimary,
    marginLeft: 6,
  },
  input: {
    backgroundColor: colors.backgroundMuted,
    borderRadius: 12,
    padding: 16,
    ...typography.body.large,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginBottom: 8,
  },
  forgotText: {
    ...typography.body.medium,
    color: colors.primary,
  },
  button: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    cursor: 'pointer',
  },
  buttonGradient: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginLeft: 8,
  },
  errorText: {
    ...typography.body.medium,
    color: colors.error,
    backgroundColor: colors.errorLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    ...typography.heading.h2,
    color: colors.textPrimary,
    marginBottom: 16,
  },
});
