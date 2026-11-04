import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { navigateRoot } from '../../navigation/navigationRef';
import { colors } from '../../theme/colors';
import { getRoleFlags } from '../../utils/roles';
import { confirmLogout } from '../../utils/confirmLogout';

type IonName = React.ComponentProps<typeof Ionicons>['name'];

export default function MoreHubScreen() {
  const { user, logout } = useAuth();
  const { isAdmin } = getRoleFlags(user);

  const settingsItems: { label: string; screen: string; icon: IonName }[] = [
    { label: 'Change Password', screen: 'SettingsPassword', icon: 'key-outline' },
    ...(isAdmin
      ? [
          { label: 'App Data Upload', screen: 'SettingsUpload', icon: 'cloud-upload-outline' as IonName },
          { label: 'SMS Settings', screen: 'SettingsSMS', icon: 'chatbox-ellipses-outline' as IonName },
          { label: 'DB Backup', screen: 'SettingsBackup', icon: 'server-outline' as IonName },
          { label: 'Expense Policy', screen: 'SettingsExpenses', icon: 'wallet-outline' as IonName },
        ]
      : []),
  ];

  const handleLogout = () => {
    confirmLogout(logout);
  };

  const initial = (user?.name || 'U').trim().charAt(0).toUpperCase();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>More</Text>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.profileName} numberOfLines={1}>
            {user?.name || 'User'}
          </Text>
          {user?.email ? (
            <Text style={styles.profileEmail} numberOfLines={1}>
              {user.email}
            </Text>
          ) : null}
          {user?.role ? (
            <View style={styles.roleBadge}>
              <Text style={styles.profileRole}>{user.role}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <Text style={styles.sectionTitle}>Settings</Text>
      <View style={styles.group}>
        {settingsItems.map((item, i) => (
          <TouchableOpacity
            key={item.screen}
            style={[styles.row, i === settingsItems.length - 1 && styles.rowLast]}
            onPress={() => navigateRoot(item.screen)}
            activeOpacity={0.7}
          >
            <View style={styles.rowIcon}>
              <Ionicons name={item.icon} size={18} color={colors.primaryDark} />
            </View>
            <Text style={styles.rowLabel}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutRow} onPress={handleLogout} activeOpacity={0.8}>
        <Ionicons name="log-out-outline" size={18} color="#B91C1C" />
        <Text style={styles.logoutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingTop: 56, paddingBottom: 40 },
  title: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.backgroundLight,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    marginBottom: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 17, fontWeight: '700', color: colors.primaryDark },
  profileName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  profileEmail: { fontSize: 13, color: colors.textTertiary, marginTop: 2 },
  roleBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  profileRole: { fontSize: 12, fontWeight: '700', color: colors.primaryDark },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  group: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { flex: 1, fontSize: 15, color: colors.textPrimary },
  logoutRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
  },
  logoutText: { color: '#B91C1C', fontWeight: '700', fontSize: 15 },
});
