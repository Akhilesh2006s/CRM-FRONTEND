import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import AttendanceCard from '../../components/AttendanceCard';
import PendingAdvanceApprovalsCard from '../../components/PendingAdvanceApprovalsCard';
import { BirthdayWishCard, EmployeeBirthdaysCard } from '../../components/BirthdayCards';
import { Ionicons } from '@expo/vector-icons';
import StatCard from '../../components/dashboard/StatCard';
import PremiumIcon from '../../components/ui/PremiumIcon';
import { apiService } from '../../services/api';
import { colors } from '../../theme/colors';
import { navigateRoot } from '../../navigation/navigationRef';
import { getRoleFlags } from '../../utils/roles';
import HierarchyDashboardScreen from '../Hierarchy/HierarchyDashboardScreen';
import ProductManagerScreen from '../ProductManager/ProductManagerScreen';
import PartnerDashboard from '../../components/partner/PartnerDashboard';
import { DASHBOARD_STAT_ICONS } from '../../config/moduleIcons';

type DashboardStats = {
  activeLeads: number;
  totalSales: number;
  existingSchools: number;
  pendingTrainings: number;
  completedTrainings: number;
  pendingServices: number;
  completedServices: number;
};

type Quick = {
  label: string;
  sub: string;
  screen: string;
  ion: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  bg: string;
};

const ADMIN_QUICK: Quick[] = [
  { label: 'Add Lead', sub: 'Create a new lead', screen: 'LeadAdd', ion: 'person-add-outline', color: '#16A34A', bg: '#DCFCE7' },
  { label: 'All Leads', sub: 'Browse every lead', screen: 'LeadsList', ion: 'list-outline', color: '#2563EB', bg: '#DBEAFE' },
  { label: 'Create Sale', sub: 'Start a new sale', screen: 'DCCreateSale', ion: 'add-circle-outline', color: '#059669', bg: '#D1FAE5' },
  { label: 'Reports', sub: 'Leads and sales reports', screen: 'ReportsLeads', ion: 'bar-chart-outline', color: '#7C3AED', bg: '#EDE9FE' },
];

const SUPER_ADMIN_QUICK = ADMIN_QUICK.filter(
  (q) => q.screen !== 'LeadAdd' && q.screen !== 'LeadsList',
);

const EM_QUICK: Quick[] = [
  { label: 'My Dashboard', sub: 'Team overview', screen: 'ExecutiveManagerDashboard', ion: 'home-outline', color: '#2563EB', bg: '#DBEAFE' },
  { label: 'Executives', sub: 'Your team members', screen: 'ExecutiveManagerExecutives', ion: 'people-outline', color: '#059669', bg: '#D1FAE5' },
  { label: 'PO Edit Request', sub: 'Closed sales edits', screen: 'ClientsClosedSales', ion: 'document-text-outline', color: '#7C3AED', bg: '#EDE9FE' },
  { label: 'Pending Expenses', sub: 'Awaiting your approval', screen: 'ExpenseExecutiveManagerPending', ion: 'time-outline', color: '#D97706', bg: '#FEF3C7' },
  { label: 'Leave Management', sub: 'Team leave requests', screen: 'ExecutiveManagerLeaves', ion: 'calendar-outline', color: '#0D9488', bg: '#CCFBF1' },
];

const LEAVE_QUICK: Quick[] = [
  { label: 'Apply for Leave', sub: 'Submit a new request', screen: 'LeaveRequest', ion: 'paper-plane-outline', color: '#7C3AED', bg: '#EDE9FE' },
  { label: 'My Leaves', sub: 'View leave history', screen: 'LeavesApproved', ion: 'calendar-outline', color: '#0D9488', bg: '#CCFBF1' },
];

/** One quick-link tile: icon, title and a one-line subtitle. Same size everywhere. */
function QuickTile({ q, onPress }: { q: Quick; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.tile} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.tileTop}>
        <PremiumIcon name={q.ion} color={q.color} bg={q.bg} size={20} />
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </View>
      <Text style={styles.tileTitle} numberOfLines={1}>
        {q.label}
      </Text>
      <Text style={styles.tileSub} numberOfLines={1}>
        {q.sub}
      </Text>
    </TouchableOpacity>
  );
}

export default function DashboardScreen({ navigation }: { navigation?: any }) {
  const { user } = useAuth();
  const flags = getRoleFlags(user);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [executiveAnalytics, setExecutiveAnalytics] = useState<any>(null);
  const [comprehensive, setComprehensive] = useState<any>(null);

  // Start Day / End Day for field and office staff, trainers included.
  const showAttendance =
    flags.isTrainer ||
    (flags.isEmployee ||
      flags.isExecutive ||
      flags.isManager ||
      flags.isCoordinator ||
      flags.isSeniorCoordinator ||
      flags.isExecutiveManager);

  const showLeaveActions = !flags.isAdmin && !flags.isExecutiveManager;

  const hierarchyLevel = flags.isRegionalManager
    ? 'regional-manager'
    : flags.isRegionalHead
      ? 'regional-head'
      : flags.isNationalHead
        ? 'national-head'
        : null;

  const load = useCallback(async () => {
    // Partner / Vendor use their own dashboard (PartnerDashboard) — no CRM / DC figures are loaded.
    if (hierarchyLevel || flags.isManager || flags.isPartner) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const statsData = await apiService.get('/dashboard/stats').catch(() => null);
      setStats(statsData);

      if (flags.isExecutive) {
        const ex = await apiService.get('/dashboard/executive-analytics').catch(() => null);
        setExecutiveAnalytics(ex);
        setComprehensive(null);
      } else if (!flags.isPartner) {
        const comp = await apiService.get('/dashboard/comprehensive-analytics').catch(() => null);
        setComprehensive(comp);
        setExecutiveAnalytics(null);
      } else {
        setExecutiveAnalytics(null);
        setComprehensive(null);
      }
    } catch (e) {
      console.warn('Dashboard load error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [flags.isExecutive, flags.isPartner, flags.isManager, hierarchyLevel]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const hot =
    executiveAnalytics?.leads?.byPriority?.find((p: any) => p._id === 'Hot')?.count ?? 0;
  const warm =
    executiveAnalytics?.leads?.byPriority?.find((p: any) => p._id === 'Warm')?.count ?? 0;
  const cold =
    executiveAnalytics?.leads?.byPriority?.find((p: any) => p._id === 'Cold')?.count ?? 0;

  if (flags.isPartner) {
    return <PartnerDashboard userName={user?.name} role={user?.role} />;
  }

  if (flags.isManager && user?._id) {
    return (
      <View style={styles.container}>
        <BirthdayWishCard role={user?.role} style={styles.wishWrap} />
        <ProductManagerScreen embedded managerId={user._id} navigation={navigation} header={<AttendanceCard />} />
      </View>
    );
  }

  if (hierarchyLevel && user?._id) {
    return (
      <View style={styles.container}>
        <BirthdayWishCard role={user?.role} style={styles.wishWrap} />
        <HierarchyDashboardScreen
          embedded
          level={hierarchyLevel}
          personId={user._id}
          navigation={navigation}
        />
      </View>
    );
  }

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

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Start Day / End Day first, so End Day is always at the top. */}
          {showAttendance ? (
            <View style={styles.block}>
              <AttendanceCard />
            </View>
          ) : null}
          <BirthdayWishCard role={user?.role} />
          <EmployeeBirthdaysCard role={user?.role} />
          <PendingAdvanceApprovalsCard />

          {flags.isAdmin ? (
            <>
              <Text style={styles.sectionHeading}>Quick actions</Text>
              <View style={styles.grid}>
                {(flags.isSuperAdmin ? SUPER_ADMIN_QUICK : ADMIN_QUICK).map((q) => (
                  <QuickTile key={q.screen} q={q} onPress={() => navigateRoot(q.screen)} />
                ))}
              </View>
            </>
          ) : null}

          {flags.isExecutiveManager ? (
            <>
              <Text style={styles.sectionHeading}>Quick actions</Text>
              <View style={styles.grid}>
                {EM_QUICK.map((q) => (
                  <QuickTile
                    key={q.screen}
                    q={q}
                    onPress={() =>
                      navigateRoot(
                        q.screen,
                        q.screen === 'ExecutiveManagerDashboard' || q.screen === 'ExecutiveManagerLeaves'
                          ? { managerId: user?._id }
                          : undefined
                      )
                    }
                  />
                ))}
              </View>
            </>
          ) : null}

          {showLeaveActions ? (
            <>
              <Text style={styles.sectionHeading}>Leaves</Text>
              <View style={styles.grid}>
                {LEAVE_QUICK.map((q) => (
                  <QuickTile key={q.screen} q={q} onPress={() => navigateRoot(q.screen)} />
                ))}
              </View>
            </>
          ) : null}

          <Text style={styles.sectionHeading}>Overview</Text>
          <View style={styles.grid}>
            {DASHBOARD_STAT_ICONS.map((c) => (
              <StatCard
                key={c.key}
                label={c.label}
                value={stats?.[c.key as keyof DashboardStats] ?? 0}
                ion={c.ion}
                color={c.color}
                bg={c.bg}
              />
            ))}
          </View>

          {flags.isExecutive && executiveAnalytics ? (
            <>
              <Text style={styles.sectionHeading}>My leads breakdown</Text>
              <View style={styles.grid}>
                <StatCard label="Hot Leads" value={hot} ion="flame-outline" color="#DC2626" bg="#FEE2E2" />
                <StatCard label="Warm Leads" value={warm} ion="thermometer-outline" color="#D97706" bg="#FFFBEB" />
                <StatCard label="Cold Leads" value={cold} ion="snow-outline" color="#0284C7" bg="#EFF6FF" />
                <StatCard
                  label="Conversion"
                  value={
                    executiveAnalytics.leads?.total
                      ? `${Math.round(
                          ((executiveAnalytics.leads?.closed ?? 0) / executiveAnalytics.leads.total) *
                            100
                        )}%`
                      : '0%'
                  }
                  ion="analytics-outline"
                  color="#7C3AED"
                  bg="#EDE9FE"
                />
              </View>
            </>
          ) : null}

          <TouchableOpacity style={styles.workCta} onPress={() => navigation?.navigate?.('Menu')} activeOpacity={0.85}>
            <PremiumIcon name="grid-outline" color="#FFFFFF" bg="rgba(255,255,255,0.2)" size={20} />
            <View style={styles.workCtaText}>
              <Text style={styles.workCtaTitle}>Open Menu</Text>
              <Text style={styles.workCtaSub} numberOfLines={1}>
                All modules: Leads, DC, Warehouse, Reports
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  logo: { width: 44, height: 44, marginRight: 12 },
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundLight,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  headerText: { flex: 1 },
  greeting: { fontSize: 13, color: colors.textTertiary },
  userName: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginTop: 2 },
  roleBadge: {
    marginLeft: 8,
    maxWidth: 150,
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  roleText: { fontSize: 12, fontWeight: '700', color: colors.primaryDark },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16, paddingBottom: 48 },
  block: { marginBottom: 4 },
  wishWrap: { marginHorizontal: 16, marginTop: 12, marginBottom: 4 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tile: {
    width: '48.5%',
    minHeight: 104,
    backgroundColor: colors.backgroundLight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    padding: 12,
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  tileTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginTop: 10 },
  tileSub: { fontSize: 13, color: colors.textTertiary, marginTop: 2 },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 8,
  },
  workCta: {
    marginTop: 8,
    backgroundColor: colors.primaryDark,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  workCtaText: { flex: 1 },
  workCtaTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  workCtaSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2 },
});
