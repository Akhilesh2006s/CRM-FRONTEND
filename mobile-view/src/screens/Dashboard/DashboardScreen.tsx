import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import AttendanceCard from '../../components/AttendanceCard';
import PendingAdvanceApprovalsCard from '../../components/PendingAdvanceApprovalsCard';
import PartnerDashboard from '../../components/partner/PartnerDashboard';
import { getNavSections, MY_DATA_TITLE } from '../../config/navConfig';
import { iconForSection } from '../../config/moduleIcons';
import { navigateRoot } from '../../navigation/navigationRef';
import { getRoleFlags } from '../../utils/roles';
import { colors } from '../../theme/colors';

/** One colour per module tile, in turn. */
export const MODULE_COLORS = ['#0D9488', '#EA580C', '#2563EB', '#DC2626', '#7C3AED', '#0891B2', '#D97706', '#16A34A'];

/**
 * Home: Start Day / End Day, then every main menu module as a tile.
 * A tile opens that module's options as tiles (ModuleHub) — no side menu, no overview figures.
 */
export default function DashboardScreen() {
  const { user } = useAuth();
  const flags = getRoleFlags(user);

  if (flags.isPartner) {
    return <PartnerDashboard userName={user?.name} role={user?.role} />;
  }

  const sections = getNavSections(user).filter((s) => s.title !== MY_DATA_TITLE);
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
      <View style={styles.header}>
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

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {showAttendance ? <AttendanceCard /> : null}
        <PendingAdvanceApprovalsCard />

        <Text style={styles.heading}>Menu</Text>
        <View style={styles.grid}>
          {sections.map((s, i) => {
            const color = MODULE_COLORS[i % MODULE_COLORS.length];
            const single = s.items.length === 1;
            return (
              <TouchableOpacity
                key={s.title}
                style={styles.tile}
                activeOpacity={0.8}
                onPress={() => (single ? navigateRoot(s.items[0].screen, s.items[0].params) : navigateRoot('ModuleHub', { title: s.title }))}
              >
                <View style={[styles.icon, { backgroundColor: color + '1A' }]}>
                  <Ionicons name={iconForSection(s.title)} size={26} color={color} />
                </View>
                <Text style={styles.tileTitle} numberOfLines={2}>
                  {s.title}
                </Text>
                <Text style={styles.tileSub}>{single ? 'Open' : `${s.items.length} options`}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
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
