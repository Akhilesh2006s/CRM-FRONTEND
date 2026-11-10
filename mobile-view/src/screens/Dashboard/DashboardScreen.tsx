import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import AttendanceCard from '../../components/AttendanceCard';
import PendingAdvanceApprovalsCard from '../../components/PendingAdvanceApprovalsCard';
import PartnerDashboard from '../../components/partner/PartnerDashboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SideMenu from '../../navigation/SideMenu';
import { getRoleFlags } from '../../utils/roles';
import { colors } from '../../theme/colors';

/** One colour per module tile, in turn. */
export const MODULE_COLORS = ['#0D9488', '#EA580C', '#2563EB', '#DC2626', '#7C3AED', '#0891B2', '#D97706', '#16A34A'];

/**
 * Home: Start Day / End Day and pending approvals. Every module is in the side menu (☰),
 * like the web sidebar.
 */
export default function DashboardScreen() {
  const { user } = useAuth();
  const flags = getRoleFlags(user);
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);

  if (flags.isPartner) {
    return <PartnerDashboard userName={user?.name} role={user?.role} />;
  }

  // Start Day / End Day for field and office staff, trainers included.
  const showAttendance =
    flags.isTrainer ||
    flags.isEmployee ||
    flags.isExecutive ||
    flags.isManager ||
    flags.isCoordinator ||
    flags.isSeniorCoordinator ||
    flags.isExecutiveManager;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => setMenuOpen(true)} hitSlop={12} style={styles.menuBtn} accessibilityLabel="Open menu">
          <Ionicons name="menu" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <Image source={require('../../../assets/logo-login.png')} style={styles.logo} resizeMode="contain" accessibilityLabel="Viswam" />
        <View style={styles.headerText}>
          <Text style={styles.greeting}>Welcome back</Text>
          <Text style={styles.userName} numberOfLines={1}>
            {user?.name?.split(' ')[0] || 'User'}
          </Text>
        </View>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText} numberOfLines={1}>
            {user?.role || 'User'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 32 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        {showAttendance ? <AttendanceCard /> : null}
        <PendingAdvanceApprovalsCard />

        <TouchableOpacity style={styles.menuCard} onPress={() => setMenuOpen(true)} activeOpacity={0.8}>
          <Ionicons name="menu" size={22} color={colors.primaryDark} />
          <Text style={styles.menuCardText}>Open the menu for all options</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </ScrollView>
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.backgroundLight,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  menuBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  menuCardText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  logo: { width: 44, height: 44, marginRight: 12 },
  headerText: { flex: 1 },
  greeting: { fontSize: 13, color: colors.textTertiary },
  userName: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginTop: 2 },
  roleBadge: { backgroundColor: '#DBEAFE', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, maxWidth: 150 },
  roleText: { fontSize: 12, fontWeight: '700', color: colors.primaryDark },
  scroll: { padding: 16, paddingBottom: 32 },
  heading: { fontSize: 13, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    minHeight: 128,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  icon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  tileTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  tileSub: { fontSize: 12, color: colors.textTertiary, marginTop: 4 },
});
