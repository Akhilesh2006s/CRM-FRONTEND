import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { confirmLogout } from '../utils/confirmLogout';

export default function LogoutButton() {
  const { logout } = useAuth();

  const handleLogout = () => {
    confirmLogout(logout);
  };

  return (
    <TouchableOpacity
      onPress={handleLogout}
      style={styles.button}
      activeOpacity={0.7}
      accessibilityLabel="Sign out"
      hitSlop={6}
    >
      <Ionicons name="log-out-outline" size={20} color="#B91C1C" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
