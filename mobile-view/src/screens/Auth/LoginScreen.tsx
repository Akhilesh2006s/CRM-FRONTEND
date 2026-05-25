import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { colors, gradients } from '../../theme/colors';
import { typography } from '../../theme/typography';

export default function LoginScreen() {
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!mobile || !password) {
      Alert.alert('Error', 'Please enter mobile number or email and password');
      return;
    }

    setLoading(true);
    try {
      await login(mobile, password);
    } catch (error: any) {
      Alert.alert('Login Failed', error.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
                <Text style={styles.welcomeText}>Welcome Back!</Text>
                <Text style={styles.welcomeSubtext}>Sign in to continue to your dashboard</Text>
              </View>

              <View style={styles.form}>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Mobile number or email</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Mobile number or email"
                    placeholderTextColor={colors.textTertiary}
                    value={mobile}
                    onChangeText={setMobile}
                    keyboardType="default"
                    autoCapitalize="none"
                    autoComplete="username"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Password</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your password"
                    placeholderTextColor={colors.textTertiary}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                </View>

                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleLogin}
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
                      <Text style={styles.buttonText}>Sign In</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
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
    marginBottom: 56,
  },
  logoImage: {
    width: 280,
    height: 120,
    marginBottom: 24,
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
  },
  title: {
    ...typography.display.medium,
    color: '#F5F5F5',
    marginBottom: 12,
  },
  subtitle: {
    ...typography.body.large,
    color: '#A3A3A3',
    fontWeight: '500',
  },
  card: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 28,
    padding: 32,
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  welcomeHeader: {
    marginBottom: 32,
    alignItems: 'center',
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
    marginBottom: 20,
  },
  inputLabel: {
    ...typography.label.medium,
    color: colors.textPrimary,
    marginBottom: 10,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 18,
    ...typography.body.large,
    color: colors.textPrimary,
    borderWidth: 2,
    borderColor: colors.border,
  },
  button: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: colors.primary,
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
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
