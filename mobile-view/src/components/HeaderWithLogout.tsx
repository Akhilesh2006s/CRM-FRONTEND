import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { confirmLogout } from '../utils/confirmLogout';
import { colors } from '../theme/colors';

interface HeaderWithLogoutProps {
  title?: string;
  showBack?: boolean;
  onBackPress?: () => void;
  rightAction?: React.ReactNode;
}

export default function HeaderWithLogout({ 
  title, 
  showBack = false, 
  onBackPress,
  rightAction 
}: HeaderWithLogoutProps) {
  const { logout, user } = useAuth();

  const handleLogout = () => {
    confirmLogout(logout);
  };

  return (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        {showBack && onBackPress ? (
          <TouchableOpacity onPress={onBackPress} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
        
        <View style={styles.titleContainer}>
          {title ? (
            <Text style={styles.title}>{title}</Text>
          ) : (
            <View>
              <Text style={styles.greeting}>Welcome back,</Text>
              <Text style={styles.userName}>{user?.name?.split(' ')[0] || 'User'}</Text>
            </View>
          )}
        </View>

        <View style={styles.rightContainer}>
          {rightAction}
          <TouchableOpacity 
            style={styles.logoutButton} 
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={20} color="#B91C1C" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 12,
    paddingTop: 48,
    paddingBottom: 12,
    backgroundColor: colors.backgroundLight,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    width: 40,
  },
  titleContainer: {
    flex: 1,
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  greeting: {
    fontSize: 13,
    color: colors.textTertiary,
  },
  userName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
