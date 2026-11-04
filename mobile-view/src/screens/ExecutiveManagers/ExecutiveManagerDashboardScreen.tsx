import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebLabel } from '../../ui/WebPrimitives';
import { Card, CardTitle, InfoRow, ChipRow, ActionRow, EmptyState } from '../../ui/Kit';
import StatCard from '../../components/dashboard/StatCard';
import SimpleBarChart from '../../components/dashboard/SimpleBarChart';
import GroupedBarChart from '../../components/dashboard/GroupedBarChart';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { showAlert } from '../../utils/showAlert';
import { getRoleFlags } from '../../utils/roles';

import DateField from '../../ui/DateField';
type EmployeeDetail = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  assignedCity?: string;
  assignedArea?: string;
  role: string;
  department?: string;
  totalLeads: number;
  totalDCs: number;
  totalSales: number;
  totalLeaves: number;
  pendingLeaves: number;
};

type DashboardData = {
  totalEmployees: number;
  managerState?: string | null;
  employeesByZone: Record<string, number>;
  employeesByArea: Record<string, number>;
  totalLeads: number;
  leadsByStatus: Record<string, number>;
  totalDCs: number;
  dcsByStatus: Record<string, number>;
  totalSales: number;
  totalLeaves: number;
  leavesByStatus: Record<string, number>;
  employeeDetails: EmployeeDetail[];
};

type TabKey = 'dashboard' | 'leads' | 'analytics' | 'ai';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'leads', label: 'Leads Dashboard' },
  { key: 'analytics', label: 'Comprehensive Analytics' },
  { key: 'ai', label: 'AI Mode' },
];

const STATUS_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

function shortName(name: string) {
  const parts = (name || '').trim().split(/\s+/);
  if (!parts[0]) return 'N/A';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1].charAt(0)}.`;
}

function StatusList({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: { label: string; count: number }[];
}) {
  const total = items.reduce((s, i) => s + i.count, 0) || 1;
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      {items.length === 0 ? (
        <Text style={styles.emptyHint}>No data</Text>
      ) : (
        items.map((item, idx) => {
          const pct = Math.round((item.count / total) * 100);
          return (
            <View key={item.label} style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[idx % STATUS_COLORS.length] }]} />
              <Text style={styles.statusLabel} numberOfLines={1}>
                {item.label}
              </Text>
              <View style={styles.statusTrack}>
                <View
                  style={[
                    styles.statusFill,
                    {
                      width: `${Math.max(4, pct)}%`,
                      backgroundColor: STATUS_COLORS[idx % STATUS_COLORS.length],
                    },
                  ]}
                />
              </View>
              <Text style={styles.statusCount}>
                {item.count} ({pct}%)
              </Text>
            </View>
          );
        })
      )}
    </View>
  );
}

export default function ExecutiveManagerDashboardScreen({ navigation, route }: any) {
  const { user } = useAuth();
  const flags = getRoleFlags(user);
  const managerId = route.params?.managerId || user?._id;
  const isOwnDashboard = !!user?._id && String(user._id) === String(managerId);
  const canManageTeam = flags.isAdmin || flags.isSuperAdmin || flags.isExecutiveManager;

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [zoneModalEmp, setZoneModalEmp] = useState<EmployeeDetail | null>(null);
  const [zoneInput, setZoneInput] = useState('');
  const [assigningZone, setAssigningZone] = useState(false);
  const [empSearch, setEmpSearch] = useState('');

  const loadDashboard = useCallback(async () => {
    if (!managerId) {
      setLoading(false);
      showAlert('Error', 'Manager id is missing');
      return;
    }
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      const qs = params.toString();
      const url = `/executive-managers/${managerId}/dashboard${qs ? `?${qs}` : ''}`;
      const res = await apiService.get<DashboardData>(url);
      setData(res);
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to load dashboard data');
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [managerId, fromDate, toDate]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard]),
  );

  const employees = data?.employeeDetails || [];

  const avgLeadsPerEmployee = useMemo(() => {
    if (!employees.length) return 0;
    return Math.round(employees.reduce((s, e) => s + (e.totalLeads || 0), 0) / employees.length);
  }, [employees]);

  const avgSalesPerEmployee = useMemo(() => {
    if (!employees.length) return 0;
    return Math.round(employees.reduce((s, e) => s + (e.totalSales || 0), 0) / employees.length);
  }, [employees]);

  const leadConversionRate = useMemo(() => {
    if (!data?.totalLeads) return 0;
    const closed =
      (data.leadsByStatus?.Closed || 0) + (data.leadsByStatus?.Saved || 0);
    return Math.round((closed / data.totalLeads) * 100);
  }, [data]);

  const topByLeads = useMemo(
    () => [...employees].sort((a, b) => b.totalLeads - a.totalLeads),
    [employees],
  );
  const topBySales = useMemo(
    () => [...employees].sort((a, b) => b.totalSales - a.totalSales),
    [employees],
  );
  const topByDCs = useMemo(
    () => [...employees].sort((a, b) => b.totalDCs - a.totalDCs),
    [employees],
  );

  const avgDCsPerEmployee = useMemo(() => {
    if (!employees.length) return 0;
    return Math.round(employees.reduce((s, e) => s + (e.totalDCs || 0), 0) / employees.length);
  }, [employees]);

  const byActivity = useMemo(
    () =>
      [...employees]
        .map((e) => ({
          ...e,
          totalActivity: (e.totalLeads || 0) + (e.totalDCs || 0) + (e.totalSales || 0),
        }))
        .sort((a, b) => b.totalActivity - a.totalActivity),
    [employees],
  );

  /** Employee list search: every typed word must appear in a visible field. */
  const shownEmployees = useMemo(() => {
    const words = empSearch.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return byActivity;
    return byActivity.filter((e) => {
      const text = [e.name, e.email, e.phone, e.role, e.department, e.assignedCity, e.assignedArea]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return words.every((w) => text.includes(w));
    });
  }, [byActivity, empSearch]);

  const avgActivity = useMemo(() => {
    if (!employees.length) return 0;
    return Math.round(
      employees.reduce(
        (s, e) => s + (e.totalLeads || 0) + (e.totalDCs || 0) + (e.totalSales || 0),
        0,
      ) / employees.length,
    );
  }, [employees]);

  const highPerformers = employees.filter((e) => {
    const activity = (e.totalLeads || 0) + (e.totalDCs || 0) + (e.totalSales || 0);
    return activity > avgActivity;
  }).length;
  const needsSupport = employees.filter((e) => {
    const activity = (e.totalLeads || 0) + (e.totalDCs || 0) + (e.totalSales || 0);
    return activity === 0;
  }).length;

  const closedLeads =
    (data?.leadsByStatus?.Closed || 0) + (data?.leadsByStatus?.Saved || 0);

  const assignZone = async () => {
    if (!zoneModalEmp || !zoneInput.trim()) {
      showAlert('Validation', 'Enter a zone (city)');
      return;
    }
    setAssigningZone(true);
    try {
      await apiService.put('/executive-managers/assign-zone', {
        employeeId: zoneModalEmp._id,
        zone: zoneInput.trim(),
      });
      showAlert('Success', `Zone assigned to ${zoneModalEmp.name}`);
      setZoneModalEmp(null);
      setZoneInput('');
      loadDashboard();
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to assign zone');
    } finally {
      setAssigningZone(false);
    }
  };

  const mostActiveZone = useMemo(() => {
    const zoneMap: Record<string, { employees: number; activity: number }> = {};
    employees.forEach((e) => {
      const z = e.assignedCity || 'N/A';
      if (!zoneMap[z]) zoneMap[z] = { employees: 0, activity: 0 };
      zoneMap[z].employees += 1;
      zoneMap[z].activity += (e.totalLeads || 0) + (e.totalDCs || 0) + (e.totalSales || 0);
    });
    const entries = Object.entries(zoneMap).sort((a, b) => b[1].activity - a[1].activity);
    if (!entries.length) return { name: 'N/A', employees: 0, activity: 0 };
    const [name, info] = entries[0];
    return { name, employees: info.employees, activity: info.activity };
  }, [employees]);

  const maxLeads = Math.max(...employees.map((e) => e.totalLeads || 0), 1);
  const maxSales = Math.max(...employees.map((e) => e.totalSales || 0), 1);
  const maxDCs = Math.max(...employees.map((e) => e.totalDCs || 0), 1);

  const sortedForChart = useMemo(
    () =>
      [...employees].sort(
        (a, b) =>
          b.totalLeads + b.totalDCs + b.totalSales - (a.totalLeads + a.totalDCs + a.totalSales),
      ),
    [employees],
  );

  const leadsByStatus = useMemo(
    () =>
      Object.entries(data?.leadsByStatus || {}).map(([label, count]) => ({
        label,
        count: Number(count) || 0,
      })),
    [data],
  );

  const dcsByStatus = useMemo(
    () =>
      Object.entries(data?.dcsByStatus || {}).map(([label, count]) => ({
        label,
        count: Number(count) || 0,
      })),
    [data],
  );

  const leavesByStatus = useMemo(
    () =>
      Object.entries(data?.leavesByStatus || {}).map(([label, count]) => ({
        label,
        count: Number(count) || 0,
      })),
    [data],
  );

  const zoneItems = useMemo(
    () =>
      Object.entries(data?.employeesByZone || {}).map(([zone, count]) => ({
        label: zone || 'Unassigned',
        count: Number(count) || 0,
      })),
    [data],
  );

  const highThreshold = Math.round(avgLeadsPerEmployee * 1.5);
  const midLow = Math.round(avgLeadsPerEmployee * 0.5);
  const highlyActive = employees.filter((e) => e.totalLeads > avgLeadsPerEmployee * 1.5).length;
  const moderatelyActive = employees.filter(
    (e) => e.totalLeads >= avgLeadsPerEmployee * 0.5 && e.totalLeads <= avgLeadsPerEmployee * 1.5,
  ).length;
  const needsAttention = employees.filter(
    (e) => e.totalLeads < avgLeadsPerEmployee * 0.5 && e.totalLeads >= 0,
  ).length;

  const activeExecutives = employees.filter(
    (e) => e.totalLeads > 0 || e.totalDCs > 0 || e.totalSales > 0,
  ).length;

  const pendingLeaves = data?.leavesByStatus?.Pending || 0;
  const leaveSub =
    Object.values(data?.leavesByStatus || {}).reduce((s, n) => s + (Number(n) || 0), 0) > 0
      ? `${pendingLeaves} pending`
      : 'All cleared';

  const headerActions = (
    <View style={styles.headerActions}>
      {canManageTeam ? (
        <TouchableOpacity
          style={styles.headerBtnPrimary}
          onPress={() => navigation.navigate('ExecutiveManagerExecutives')}
        >
          <Text style={styles.headerBtnPrimaryText}>Team</Text>
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity
        style={styles.headerBtn}
        onPress={() => navigation.navigate('ExecutiveManagerLeaves', { managerId })}
      >
        <Text style={styles.headerBtnText}>Leaves</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScreenShell
      title="Executive Manager Dashboard"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        loadDashboard();
      }}
      showBack={!isOwnDashboard || flags.isAdmin}
      headerRight={headerActions}
      noScroll
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadDashboard();
            }}
          />
        }
      >
        {data?.managerState ? (
          <Text style={styles.stateBadge}>State: {data.managerState}</Text>
        ) : null}

        <PageSection title="Date range">
          <View style={styles.filters}>
            <View style={styles.filterCol}>
              <WebLabel>From</WebLabel>
              <DateField placeholder="From Date" value={fromDate} onChange={setFromDate} />
            </View>
            <View style={styles.filterCol}>
              <WebLabel>To</WebLabel>
              <DateField placeholder="To Date" value={toDate} onChange={setToDate} />
            </View>
          </View>
          <View style={styles.filterActions}>
            <View style={{ flex: 1 }}>
              <WebButton title="Apply" onPress={loadDashboard} />
            </View>
            <View style={{ flex: 1 }}>
              <WebButton
                title="Clear Filters"
                variant="outline"
                onPress={async () => {
                  setFromDate('');
                  setToDate('');
                  if (!managerId) return;
                  try {
                    setLoading(true);
                    const res = await apiService.get<DashboardData>(
                      `/executive-managers/${managerId}/dashboard`,
                    );
                    setData(res);
                  } catch (error: any) {
                    showAlert('Error', error.message || 'Failed to load dashboard data');
                  } finally {
                    setLoading(false);
                  }
                }}
              />
            </View>
          </View>
        </PageSection>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
          <ChipRow
            items={TABS.map((t) => ({ key: t.key, label: t.label }))}
            value={activeTab}
            onChange={(k) => setActiveTab(k as TabKey)}
          />
        </ScrollView>

        {!data ? (
          <EmptyState icon="📊" title="No dashboard data" message="Pull down to refresh or change the dates." />
        ) : (
          <>
            {(activeTab === 'dashboard' || activeTab === 'analytics') && (
              <>
                <View style={styles.statGrid}>
                  <StatCard
                    label="Total Employees"
                    value={data.totalEmployees}
                    ion="people-outline"
                    color="#1D4ED8"
                    bg="#DBEAFE"
                  />
                  <StatCard
                    label="Total Leads"
                    value={data.totalLeads}
                    subtitle={`${leadConversionRate}% converted`}
                    ion="trending-up-outline"
                    color="#047857"
                    bg="#D1FAE5"
                  />
                  <StatCard
                    label="Total DCs"
                    value={data.totalDCs}
                    ion="cube-outline"
                    color="#C2410C"
                    bg="#FFEDD5"
                  />
                  <StatCard
                    label="Total Sales"
                    value={data.totalSales}
                    ion="cart-outline"
                    color="#7C3AED"
                    bg="#EDE9FE"
                  />
                  <StatCard
                    label="Total Leaves"
                    value={data.totalLeaves}
                    subtitle={leaveSub}
                    ion="calendar-outline"
                    color="#B91C1C"
                    bg="#FEE2E2"
                  />
                  <StatCard
                    label="Avg/Employee"
                    value={`${avgLeadsPerEmployee} Leads`}
                    subtitle={`${avgSalesPerEmployee} Sales`}
                    ion="bar-chart-outline"
                    color="#0E7490"
                    bg="#CFFAFE"
                  />
                </View>

                <View style={styles.statGrid}>
                  <StatCard
                    label="Active Executives"
                    value={activeExecutives}
                    subtitle={`out of ${data.totalEmployees} executives`}
                    ion="people-circle-outline"
                    color="#1D4ED8"
                    bg="#DBEAFE"
                  />
                  <StatCard
                    label="Most Active Today"
                    value={shortName(topByLeads[0]?.name || 'N/A')}
                    subtitle={`${topByLeads[0]?.totalLeads || 0} leads generated`}
                    ion="flash-outline"
                    color="#047857"
                    bg="#D1FAE5"
                  />
                  <StatCard
                    label="Top Sales Executive"
                    value={shortName(topBySales[0]?.name || 'N/A')}
                    subtitle={`${topBySales[0]?.totalSales || 0} sales closed`}
                    ion="trophy-outline"
                    color="#7C3AED"
                    bg="#EDE9FE"
                  />
                  <StatCard
                    label="Team Efficiency"
                    value={`${leadConversionRate}%`}
                    subtitle="Lead conversion rate"
                    ion="analytics-outline"
                    color="#C2410C"
                    bg="#FFEDD5"
                  />
                </View>
              </>
            )}

            {activeTab === 'dashboard' && (
              <>
                {sortedForChart.length > 0 ? (
                  <GroupedBarChart
                    title="Executive Performance Comparison"
                    subtitle="Detailed comparison of all executives' activities and performance"
                    labels={sortedForChart.map((e) => shortName(e.name))}
                    datasets={[
                      {
                        label: 'Leads',
                        data: sortedForChart.map((e) => e.totalLeads || 0),
                        color: '#3b82f6',
                      },
                      {
                        label: 'DCs',
                        data: sortedForChart.map((e) => e.totalDCs || 0),
                        color: '#f59e0b',
                      },
                      {
                        label: 'Sales',
                        data: sortedForChart.map((e) => e.totalSales || 0),
                        color: '#a855f7',
                      },
                    ]}
                  />
                ) : null}

                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Employee Activity Distribution</Text>
                  <Text style={styles.sectionSubtitle}>Workload and activity levels across team</Text>
                  <View style={styles.activityRow}>
                    <View style={styles.activityCard}>
                      <Text style={styles.activityLabel}>Highly Active</Text>
                      <Text style={[styles.activityValue, { color: '#1D4ED8' }]}>{highlyActive}</Text>
                      <Text style={styles.activitySub}>Above {highThreshold} leads</Text>
                    </View>
                    <View style={styles.activityCard}>
                      <Text style={styles.activityLabel}>Moderately Active</Text>
                      <Text style={[styles.activityValue, { color: '#047857' }]}>{moderatelyActive}</Text>
                      <Text style={styles.activitySub}>
                        Between {midLow}-{highThreshold} leads
                      </Text>
                    </View>
                    <View style={styles.activityCard}>
                      <Text style={styles.activityLabel}>Needs Attention</Text>
                      <Text style={[styles.activityValue, { color: '#C2410C' }]}>{needsAttention}</Text>
                      <Text style={styles.activitySub}>Below {midLow} leads</Text>
                    </View>
                  </View>
                </View>

                <StatusList
                  title="Team Leads by Status"
                  subtitle="Current status distribution of all leads"
                  items={leadsByStatus}
                />
                <StatusList
                  title="Sales & DCs Status"
                  subtitle="Distribution of DCs by status"
                  items={dcsByStatus}
                />

                <SimpleBarChart
                  title="Top Employees by Leads"
                  subtitle="Leading lead generators"
                  labels={topByLeads.slice(0, 5).map((e) => shortName(e.name))}
                  values={topByLeads.slice(0, 5).map((e) => e.totalLeads || 0)}
                  barColor="#3b82f6"
                />
                <SimpleBarChart
                  title="Top Employees by Sales"
                  subtitle="Best sales performers"
                  labels={topBySales.slice(0, 5).map((e) => shortName(e.name))}
                  values={topBySales.slice(0, 5).map((e) => e.totalSales || 0)}
                  barColor="#a855f7"
                />
                <SimpleBarChart
                  title="Top Employees by DCs"
                  subtitle="DC generation leaders"
                  labels={topByDCs.slice(0, 5).map((e) => shortName(e.name))}
                  values={topByDCs.slice(0, 5).map((e) => e.totalDCs || 0)}
                  barColor="#f59e0b"
                />
              </>
            )}

            {activeTab === 'leads' && (
              <>
                <View style={styles.statGrid}>
                  <StatCard
                    label="Total Leads"
                    value={data.totalLeads}
                    subtitle={`${leadConversionRate}% converted`}
                    ion="trending-up-outline"
                    color="#047857"
                    bg="#D1FAE5"
                  />
                  <StatCard
                    label="Avg Leads / Emp"
                    value={avgLeadsPerEmployee}
                    ion="people-outline"
                    color="#1D4ED8"
                    bg="#DBEAFE"
                  />
                  <StatCard
                    label="Top Performer"
                    value={shortName(topByLeads[0]?.name || '-')}
                    subtitle={`${topByLeads[0]?.totalLeads || 0} leads`}
                    ion="trophy-outline"
                    color="#7C3AED"
                    bg="#EDE9FE"
                  />
                  <StatCard
                    label="Employees Active"
                    value={employees.filter((e) => e.totalLeads > 0).length}
                    subtitle={`out of ${data.totalEmployees}`}
                    ion="flash-outline"
                    color="#0E7490"
                    bg="#CFFAFE"
                  />
                </View>
                <StatusList
                  title="Team Leads by Status"
                  subtitle="Distribution of all team leads by status"
                  items={leadsByStatus}
                />
                <SimpleBarChart
                  title="Employee Leads Performance"
                  subtitle="Lead generation by each employee in your team"
                  labels={employees.slice(0, 15).map((e) => shortName(e.name))}
                  values={employees.slice(0, 15).map((e) => e.totalLeads || 0)}
                  barColor="#10b981"
                />
                <SimpleBarChart
                  title="Top 10 Employees by Leads"
                  subtitle="Leading lead generators"
                  labels={topByLeads.slice(0, 10).map((e) => shortName(e.name))}
                  values={topByLeads.slice(0, 10).map((e) => e.totalLeads || 0)}
                  barColor="#3b82f6"
                />
              </>
            )}

            {(activeTab === 'dashboard' || activeTab === 'analytics') && (
              <>
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Team Performance Metrics</Text>
                  <MetricBar
                    label="Avg Leads/Employee"
                    value={avgLeadsPerEmployee}
                    pct={Math.min((avgLeadsPerEmployee / maxLeads) * 100, 100)}
                    color="#3b82f6"
                  />
                  <MetricBar
                    label="Avg Sales/Employee"
                    value={avgSalesPerEmployee}
                    pct={Math.min((avgSalesPerEmployee / maxSales) * 100, 100)}
                    color="#a855f7"
                  />
                  <MetricBar
                    label="Avg DCs/Employee"
                    value={avgDCsPerEmployee}
                    pct={Math.min((avgDCsPerEmployee / maxDCs) * 100, 100)}
                    color="#f59e0b"
                  />
                  <MetricBar
                    label="Lead Conversion Rate"
                    value={leadConversionRate}
                    pct={leadConversionRate}
                    color="#10b981"
                    suffix="%"
                  />
                  <Text style={styles.metricFoot}>
                    {closedLeads} closed out of {data.totalLeads} leads
                  </Text>
                </View>

                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Team Summary</Text>
                  <SummaryRow
                    label="Total Employees"
                    value={data.totalEmployees}
                    sub={`${zoneItems.length} zones`}
                    bg="#DBEAFE"
                    color="#1D4ED8"
                  />
                  <SummaryRow
                    label="Total Leads"
                    value={data.totalLeads}
                    sub={`${leadConversionRate}% converted`}
                    bg="#D1FAE5"
                    color="#047857"
                  />
                  <SummaryRow
                    label="Total Sales"
                    value={data.totalSales}
                    sub={`Avg ${avgSalesPerEmployee}/employee`}
                    bg="#EDE9FE"
                    color="#7C3AED"
                  />
                  <SummaryRow
                    label="Total DCs"
                    value={data.totalDCs}
                    sub={`Avg ${avgDCsPerEmployee}/employee`}
                    bg="#FFEDD5"
                    color="#C2410C"
                  />
                </View>

                <View style={styles.sectionCard}>
                  <View style={styles.aiHeader}>
                    <Ionicons name="calendar-outline" size={20} color="#B91C1C" />
                    <Text style={styles.sectionTitle}>Leave Status</Text>
                  </View>
                  {leavesByStatus.length === 0 ? (
                    <Text style={styles.emptyHint}>NO DATA FOUND</Text>
                  ) : (
                    leavesByStatus.map((item, idx) => (
                      <View key={item.label} style={styles.statusRow}>
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: STATUS_COLORS[idx % STATUS_COLORS.length] },
                          ]}
                        />
                        <Text style={[styles.statusLabel, { width: 100 }]}>{item.label}</Text>
                        <Text style={styles.statusCount}>{item.count}</Text>
                      </View>
                    ))
                  )}
                </View>

                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Top 10 Executives by Activity</Text>
                  <Text style={styles.sectionSubtitle}>
                    Ranked by total activities (Leads + DCs + Sales)
                  </Text>
                  {byActivity.slice(0, 10).map((emp, idx) => (
                    <View key={emp._id} style={styles.rankRow}>
                      <View
                        style={[
                          styles.rankBadge,
                          idx === 0 && { backgroundColor: '#F59E0B' },
                          idx === 1 && { backgroundColor: '#9CA3AF' },
                          idx === 2 && { backgroundColor: '#F97316' },
                          idx > 2 && { backgroundColor: '#DBEAFE' },
                        ]}
                      >
                        <Text style={[styles.rankBadgeText, idx > 2 && { color: '#1D4ED8' }]}>
                          {idx + 1}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.empName}>{emp.name}</Text>
                        <Text style={styles.empMeta}>{emp.assignedCity || 'Zone: Unassigned'}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.rankScore}>{emp.totalActivity}</Text>
                        <Text style={styles.empMeta}>
                          {emp.totalLeads}L · {emp.totalDCs}D · {emp.totalSales}S
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>

                {byActivity.length > 0 ? (
                  <GroupedBarChart
                    title="Executive Activity Distribution"
                    subtitle="How activities are distributed across executives"
                    labels={byActivity.slice(0, 8).map((e) => shortName(e.name))}
                    datasets={[
                      {
                        label: 'Leads',
                        data: byActivity.slice(0, 8).map((e) => e.totalLeads || 0),
                        color: '#3b82f6',
                      },
                      {
                        label: 'DCs',
                        data: byActivity.slice(0, 8).map((e) => e.totalDCs || 0),
                        color: '#f59e0b',
                      },
                      {
                        label: 'Sales',
                        data: byActivity.slice(0, 8).map((e) => e.totalSales || 0),
                        color: '#a855f7',
                      },
                    ]}
                  />
                ) : null}

                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Executive Activity Insights</Text>
                  <View style={styles.activityRow}>
                    <View style={styles.activityCard}>
                      <Text style={styles.activityLabel}>High Performers</Text>
                      <Text style={[styles.activityValue, { color: '#1D4ED8' }]}>{highPerformers}</Text>
                      <Text style={styles.activitySub}>above average activity</Text>
                    </View>
                    <View style={styles.activityCard}>
                      <Text style={styles.activityLabel}>Active Executives</Text>
                      <Text style={[styles.activityValue, { color: '#047857' }]}>{activeExecutives}</Text>
                      <Text style={styles.activitySub}>with at least one activity</Text>
                    </View>
                    <View style={styles.activityCard}>
                      <Text style={styles.activityLabel}>Needs Support</Text>
                      <Text style={[styles.activityValue, { color: '#C2410C' }]}>{needsSupport}</Text>
                      <Text style={styles.activitySub}>no activities recorded</Text>
                    </View>
                    <View style={styles.activityCard}>
                      <Text style={styles.activityLabel}>Avg Activity/Executive</Text>
                      <Text style={[styles.activityValue, { color: '#7C3AED' }]}>{avgActivity}</Text>
                      <Text style={styles.activitySub}>total activities per executive</Text>
                    </View>
                  </View>
                </View>

                {byActivity.length > 0 ? (
                  <GroupedBarChart
                    title="Employee Workload Analysis"
                    subtitle="Combined performance metrics (Leads + DC + Sales)"
                    labels={byActivity.slice(0, 12).map((e) => shortName(e.name))}
                    datasets={[
                      {
                        label: 'Leads',
                        data: byActivity.slice(0, 12).map((e) => e.totalLeads || 0),
                        color: '#3b82f6',
                      },
                      {
                        label: 'DCs',
                        data: byActivity.slice(0, 12).map((e) => e.totalDCs || 0),
                        color: '#f59e0b',
                      },
                      {
                        label: 'Sales',
                        data: byActivity.slice(0, 12).map((e) => e.totalSales || 0),
                        color: '#a855f7',
                      },
                    ]}
                  />
                ) : null}

                <View style={styles.statGrid}>
                  <StatCard
                    label="Most Leads Generated"
                    value={shortName(topByLeads[0]?.name || 'N/A')}
                    subtitle={`${topByLeads[0]?.totalLeads || 0} leads · ${topByLeads[0]?.assignedCity || 'Zone: Unassigned'}`}
                    ion="trending-up-outline"
                    color="#1D4ED8"
                    bg="#DBEAFE"
                  />
                  <StatCard
                    label="Most Sales Generated"
                    value={shortName(topBySales[0]?.name || 'N/A')}
                    subtitle={`${topBySales[0]?.totalSales || 0} sales · ${topBySales[0]?.assignedCity || 'Zone: Unassigned'}`}
                    ion="cart-outline"
                    color="#7C3AED"
                    bg="#EDE9FE"
                  />
                  <StatCard
                    label="Most DCs Generated"
                    value={shortName(topByDCs[0]?.name || 'N/A')}
                    subtitle={`${topByDCs[0]?.totalDCs || 0} DCs · ${topByDCs[0]?.assignedCity || 'Zone: Unassigned'}`}
                    ion="cube-outline"
                    color="#C2410C"
                    bg="#FFEDD5"
                  />
                  <StatCard
                    label="Most Active Zone"
                    value={mostActiveZone.name}
                    subtitle={`${mostActiveZone.employees} employees · ${mostActiveZone.activity} activity`}
                    ion="location-outline"
                    color="#0E7490"
                    bg="#CFFAFE"
                  />
                </View>

                <Text style={styles.listTitle}>Employee Performance Details</Text>
                <WebInput
                  value={empSearch}
                  onChangeText={setEmpSearch}
                  placeholder="Search name, email, zone, area…"
                />
                {shownEmployees.length === 0 ? (
                  <EmptyState icon="👥" title={byActivity.length ? 'No matching employees' : 'No employees'} />
                ) : (
                  shownEmployees.map((emp) => (
                    <Card key={emp._id}>
                      <CardTitle title={emp.name} subtitle={emp.email || undefined} badge={`${emp.totalActivity} activity`} tone="info" />
                      <InfoRow label="Zone" value={emp.assignedCity || ''} />
                      <InfoRow label="Area" value={emp.assignedArea || ''} />
                      <InfoRow label="Leads" value={String(emp.totalLeads)} />
                      <InfoRow label="DCs" value={String(emp.totalDCs)} />
                      <InfoRow label="Sales" value={String(emp.totalSales)} />
                      <InfoRow label="Leaves" value={String(emp.totalLeaves || 0)} />
                      {canManageTeam ? (
                        <ActionRow>
                          <WebButton
                            title="Assign Zone"
                            variant="outline"
                            onPress={() => {
                              setZoneModalEmp(emp);
                              setZoneInput(emp.assignedCity || '');
                            }}
                          />
                        </ActionRow>
                      ) : null}
                    </Card>
                  ))
                )}
              </>
            )}

            {activeTab === 'ai' && (
              <View style={styles.sectionCard}>
                <View style={styles.aiHeader}>
                  <Ionicons name="sparkles-outline" size={22} color="#7C3AED" />
                  <Text style={styles.sectionTitle}>AI insights</Text>
                </View>
                <Text style={styles.sectionSubtitle}>Quick recommendations based on team activity</Text>
                <Text style={styles.aiLine}>
                  • Conversion rate is {leadConversionRate}%. Focus follow-ups on open/warm leads to push past 80%.
                </Text>
                <Text style={styles.aiLine}>
                  • {needsAttention} executive(s) are below {midLow} leads — coach or rebalance territory.
                </Text>
                <Text style={styles.aiLine}>
                  • Top lead generator: {shortName(topByLeads[0]?.name || 'N/A')} (
                  {topByLeads[0]?.totalLeads || 0} leads).
                </Text>
                <Text style={styles.aiLine}>
                  • Top seller: {shortName(topBySales[0]?.name || 'N/A')} ({topBySales[0]?.totalSales || 0}{' '}
                  sales).
                </Text>
                <Text style={styles.aiLine}>
                  • Most DCs: {shortName(topByDCs[0]?.name || 'N/A')} ({topByDCs[0]?.totalDCs || 0} DCs).
                </Text>
                <Text style={styles.aiLine}>
                  • Team has {data.totalDCs} DCs and {data.totalSales} sales — review pending DCs if volume is high.
                </Text>
              </View>
            )}

          </>
        )}
      </ScrollView>

      <Modal
        visible={!!zoneModalEmp}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setZoneModalEmp(null);
          setZoneInput('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>Assign Zone to {zoneModalEmp?.name}</Text>
            <Text style={styles.sectionSubtitle}>
              Assign or update the zone (city) for this employee.
            </Text>
            <WebLabel>Zone (City) *</WebLabel>
            <WebInput
              value={zoneInput}
              onChangeText={setZoneInput}
              placeholder="Enter zone / city"
              autoCapitalize="words"
            />
            <View style={styles.modalActions}>
              <View style={{ flex: 1 }}>
                <WebButton
                  title="Cancel"
                  variant="outline"
                  disabled={assigningZone}
                  onPress={() => {
                    setZoneModalEmp(null);
                    setZoneInput('');
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <WebButton title="Assign Zone" onPress={assignZone} disabled={assigningZone} loading={assigningZone} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

function MetricBar({
  label,
  value,
  pct,
  color,
  suffix = '',
}: {
  label: string;
  value: number;
  pct: number;
  color: string;
  suffix?: string;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={styles.metricHead}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>
          {value}
          {suffix}
        </Text>
      </View>
      <View style={styles.metricTrack}>
        <View style={[styles.metricFill, { width: `${Math.max(2, pct)}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  sub,
  bg,
  color,
}: {
  label: string;
  value: number;
  sub?: string;
  bg: string;
  color: string;
}) {
  return (
    <View style={styles.summaryRow}>
      <View style={[styles.summaryDot, { backgroundColor: color }]} />
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={styles.summaryLabel}>{label}</Text>
        {sub ? <Text style={styles.summarySub}>{sub}</Text> : null}
      </View>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  stateBadge: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D4ED8',
    backgroundColor: '#DBEAFE',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 12,
    overflow: 'hidden',
  },
  headerActions: { flexDirection: 'row', gap: 6 },
  headerBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.backgroundLight,
  },
  headerBtnText: { fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
  headerBtnPrimary: {
    backgroundColor: colors.primaryDark,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  headerBtnPrimaryText: { fontSize: 13, color: colors.primaryForeground, fontWeight: '700' },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  filterCol: { flex: 1 },
  filterActions: { flexDirection: 'row', gap: 8 },
  tabsScroll: { marginTop: -12, marginBottom: 12 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  sectionCard: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  sectionSubtitle: { fontSize: 13, color: colors.textTertiary, marginBottom: 12, marginTop: 2 },
  listTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginTop: 4, marginBottom: 8 },
  activityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  activityCard: {
    flexGrow: 1,
    flexBasis: '46%',
    borderWidth: 1,
    borderColor: '#EEF2F7',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
  },
  activityLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginTop: 2 },
  activityValue: { fontSize: 24, fontWeight: '800' },
  activitySub: { fontSize: 13, color: colors.textTertiary, marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { width: 80, fontSize: 13, color: colors.textPrimary },
  statusTrack: {
    flex: 1,
    height: 8,
    backgroundColor: colors.backgroundMuted,
    borderRadius: 4,
    overflow: 'hidden',
  },
  statusFill: { height: '100%', borderRadius: 4 },
  statusCount: { width: 72, textAlign: 'right', fontSize: 13, color: colors.textSecondary },
  emptyHint: { fontSize: 14, color: colors.textTertiary, textAlign: 'center', paddingVertical: 24 },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  aiLine: { fontSize: 14, color: colors.textPrimary, marginBottom: 8, lineHeight: 20 },
  empName: { fontSize: 15, color: colors.textPrimary, fontWeight: '600' },
  empMeta: { fontSize: 13, color: colors.textTertiary, marginTop: 2 },
  metricHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  metricLabel: { fontSize: 13, color: colors.textSecondary },
  metricValue: { fontSize: 15, color: colors.textPrimary, fontWeight: '700' },
  metricTrack: {
    height: 8,
    backgroundColor: colors.backgroundMuted,
    borderRadius: 999,
    overflow: 'hidden',
  },
  metricFill: { height: '100%', borderRadius: 999 },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  summaryDot: { width: 8, height: 8, borderRadius: 4 },
  summaryLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  summarySub: { fontSize: 13, marginTop: 2, color: colors.textTertiary },
  summaryValue: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  metricFoot: { fontSize: 13, color: colors.textTertiary, marginTop: 4 },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  rankScore: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 14,
    padding: 16,
  },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
});
