import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import AttendanceCard from '../../components/AttendanceCard';
import { Ionicons } from '@expo/vector-icons';
import StatCard from '../../components/dashboard/StatCard';
import SimpleBarChart from '../../components/dashboard/SimpleBarChart';
import PremiumIcon from '../../components/ui/PremiumIcon';
import { apiService } from '../../services/api';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { navigateRoot } from '../../navigation/navigationRef';
import { getRoleFlags } from '../../utils/roles';
import HierarchyDashboardScreen from '../Hierarchy/HierarchyDashboardScreen';
import ProductManagerScreen from '../ProductManager/ProductManagerScreen';
import { fmtINR, sumAggAmount, sumAggCount } from '../../utils/format';
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

type TrendPoint = { name: string; leads: number; sales: number; revenue: number };
type ZonePoint = { zone: string; total: number; hot?: number; warm?: number; cold?: number };

const ADMIN_QUICK = [
  { label: 'Add Lead', screen: 'LeadAdd', ion: 'person-add-outline' as const, color: '#16A34A', bg: '#DCFCE7' },
  { label: 'All Leads', screen: 'LeadsList', ion: 'list-outline' as const, color: '#2563EB', bg: '#DBEAFE' },
  { label: 'Create Sale', screen: 'DCCreateSale', ion: 'add-circle-outline' as const, color: '#059669', bg: '#D1FAE5' },
  { label: 'Reports', screen: 'ReportsLeads', ion: 'bar-chart-outline' as const, color: '#7C3AED', bg: '#EDE9FE' },
];

const SUPER_ADMIN_QUICK = ADMIN_QUICK.filter(
  (q) => q.screen !== 'LeadAdd' && q.screen !== 'LeadsList',
);

const EM_QUICK = [
  { label: 'My Dashboard', screen: 'ExecutiveManagerDashboard', ion: 'home-outline' as const, color: '#2563EB', bg: '#DBEAFE' },
  { label: 'Executives', screen: 'ExecutiveManagerExecutives', ion: 'people-outline' as const, color: '#059669', bg: '#D1FAE5' },
  { label: 'PO Edit Request', screen: 'ClientsClosedSales', ion: 'document-text-outline' as const, color: '#7C3AED', bg: '#EDE9FE' },
  { label: 'Pending Expenses', screen: 'ExpenseExecutiveManagerPending', ion: 'time-outline' as const, color: '#D97706', bg: '#FEF3C7' },
  { label: 'Leave Management', screen: 'ExecutiveManagerLeaves', ion: 'calendar-outline' as const, color: '#0D9488', bg: '#CCFBF1' },
];

export default function DashboardScreen({ navigation }: { navigation?: any }) {
  const { user } = useAuth();
  const flags = getRoleFlags(user);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [zones, setZones] = useState<ZonePoint[]>([]);
  const [executiveAnalytics, setExecutiveAnalytics] = useState<any>(null);
  const [comprehensive, setComprehensive] = useState<any>(null);

  // Web CRM has no field check-in/out for trainers; mobile attendance matches executive/employee roles.
  const showAttendance =
    !flags.isTrainer &&
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
    if (hierarchyLevel || flags.isManager) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const [statsData, trendsData, zonesData] = await Promise.all([
        apiService.get('/dashboard/stats').catch(() => null),
        apiService.get('/dashboard/revenue-trends').catch(() => []),
        apiService.get('/dashboard/leads-by-zone').catch(() => []),
      ]);
      setStats(statsData);
      setTrends(Array.isArray(trendsData) ? trendsData : []);
      setZones(Array.isArray(zonesData) ? zonesData : []);

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

  const financialKpis = () => {
    if (flags.isExecutive && executiveAnalytics) {
      const revenue = executiveAnalytics.payments?.totalAmount ?? 0;
      const expenses = executiveAnalytics.expenses?.totalAmount ?? 0;
      const totalLeads = executiveAnalytics.leads?.total ?? 0;
      const closed = executiveAnalytics.leads?.closed ?? 0;
      return {
        totalLeads,
        closedLabel: `${closed} closed (${totalLeads ? Math.round((closed / totalLeads) * 100) : 0}%)`,
        revenue,
        revenueSub: `${executiveAnalytics.payments?.total ?? 0} payments`,
        expenses,
        expensesSub: `${executiveAnalytics.expenses?.total ?? 0} expenses`,
        netProfit: revenue - expenses,
        sales: executiveAnalytics.sales?.total ?? stats?.totalSales ?? 0,
        salesSub: `${executiveAnalytics.sales?.completed ?? 0} completed`,
      };
    }
    if (comprehensive) {
      const totalLeads = sumAggCount(comprehensive.leads?.byStatus);
      const revenue = sumAggAmount(comprehensive.payments?.byStatus);
      const expenses = sumAggAmount(comprehensive.expenses?.byStatus);
      const sales = sumAggCount(comprehensive.sales?.byStatus);
      return {
        totalLeads,
        closedLabel: 'All statuses',
        revenue,
        revenueSub: 'All payments',
        expenses,
        expensesSub: 'All expenses',
        netProfit: revenue - expenses,
        sales: sales || stats?.totalSales || 0,
        salesSub: 'DC / sales',
      };
    }
    return {
      totalLeads: stats?.activeLeads ?? 0,
      closedLabel: 'Active pipeline',
      revenue: 0,
      revenueSub: '—',
      expenses: 0,
      expensesSub: '—',
      netProfit: 0,
      sales: stats?.totalSales ?? 0,
      salesSub: 'Total sales',
    };
  };

  const kpis = financialKpis();
  const hot =
    executiveAnalytics?.leads?.byPriority?.find((p: any) => p._id === 'Hot')?.count ?? 0;
  const warm =
    executiveAnalytics?.leads?.byPriority?.find((p: any) => p._id === 'Warm')?.count ?? 0;
  const cold =
    executiveAnalytics?.leads?.byPriority?.find((p: any) => p._id === 'Cold')?.count ?? 0;

  if (flags.isManager && user?._id) {
    return <ProductManagerScreen embedded managerId={user._id} navigation={navigation} />;
  }

  if (hierarchyLevel && user?._id) {
    return (
      <HierarchyDashboardScreen
        embedded
        level={hierarchyLevel}
        personId={user._id}
        navigation={navigation}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.userName}>{user?.name?.split(' ')[0] || 'User'}</Text>
          <View style={styles.roleBadge}>
            <View style={styles.roleDot} />
            <Text style={styles.roleText}>{user?.role || 'User'}</Text>
            </View>
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
          {showAttendance ? (
            <View style={styles.block}>
              <AttendanceCard />
              </View>
          ) : null}

          {flags.isAdmin ? (
            <>
              <Text style={styles.sectionHeading}>Quick actions</Text>
              <View style={styles.quickRow}>
                {(flags.isSuperAdmin ? SUPER_ADMIN_QUICK : ADMIN_QUICK).map((q) => (
        <TouchableOpacity
                    key={q.screen}
                    style={[styles.quickCard, { backgroundColor: q.bg }]}
                    onPress={() => navigateRoot(q.screen)}
                  >
                    <PremiumIcon name={q.ion} color={q.color} bg="#FFFFFF" size={20} />
                    <Text style={styles.quickLabel}>{q.label}</Text>
                    <Ionicons name="chevron-forward" size={16} color={q.color} style={styles.quickChevron} />
        </TouchableOpacity>
                ))}
            </View>
            </>
          ) : null}

          {flags.isExecutiveManager ? (
            <>
              <Text style={styles.sectionHeading}>Quick actions</Text>
              <View style={styles.quickRow}>
                {EM_QUICK.map((q) => (
        <TouchableOpacity
                    key={q.screen}
                    style={[styles.quickCard, { backgroundColor: q.bg }]}
                    onPress={() =>
                      navigateRoot(
                        q.screen,
                        q.screen === 'ExecutiveManagerDashboard' || q.screen === 'ExecutiveManagerLeaves'
                          ? { managerId: user?._id }
                          : undefined
                      )
                    }
                  >
                    <PremiumIcon name={q.ion} color={q.color} bg="#FFFFFF" size={20} />
                    <Text style={styles.quickLabel}>{q.label}</Text>
                    <Ionicons name="chevron-forward" size={16} color={q.color} style={styles.quickChevron} />
        </TouchableOpacity>
                ))}
            </View>
            </>
          ) : null}

          {showLeaveActions ? (
            <View style={styles.leaveRow}>
        <TouchableOpacity
                style={[styles.leaveCard, { backgroundColor: '#EDE9FE' }]}
                onPress={() => navigateRoot('LeaveRequest')}
              >
                <PremiumIcon name="paper-plane-outline" color="#7C3AED" bg="#FFFFFF" size={20} />
                <Text style={styles.leaveTitle}>Apply for Leave</Text>
                <Text style={styles.leaveSub}>Submit a new request</Text>
                <Ionicons name="chevron-forward" size={18} color="#7C3AED" style={styles.cardChevron} />
        </TouchableOpacity>
        <TouchableOpacity
                style={[styles.leaveCard, { backgroundColor: '#CCFBF1' }]}
                onPress={() => navigateRoot('LeavesApproved')}
              >
                <PremiumIcon name="calendar-outline" color="#0D9488" bg="#FFFFFF" size={20} />
                <Text style={styles.leaveTitle}>My Leaves</Text>
                <Text style={styles.leaveSub}>View leave history</Text>
                <Ionicons name="chevron-forward" size={18} color="#0D9488" style={styles.cardChevron} />
        </TouchableOpacity>
      </View>
          ) : null}

          <Text style={styles.sectionHeading}>Overview</Text>
          <View style={styles.statGrid}>
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

          <Text style={styles.sectionHeading}>Financial snapshot</Text>
          <View style={styles.kpiRow}>
            <View style={[styles.kpiCard, styles.kpiBlue]}>
              <Text style={styles.kpiLabel}>Total Leads</Text>
              <Text style={styles.kpiValue}>{kpis.totalLeads}</Text>
              <Text style={styles.kpiSub}>{kpis.closedLabel}</Text>
            </View>
            <View style={[styles.kpiCard, styles.kpiGreen]}>
              <Text style={styles.kpiLabel}>Revenue</Text>
              <Text style={styles.kpiValue}>{fmtINR(kpis.revenue)}</Text>
              <Text style={styles.kpiSub}>{kpis.revenueSub}</Text>
          </View>
        </View>
          <View style={styles.kpiRow}>
            <View style={[styles.kpiCard, styles.kpiRed]}>
              <Text style={styles.kpiLabel}>Expenses</Text>
              <Text style={styles.kpiValue}>{fmtINR(kpis.expenses)}</Text>
              <Text style={styles.kpiSub}>{kpis.expensesSub}</Text>
              </View>
            <View style={[styles.kpiCard, styles.kpiProfit]}>
              <Text style={styles.kpiLabel}>Net Profit</Text>
              <Text style={styles.kpiValue}>{fmtINR(kpis.netProfit)}</Text>
              <Text style={styles.kpiSub}>Revenue − Expenses</Text>
              </View>
              </View>
          <View style={styles.kpiRow}>
            <View style={[styles.kpiCard, styles.kpiPink, { flex: 1 }]}>
              <Text style={styles.kpiLabel}>Total Sales</Text>
              <Text style={styles.kpiValue}>{kpis.sales}</Text>
              <Text style={styles.kpiSub}>{kpis.salesSub}</Text>
            </View>
      </View>

          {flags.isExecutive && executiveAnalytics ? (
            <>
              <Text style={styles.sectionHeading}>My leads breakdown</Text>
              <View style={styles.statGrid}>
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

          {trends.length > 0 ? (
            <SimpleBarChart
              title="Revenue trend"
              subtitle="Week-over-week (same as web)"
              labels={trends.map((t) => t.name)}
              values={trends.map((t) => t.revenue)}
              valueFormatter={(n) => fmtINR(n)}
            />
          ) : null}

          {zones.length > 0 ? (
            <SimpleBarChart
              title="Leads by zone"
              subtitle="Distribution across zones"
              labels={zones.map((z) => z.zone || 'Other')}
              values={zones.map((z) => z.total)}
            />
          ) : null}

          <TouchableOpacity 
            style={styles.workCta}
            onPress={() => navigation?.navigate?.('Menu')}
          >
            <View style={styles.workCtaRow}>
              <PremiumIcon name="grid-outline" color="#FFFFFF" bg="rgba(255,255,255,0.2)" size={22} />
              <View style={styles.workCtaText}>
                <Text style={styles.workCtaTitle}>Open Menu</Text>
                <Text style={styles.workCtaSub}>All modules (Leads, DC, Warehouse, Reports…)</Text>
            </View>
              <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
        </View>
        </TouchableOpacity>
      </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: colors.backgroundLight,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  greeting: { ...typography.body.medium, color: colors.textSecondary },
  userName: { ...typography.heading.h1, color: colors.textPrimary, marginTop: 4 },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: colors.successLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  roleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginRight: 6 },
  roleText: { fontSize: 12, fontWeight: '600', color: colors.primaryDark },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16, paddingBottom: 48 },
  block: { marginBottom: 8 },
  leaveRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  quickCard: {
    width: '47%',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    minHeight: 88,
  },
  quickLabel: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginTop: 10 },
  quickChevron: { position: 'absolute', top: 14, right: 12 },
  leaveCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    paddingRight: 36,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  cardChevron: { position: 'absolute', top: 16, right: 12 },
  leaveTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginTop: 10, paddingRight: 4 },
  leaveSub: { fontSize: 12, color: colors.textSecondary, marginTop: 4, paddingRight: 4, lineHeight: 16 },
  sectionHeading: {
    ...typography.heading.h3,
    color: colors.textPrimary,
    marginBottom: 12,
    marginTop: 8,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  kpiCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  kpiBlue: { backgroundColor: '#DBEAFE', borderColor: '#93C5FD' },
  kpiGreen: { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' },
  kpiRed: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
  kpiProfit: { backgroundColor: '#D1FAE5', borderColor: '#6EE7B7' },
  kpiPink: { backgroundColor: '#FCE7F3', borderColor: '#F9A8D4' },
  kpiLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', color: '#525252' },
  kpiValue: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginTop: 6 },
  kpiSub: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
  workCta: {
    marginTop: 16,
    backgroundColor: colors.primary,
    borderRadius: 14,
    padding: 16,
  },
  workCtaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  workCtaText: { flex: 1 },
  workCtaTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  workCtaSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 },
});
