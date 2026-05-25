import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import AttendanceCard from '../../components/AttendanceCard';
import { colors, gradients } from '../../theme/colors';
import { commonStyles } from '../../theme/styles';
import { typography } from '../../theme/typography';

export default function DashboardScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  
  // Determine user role and permissions (like web app)
  const userRole = user?.role || '';
  const userRoles = user?.roles || [];
  const normalizedRole = userRole.toLowerCase();
  const normalizedRoles = userRoles.map((role) => role.toLowerCase());
  const roleIncludes = (match: string) =>
    normalizedRole.includes(match.toLowerCase()) ||
    normalizedRoles.some((role) => role.includes(match.toLowerCase()));
  
  // Role checks - matching navbar-landing Sidebar.tsx exactly
  const isEmployee = userRole === 'Executive' || roleIncludes('sales bde');
  const isManager = userRole === 'Manager';
  const isCoordinator = userRole === 'Coordinator';
  const isSeniorCoordinator = userRole === 'Senior Coordinator';
  const isExecutiveManager = userRole === 'Executive Manager';
  const isTrainer = userRole === 'Trainer';
  const isWarehouseExecutive = userRole === 'Warehouse Executive';
  const isWarehouseManager = userRole === 'Warehouse Manager';
  const isFinanceManager = roleIncludes('finance manager');
  const isExecutive = userRole === 'Executive';
  const isAdmin = userRole === 'Admin' || userRole === 'Super Admin';
  
  // Debug logging
  useEffect(() => {
    console.log('Dashboard - User Role:', userRole);
    console.log('Dashboard - User Roles:', userRoles);
    console.log('Dashboard - isEmployee:', isEmployee);
    console.log('Dashboard - isExecutive:', isExecutive);
  }, [userRole, userRoles, isEmployee, isExecutive]);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          (navigation as any).reset({ index: 0, routes: [{ name: 'Login' }] });
        },
      },
    ]);
  };

  // Employee Dashboard (like web app - only My DC, no Create DC)
  const renderEmployeeDashboard = () => (
    <View style={styles.content}>
      <AttendanceCard />
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: '#3b82f6' + '15' }]}>
              <Text style={styles.sectionIconText}>📋</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Leads</Text>
        </View>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('LeadsList')}
        >
          <LinearGradient
            colors={['#3b82f6', '#2563eb']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardGradient}
          >
            <View style={styles.cardContent}>
              <View style={styles.cardIconContainer}>
                <Text style={styles.cardIcon}>📋</Text>
              </View>
              <View style={styles.cardTextContainer}>
                <Text style={styles.cardTitle}>My Leads</Text>
                <Text style={styles.cardSubtitle}>View and manage leads</Text>
              </View>
              <View style={styles.cardArrowContainer}>
                <Text style={styles.cardArrow}>›</Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('LeadAdd')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}>
              <Text style={styles.cardIconWhite}>➕</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Add Lead</Text>
              <Text style={styles.cardSubtitleWhite}>Create new lead</Text>
            </View>
            <View style={styles.cardArrowContainer}>
              <Text style={styles.cardArrowWhite}>›</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('LeadFollowup')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}>
              <Text style={styles.cardIconWhite}>📞</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Followup Leads</Text>
              <Text style={styles.cardSubtitleWhite}>View follow-up leads</Text>
            </View>
            <View style={styles.cardArrowContainer}>
              <Text style={styles.cardArrowWhite}>›</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.primary + '15' }]}>
              <Text style={styles.sectionIconText}>📦</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>DC Management</Text>
        </View>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('DCList', { type: 'sales' })}
        >
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardGradient}
          >
            <View style={styles.cardContent}>
              <View style={styles.cardIconContainer}>
                <Text style={styles.cardIcon}>📋</Text>
              </View>
              <View style={styles.cardTextContainer}>
                <Text style={styles.cardTitle}>My DC</Text>
                <Text style={styles.cardSubtitle}>View and manage my DC orders</Text>
              </View>
              <View style={styles.cardArrowContainer}>
                <Text style={styles.cardArrow}>›</Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('DCClient')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}>
              <Text style={styles.cardIconWhite}>👥</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>My Clients</Text>
              <Text style={styles.cardSubtitleWhite}>View my client DCs</Text>
            </View>
            <View style={styles.cardArrowContainer}>
              <Text style={styles.cardArrowWhite}>›</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('DCTermWise')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}>
              <Text style={styles.cardIconWhite}>📄</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Term-Wise DC</Text>
              <Text style={styles.cardSubtitleWhite}>Scheduled term-wise deliveries</Text>
            </View>
            <View style={styles.cardArrowContainer}>
              <Text style={styles.cardArrowWhite}>›</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.success + '15' }]}>
              <Text style={styles.sectionIconText}>💳</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Payments</Text>
        </View>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('PaymentList')}
        >
          <LinearGradient
            colors={[colors.success, '#059669']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardGradient}
          >
            <View style={styles.cardContent}>
              <View style={styles.cardIconContainer}>
                <Text style={styles.cardIcon}>⏳</Text>
              </View>
              <View style={styles.cardTextContainer}>
                <Text style={styles.cardTitle}>Pending Payments</Text>
                <Text style={styles.cardSubtitle}>View pending payments</Text>
              </View>
              <View style={styles.cardArrowContainer}>
                <Text style={styles.cardArrow}>›</Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('PaymentAdd')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}>
              <Text style={styles.cardIconWhite}>➕</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Add Payment</Text>
              <Text style={styles.cardSubtitleWhite}>Record new payment</Text>
            </View>
            <View style={styles.cardArrowContainer}>
              <Text style={styles.cardArrowWhite}>›</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('PaymentDone')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}>
              <Text style={styles.cardIconWhite}>✅</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Payments Done</Text>
              <Text style={styles.cardSubtitleWhite}>View completed payments</Text>
            </View>
            <View style={styles.cardArrowContainer}>
              <Text style={styles.cardArrowWhite}>›</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.warning + '15' }]}>
              <Text style={styles.sectionIconText}>💸</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Expenses</Text>
        </View>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('ExpenseCreate')}
        >
          <LinearGradient
            colors={[colors.warning, '#D97706']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardGradient}
          >
            <View style={styles.cardContent}>
              <View style={styles.cardIconContainer}>
                <Text style={styles.cardIcon}>➕</Text>
              </View>
              <View style={styles.cardTextContainer}>
                <Text style={styles.cardTitle}>Create Expense</Text>
                <Text style={styles.cardSubtitle}>Submit new expense</Text>
              </View>
              <View style={styles.cardArrowContainer}>
                <Text style={styles.cardArrow}>›</Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('ExpenseMy')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}>
              <Text style={styles.cardIconWhite}>📊</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>My Expenses</Text>
              <Text style={styles.cardSubtitleWhite}>View my submitted expenses</Text>
            </View>
            <View style={styles.cardArrowContainer}>
              <Text style={styles.cardArrowWhite}>›</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.info + '15' }]}>
              <Text style={styles.sectionIconText}>🏖️</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Leaves</Text>
        </View>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('LeaveRequest')}
        >
          <LinearGradient
            colors={[colors.info, '#2563EB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardGradient}
          >
            <View style={styles.cardContent}>
              <View style={styles.cardIconContainer}>
                <Text style={styles.cardIcon}>➕</Text>
              </View>
              <View style={styles.cardTextContainer}>
                <Text style={styles.cardTitle}>Leave Request</Text>
                <Text style={styles.cardSubtitle}>Submit leave request</Text>
              </View>
              <View style={styles.cardArrowContainer}>
                <Text style={styles.cardArrow}>›</Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('LeavesApproved')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}>
              <Text style={styles.cardIconWhite}>📅</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>My Leaves</Text>
              <Text style={styles.cardSubtitleWhite}>View approved leaves</Text>
            </View>
            <View style={styles.cardArrowContainer}>
              <Text style={styles.cardArrowWhite}>›</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: '#A855F7' + '15' }]}>
              <Text style={styles.sectionIconText}>📦</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Employee Sample</Text>
        </View>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('SamplesRequest')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}>
              <Text style={styles.cardIconWhite}>📦</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Request Sample</Text>
              <Text style={styles.cardSubtitleWhite}>Request product samples</Text>
            </View>
            <View style={styles.cardArrowContainer}>
              <Text style={styles.cardArrowWhite}>›</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: '#14B8A6' + '15' }]}>
              <Text style={styles.sectionIconText}>🔄</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Stock Returns</Text>
        </View>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('ReturnsEmployee')}
        >
          <LinearGradient
            colors={['#14B8A6', '#0D9488']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardGradient}
          >
            <View style={styles.cardContent}>
              <View style={styles.cardIconContainer}>
                <Text style={styles.cardIcon}>🔄</Text>
              </View>
              <View style={styles.cardTextContainer}>
                <Text style={styles.cardTitle}>Stock Returns</Text>
                <Text style={styles.cardSubtitle}>Submit and view returns</Text>
              </View>
              <View style={styles.cardArrowContainer}>
                <Text style={styles.cardArrow}>›</Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Manager Dashboard (no Create Sale per web)
  const renderManagerDashboard = () => (
    <View style={styles.content}>
      <AttendanceCard />
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.primary + '15' }]}>
              <Text style={styles.sectionIconText}>📦</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Clients</Text>
        </View>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('DCClosed')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>✅</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Closed Sales</Text>
              <Text style={styles.cardSubtitleWhite}>View closed sales</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('DCSaved')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>💾</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Saved DC</Text>
              <Text style={styles.cardSubtitleWhite}>View saved DCs</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('DCPending')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>⏳</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Pending DC</Text>
              <Text style={styles.cardSubtitleWhite}>Review pending DCs</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('DCEmp')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>👤</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>EMP DC</Text>
              <Text style={styles.cardSubtitleWhite}>Employee DCs</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('DCTermWise')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>📄</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Term-Wise DC</Text>
              <Text style={styles.cardSubtitleWhite}>Term-wise deliveries</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
      </View>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: '#F59E0B' + '15' }]}>
              <Text style={styles.sectionIconText}>🏢</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Warehouse</Text>
        </View>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('WarehouseDCAtWarehouse')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>📦</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>DC @ Warehouse</Text>
              <Text style={styles.cardSubtitleWhite}>Process warehouse DCs</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('WarehouseCompletedDC')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>✅</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Completed DC</Text>
              <Text style={styles.cardSubtitleWhite}>View completed DCs</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('WarehouseDCListed')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>📋</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>DC Listed</Text>
              <Text style={styles.cardSubtitleWhite}>Listed DCs</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
      </View>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.warning + '15' }]}>
              <Text style={styles.sectionIconText}>💸</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Expenses</Text>
        </View>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ExpensePending')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>⏳</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Pending Expenses</Text>
              <Text style={styles.cardSubtitleWhite}>Approve pending expenses</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
      </View>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.info + '15' }]}>
              <Text style={styles.sectionIconText}>📊</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Reports</Text>
        </View>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ReportsLeads')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>📋</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Leads</Text>
              <Text style={styles.cardSubtitleWhite}>Leads report</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ReportsSalesVisit')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>📍</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Sales Visit</Text>
              <Text style={styles.cardSubtitleWhite}>Sales visit report</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ReportsEmployeeTrack')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>👤</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Employee Track</Text>
              <Text style={styles.cardSubtitleWhite}>Track employees</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ReportsExpenses')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>💰</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>All Expenses</Text>
              <Text style={styles.cardSubtitleWhite}>Expense reports</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
      </View>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: '#6B7280' + '15' }]}>
              <Text style={styles.sectionIconText}>⚙️</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Settings</Text>
        </View>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('SettingsPassword')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>🔐</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Change Password</Text>
              <Text style={styles.cardSubtitleWhite}>Update password</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Trainer Dashboard (Training & Services, Expense, Leave - no DC per web)
  const renderTrainerDashboard = () => (
    <View style={styles.content}>
      <AttendanceCard />
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: '#8B5CF6' + '15' }]}>
              <Text style={styles.sectionIconText}>🎓</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Training & Services</Text>
        </View>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('TrainingTrainerMy')}
        >
          <LinearGradient colors={['#8B5CF6', '#7C3AED']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardGradient}>
            <View style={styles.cardContent}>
              <View style={styles.cardIconContainer}><Text style={styles.cardIcon}>📅</Text></View>
              <View style={styles.cardTextContainer}>
                <Text style={styles.cardTitle}>Active / Upcoming</Text>
                <Text style={styles.cardSubtitle}>My trainings and services</Text>
              </View>
              <View style={styles.cardArrowContainer}><Text style={styles.cardArrow}>›</Text></View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('TrainingTrainerCompleted')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>✅</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Completed</Text>
              <Text style={styles.cardSubtitleWhite}>Completed trainings and services</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
      </View>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.warning + '15' }]}>
              <Text style={styles.sectionIconText}>💸</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Expense</Text>
        </View>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ExpenseCreate')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>➕</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Create Expense</Text>
              <Text style={styles.cardSubtitleWhite}>Submit expense</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ExpenseMy')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>📊</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>My Expenses</Text>
              <Text style={styles.cardSubtitleWhite}>View my expenses</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
      </View>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.info + '15' }]}>
              <Text style={styles.sectionIconText}>📅</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Leave Management</Text>
        </View>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('LeaveRequest')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>➕</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Leave Request</Text>
              <Text style={styles.cardSubtitleWhite}>Submit leave request</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('LeavesApproved')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>✅</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>My Leaves</Text>
              <Text style={styles.cardSubtitleWhite}>View approved leaves</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Executive Manager Dashboard
  const renderExecutiveManagerDashboard = () => (
    <View style={styles.content}>
      <AttendanceCard />
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('ExecutiveManagerDashboard', { managerId: user?._id })}
      >
        <LinearGradient colors={['#6366F1', '#4F46E5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardGradient}>
          <View style={styles.cardContent}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIcon}>📊</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitle}>My Dashboard</Text>
              <Text style={styles.cardSubtitle}>View my executive dashboard</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrow}>›</Text></View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: '#8B5CF6' + '15' }]}>
              <Text style={styles.sectionIconText}>👥</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Executives</Text>
        </View>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ExecutiveManagerExecutives')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>👥</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>My Executives</Text>
              <Text style={styles.cardSubtitleWhite}>View executives</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
      </View>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.primary + '15' }]}>
              <Text style={styles.sectionIconText}>📋</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Clients</Text>
        </View>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ClientsClosedSales')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>✏️</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>PO Edit Request</Text>
              <Text style={styles.cardSubtitleWhite}>Approve PO edit requests</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
      </View>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.warning + '15' }]}>
              <Text style={styles.sectionIconText}>💸</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Expenses</Text>
        </View>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ExpensePending')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>⏳</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Pending Expenses</Text>
              <Text style={styles.cardSubtitleWhite}>Approve pending expenses</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
      </View>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.info + '15' }]}>
              <Text style={styles.sectionIconText}>📅</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Leave Management</Text>
        </View>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ExecutiveManagerLeaves', { managerId: user?._id })}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>📅</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>My Team Leaves</Text>
              <Text style={styles.cardSubtitleWhite}>Manage team leave requests</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Warehouse Executive Dashboard
  const renderWarehouseExecutiveDashboard = () => (
    <View style={styles.content}>
      <AttendanceCard />
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: '#14B8A6' + '15' }]}>
              <Text style={styles.sectionIconText}>🔄</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Stock Returns</Text>
        </View>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('ReturnsWarehouseExecutive')}
        >
          <LinearGradient colors={['#14B8A6', '#0D9488']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardGradient}>
            <View style={styles.cardContent}>
              <View style={styles.cardIconContainer}><Text style={styles.cardIcon}>🔄</Text></View>
              <View style={styles.cardTextContainer}>
                <Text style={styles.cardTitle}>Stock Returns</Text>
                <Text style={styles.cardSubtitle}>Verify executive returns</Text>
              </View>
              <View style={styles.cardArrowContainer}><Text style={styles.cardArrow}>›</Text></View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Warehouse Manager Dashboard
  const renderWarehouseManagerDashboard = () => (
    <View style={styles.content}>
      <AttendanceCard />
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: '#14B8A6' + '15' }]}>
              <Text style={styles.sectionIconText}>🔄</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Stock Returns</Text>
        </View>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('ReturnsWarehouseManager')}
        >
          <LinearGradient colors={['#14B8A6', '#0D9488']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardGradient}>
            <View style={styles.cardContent}>
              <View style={styles.cardIconContainer}><Text style={styles.cardIcon}>🔄</Text></View>
              <View style={styles.cardTextContainer}>
                <Text style={styles.cardTitle}>Stock Returns</Text>
                <Text style={styles.cardSubtitle}>Approve return requests</Text>
              </View>
              <View style={styles.cardArrowContainer}><Text style={styles.cardArrow}>›</Text></View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Sales BDE Dashboard (with Create DC, Payments, Expenses, Leaves)
  const renderSalesBDEDashboard = () => (
    <View style={styles.content}>
      <AttendanceCard />
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DC</Text>
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('DCList', { type: 'sales' })}
        >
          <Text style={styles.cardTitle}>My DC</Text>
          <Text style={styles.cardSubtitle}>View and manage my DC orders</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('DCCapture', { type: 'sales' })}
        >
          <Text style={styles.cardTitle}>Create DC</Text>
          <Text style={styles.cardSubtitle}>Create new DC entry</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payments</Text>
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('PaymentList')}
        >
          <Text style={styles.cardTitle}>Add Payment</Text>
          <Text style={styles.cardSubtitle}>Record new payment</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Expenses</Text>
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('ExpenseList')}
        >
          <Text style={styles.cardTitle}>Create Expense</Text>
          <Text style={styles.cardSubtitle}>Submit new expense</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('ExpenseList', { myExpenses: true })}
        >
          <Text style={styles.cardTitle}>My Expenses</Text>
          <Text style={styles.cardSubtitle}>View my submitted expenses</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Leaves</Text>
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('LeaveList')}
        >
          <Text style={styles.cardTitle}>My Leaves</Text>
          <Text style={styles.cardSubtitle}>View and manage leaves</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Senior Coordinator: only Dashboard, Clients (all pages), Warehouse (all pages). No Reports, Payments, Training & Services, Users/Employees.
  const renderSeniorCoordinatorDashboard = () => (
    <View style={styles.content}>
      <AttendanceCard />
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.primary + '15' }]}>
              <Text style={styles.sectionIconText}>📦</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Clients</Text>
        </View>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('DCCreate')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>➕</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Create Sale</Text>
              <Text style={styles.cardSubtitleWhite}>Create new sale</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('DCClosed')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>✅</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Closed Sales</Text>
              <Text style={styles.cardSubtitleWhite}>View closed sales</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('DCSaved')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>💾</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Saved DC</Text>
              <Text style={styles.cardSubtitleWhite}>View saved DCs</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('DCPending')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>⏳</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Pending DC</Text>
              <Text style={styles.cardSubtitleWhite}>Review pending DCs</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('DCEmp')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>👤</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>EMP DC</Text>
              <Text style={styles.cardSubtitleWhite}>EMP DC list</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('DCTermWise')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>📋</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Term-Wise DC</Text>
              <Text style={styles.cardSubtitleWhite}>Term-wise DC</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
      </View>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: '#F59E0B' + '15' }]}>
              <Text style={styles.sectionIconText}>🏢</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Warehouse</Text>
        </View>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('WarehouseInventoryItems')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>📦</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Inventory Items</Text>
              <Text style={styles.cardSubtitleWhite}>Manage inventory</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('WarehouseStock')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>📊</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Stock</Text>
              <Text style={styles.cardSubtitleWhite}>View stock</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('WarehouseDCAtWarehouse')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>📦</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>DC @ Warehouse</Text>
              <Text style={styles.cardSubtitleWhite}>Process warehouse DCs</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('WarehouseCompletedDC')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>✅</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Completed DC</Text>
              <Text style={styles.cardSubtitleWhite}>View completed DCs</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('WarehouseDCListed')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>📋</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>DC Listed</Text>
              <Text style={styles.cardSubtitleWhite}>Listed DCs</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('WarehouseHoldDC')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>⏸️</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Hold DC</Text>
              <Text style={styles.cardSubtitleWhite}>View hold DCs</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('WarehouseSearchDC')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>🔍</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Search DC</Text>
              <Text style={styles.cardSubtitleWhite}>Search DCs</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
      </View>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: '#6B7280' + '15' }]}>
              <Text style={styles.sectionIconText}>⚙️</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Settings</Text>
        </View>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('SettingsPassword')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>🔐</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Change Password</Text>
              <Text style={styles.cardSubtitleWhite}>Update password</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Coordinator Dashboard (includes Employees, Training, Warehouse, Payments, Reports)
  const renderCoordinatorDashboard = () => (
    <View style={styles.content}>
      <AttendanceCard />
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.primary + '15' }]}>
              <Text style={styles.sectionIconText}>📦</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Clients</Text>
        </View>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('DCCreate')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>➕</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Create Sale</Text>
              <Text style={styles.cardSubtitleWhite}>Create new sale</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('DCClosed')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>✅</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Closed Sales</Text>
              <Text style={styles.cardSubtitleWhite}>View closed sales</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('DCSaved')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>💾</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Saved DC</Text>
              <Text style={styles.cardSubtitleWhite}>View saved DCs</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('DCPending')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>⏳</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Pending DC</Text>
              <Text style={styles.cardSubtitleWhite}>Review pending DCs</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
      </View>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: '#8B5CF6' + '15' }]}>
              <Text style={styles.sectionIconText}>👥</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Employees</Text>
        </View>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('EmployeesActive')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>👥</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Active Employees</Text>
              <Text style={styles.cardSubtitleWhite}>View active employees</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
      </View>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: '#EC4899' + '15' }]}>
              <Text style={styles.sectionIconText}>🎓</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Training & Services</Text>
        </View>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('TrainingDashboard')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>📊</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Trainers Dashboard</Text>
              <Text style={styles.cardSubtitleWhite}>View training dashboard</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('TrainingAssign')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>📋</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Assign Training</Text>
              <Text style={styles.cardSubtitleWhite}>Assign training or service</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('TrainingList')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>📋</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Trainings List</Text>
              <Text style={styles.cardSubtitleWhite}>View trainings</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ServicesList')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>📋</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Services List</Text>
              <Text style={styles.cardSubtitleWhite}>View services</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
      </View>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: '#F59E0B' + '15' }]}>
              <Text style={styles.sectionIconText}>🏢</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Warehouse</Text>
        </View>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('WarehouseDCAtWarehouse')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>📦</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>DC @ Warehouse</Text>
              <Text style={styles.cardSubtitleWhite}>Process warehouse DCs</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('WarehouseCompletedDC')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>✅</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Completed DC</Text>
              <Text style={styles.cardSubtitleWhite}>View completed DCs</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('WarehouseDCListed')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>📋</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>DC Listed</Text>
              <Text style={styles.cardSubtitleWhite}>Listed DCs</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('WarehouseHoldDC')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>⏸️</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Hold DC</Text>
              <Text style={styles.cardSubtitleWhite}>View hold DCs</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
      </View>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.success + '15' }]}>
              <Text style={styles.sectionIconText}>💳</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Payments</Text>
        </View>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('PaymentList')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>⏳</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Pending Payments</Text>
              <Text style={styles.cardSubtitleWhite}>View pending payments</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('PaymentDone')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>✅</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Payments Done</Text>
              <Text style={styles.cardSubtitleWhite}>Completed payments</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
      </View>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.info + '15' }]}>
              <Text style={styles.sectionIconText}>📊</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Reports</Text>
        </View>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ReportsLeads')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>📋</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Leads</Text>
              <Text style={styles.cardSubtitleWhite}>Leads report</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ReportsDC')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>📦</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>DC</Text>
              <Text style={styles.cardSubtitleWhite}>DC report</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ReportsReturns')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>🔄</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Returns</Text>
              <Text style={styles.cardSubtitleWhite}>Returns report</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ReportsExpenses')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>💰</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>All Expenses</Text>
              <Text style={styles.cardSubtitleWhite}>Expense reports</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
      </View>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: '#6B7280' + '15' }]}>
              <Text style={styles.sectionIconText}>⚙️</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Settings</Text>
        </View>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('SettingsPassword')}>
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>🔐</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Change Password</Text>
              <Text style={styles.cardSubtitleWhite}>Update password</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Combined Sales BDE + Trainer
  const renderCombinedDashboard = () => (
    <View style={styles.content}>
      <AttendanceCard />
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sales BDE</Text>
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('DCList', { type: 'sales' })}
        >
          <Text style={styles.cardTitle}>My DC</Text>
          <Text style={styles.cardSubtitle}>View and manage DC orders</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('DCCapture', { type: 'sales' })}
        >
          <Text style={styles.cardTitle}>Create DC</Text>
          <Text style={styles.cardSubtitle}>Create new DC entry</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trainer</Text>
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('DCList', { type: 'training' })}
        >
          <Text style={styles.cardTitle}>Training DC</Text>
          <Text style={styles.cardSubtitle}>View training DC orders</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('DCCapture', { type: 'training' })}
        >
          <Text style={styles.cardTitle}>Capture Training DC</Text>
          <Text style={styles.cardSubtitle}>Create new training DC</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Admin Dashboard - Comprehensive with all features
  const renderAdminDashboard = () => (
    <View style={styles.content}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: '#8B5CF6' + '15' }]}>
              <Text style={styles.sectionIconText}>👥</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Employees</Text>
        </View>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('EmployeesActive')}
        >
          <LinearGradient
            colors={['#8B5CF6', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardGradient}
          >
            <View style={styles.cardContent}>
              <View style={styles.cardIconContainer}>
                <Text style={styles.cardIcon}>👥</Text>
              </View>
              <View style={styles.cardTextContainer}>
                <Text style={styles.cardTitle}>Active Employees</Text>
                <Text style={styles.cardSubtitle}>View and manage employees</Text>
              </View>
              <View style={styles.cardArrowContainer}>
                <Text style={styles.cardArrow}>›</Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('EmployeeNew')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}>
              <Text style={styles.cardIconWhite}>➕</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Add Employee</Text>
              <Text style={styles.cardSubtitleWhite}>Create new employee</Text>
            </View>
            <View style={styles.cardArrowContainer}>
              <Text style={styles.cardArrowWhite}>›</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('EmployeesInactive')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}>
              <Text style={styles.cardIconWhite}>👤</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Inactive Employees</Text>
              <Text style={styles.cardSubtitleWhite}>View inactive employees</Text>
            </View>
            <View style={styles.cardArrowContainer}>
              <Text style={styles.cardArrowWhite}>›</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.info + '15' }]}>
              <Text style={styles.sectionIconText}>📅</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Leave Management</Text>
        </View>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('LeavesPending')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}>
              <Text style={styles.cardIconWhite}>⏳</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Pending Leaves</Text>
              <Text style={styles.cardSubtitleWhite}>Approve leave requests</Text>
            </View>
            <View style={styles.cardArrowContainer}>
              <Text style={styles.cardArrowWhite}>›</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('LeavesReport')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}>
              <Text style={styles.cardIconWhite}>📊</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Leaves Report</Text>
              <Text style={styles.cardSubtitleWhite}>View leave reports</Text>
            </View>
            <View style={styles.cardArrowContainer}>
              <Text style={styles.cardArrowWhite}>›</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: '#EC4899' + '15' }]}>
              <Text style={styles.sectionIconText}>🎓</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Training & Services</Text>
        </View>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('TrainersNew')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}>
              <Text style={styles.cardIconWhite}>➕</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Add Trainer</Text>
              <Text style={styles.cardSubtitleWhite}>Add new trainer</Text>
            </View>
            <View style={styles.cardArrowContainer}>
              <Text style={styles.cardArrowWhite}>›</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('TrainersActive')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}>
              <Text style={styles.cardIconWhite}>👥</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Active Trainers</Text>
              <Text style={styles.cardSubtitleWhite}>View active trainers</Text>
            </View>
            <View style={styles.cardArrowContainer}>
              <Text style={styles.cardArrowWhite}>›</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('TrainingDashboard')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}>
              <Text style={styles.cardIconWhite}>📊</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Trainers Dashboard</Text>
              <Text style={styles.cardSubtitleWhite}>Training dashboard</Text>
            </View>
            <View style={styles.cardArrowContainer}>
              <Text style={styles.cardArrowWhite}>›</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('TrainingAssign')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}>
              <Text style={styles.cardIconWhite}>📋</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Assign Training</Text>
              <Text style={styles.cardSubtitleWhite}>Assign training or service</Text>
            </View>
            <View style={styles.cardArrowContainer}>
              <Text style={styles.cardArrowWhite}>›</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('TrainingList')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}>
              <Text style={styles.cardIconWhite}>📋</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Trainings List</Text>
              <Text style={styles.cardSubtitleWhite}>View trainings</Text>
            </View>
            <View style={styles.cardArrowContainer}>
              <Text style={styles.cardArrowWhite}>›</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('ServicesList')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}>
              <Text style={styles.cardIconWhite}>📋</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Services List</Text>
              <Text style={styles.cardSubtitleWhite}>View services</Text>
            </View>
            <View style={styles.cardArrowContainer}>
              <Text style={styles.cardArrowWhite}>›</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('TrainersInactive')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}>
              <Text style={styles.cardIconWhite}>👤</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Inactive Trainers</Text>
              <Text style={styles.cardSubtitleWhite}>View inactive trainers</Text>
            </View>
            <View style={styles.cardArrowContainer}>
              <Text style={styles.cardArrowWhite}>›</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: '#0EA5E9' + '15' }]}>
              <Text style={styles.sectionIconText}>🚚</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Clients</Text>
        </View>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('DCCreate')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>➕</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Create Sale</Text>
              <Text style={styles.cardSubtitleWhite}>Create new sale</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('DCClosed')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>✅</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Closed Sales</Text>
              <Text style={styles.cardSubtitleWhite}>View closed sales</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('DCSaved')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>💾</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Saved DC</Text>
              <Text style={styles.cardSubtitleWhite}>View saved DCs</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('DCPending')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>⏳</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Pending DC</Text>
              <Text style={styles.cardSubtitleWhite}>View pending DCs</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('DCEmp')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}><Text style={styles.cardIconWhite}>👤</Text></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>EMP DC</Text>
              <Text style={styles.cardSubtitleWhite}>Employee DCs</Text>
            </View>
            <View style={styles.cardArrowContainer}><Text style={styles.cardArrowWhite}>›</Text></View>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.primary + '15' }]}>
              <Text style={styles.sectionIconText}>📦</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>DC Management</Text>
        </View>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('DCAdminMy')}
        >
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardGradient}
          >
            <View style={styles.cardContent}>
              <View style={styles.cardIconContainer}>
                <Text style={styles.cardIcon}>📋</Text>
              </View>
              <View style={styles.cardTextContainer}>
                <Text style={styles.cardTitle}>All Created DCs</Text>
                <Text style={styles.cardSubtitle}>View all employee DCs</Text>
              </View>
              <View style={styles.cardArrowContainer}>
                <Text style={styles.cardArrow}>›</Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('DCPending')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}>
              <Text style={styles.cardIconWhite}>⏳</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Pending DCs</Text>
              <Text style={styles.cardSubtitleWhite}>Review pending DCs</Text>
            </View>
            <View style={styles.cardArrowContainer}>
              <Text style={styles.cardArrowWhite}>›</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('DCClosed')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}>
              <Text style={styles.cardIconWhite}>✅</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Closed Sales</Text>
              <Text style={styles.cardSubtitleWhite}>View closed sales</Text>
            </View>
            <View style={styles.cardArrowContainer}>
              <Text style={styles.cardArrowWhite}>›</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('DCCompleted')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}>
              <Text style={styles.cardIconWhite}>📦</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Completed DC</Text>
              <Text style={styles.cardSubtitleWhite}>View all completed DCs</Text>
            </View>
            <View style={styles.cardArrowContainer}>
              <Text style={styles.cardArrowWhite}>›</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('WarehouseHoldDC')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}>
              <Text style={styles.cardIconWhite}>⏸️</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Hold DC</Text>
              <Text style={styles.cardSubtitleWhite}>View all DCs on hold</Text>
            </View>
            <View style={styles.cardArrowContainer}>
              <Text style={styles.cardArrowWhite}>›</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: '#10B981' + '15' }]}>
              <Text style={styles.sectionIconText}>📦</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Products</Text>
        </View>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('ProductsList')}
        >
          <LinearGradient
            colors={['#10B981', '#059669']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardGradient}
          >
            <View style={styles.cardContent}>
              <View style={styles.cardIconContainer}>
                <Text style={styles.cardIcon}>📦</Text>
              </View>
              <View style={styles.cardTextContainer}>
                <Text style={styles.cardTitle}>Products</Text>
                <Text style={styles.cardSubtitle}>Manage products</Text>
              </View>
              <View style={styles.cardArrowContainer}>
                <Text style={styles.cardArrow}>›</Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('ProductNew')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}>
              <Text style={styles.cardIconWhite}>➕</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Add Product</Text>
              <Text style={styles.cardSubtitleWhite}>Create new product</Text>
            </View>
            <View style={styles.cardArrowContainer}>
              <Text style={styles.cardArrowWhite}>›</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.warning + '15' }]}>
              <Text style={styles.sectionIconText}>💳</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Payments</Text>
        </View>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('PaymentApprovalPendingCash')}
        >
          <LinearGradient
            colors={[colors.warning, '#D97706']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardGradient}
          >
            <View style={styles.cardContent}>
              <View style={styles.cardIconContainer}>
                <Text style={styles.cardIcon}>💰</Text>
              </View>
              <View style={styles.cardTextContainer}>
                <Text style={styles.cardTitle}>Pending Cash</Text>
                <Text style={styles.cardSubtitle}>Approve cash payments</Text>
              </View>
              <View style={styles.cardArrowContainer}>
                <Text style={styles.cardArrow}>›</Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('PaymentApprovalPendingCheques')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}>
              <Text style={styles.cardIconWhite}>💳</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Pending Cheques</Text>
              <Text style={styles.cardSubtitleWhite}>Approve cheque payments</Text>
            </View>
            <View style={styles.cardArrowContainer}>
              <Text style={styles.cardArrowWhite}>›</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('PaymentList')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}>
              <Text style={styles.cardIconWhite}>⏳</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Pending Payments</Text>
              <Text style={styles.cardSubtitleWhite}>View pending payments</Text>
            </View>
            <View style={styles.cardArrowContainer}>
              <Text style={styles.cardArrowWhite}>›</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('PaymentAdd')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}>
              <Text style={styles.cardIconWhite}>➕</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Add Payment</Text>
              <Text style={styles.cardSubtitleWhite}>Record new payment</Text>
            </View>
            <View style={styles.cardArrowContainer}>
              <Text style={styles.cardArrowWhite}>›</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('PaymentDone')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}>
              <Text style={styles.cardIconWhite}>✅</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Payments Done</Text>
              <Text style={styles.cardSubtitleWhite}>View completed payments</Text>
            </View>
            <View style={styles.cardArrowContainer}>
              <Text style={styles.cardArrowWhite}>›</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('PaymentTransactionReport')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}>
              <Text style={styles.cardIconWhite}>📊</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Transaction Report</Text>
              <Text style={styles.cardSubtitleWhite}>View payment reports</Text>
            </View>
            <View style={styles.cardArrowContainer}>
              <Text style={styles.cardArrowWhite}>›</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.warning + '15' }]}>
              <Text style={styles.sectionIconText}>💸</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Expenses</Text>
        </View>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('ExpensePending')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}>
              <Text style={styles.cardIconWhite}>⏳</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Pending Expenses</Text>
              <Text style={styles.cardSubtitleWhite}>View pending expenses list</Text>
            </View>
            <View style={styles.cardArrowContainer}>
              <Text style={styles.cardArrowWhite}>›</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('ExpenseFinancePending')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}>
              <Text style={styles.cardIconWhite}>💰</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Finance Pending</Text>
              <Text style={styles.cardSubtitleWhite}>Finance pending expenses</Text>
            </View>
            <View style={styles.cardArrowContainer}>
              <Text style={styles.cardArrowWhite}>›</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.info + '15' }]}>
              <Text style={styles.sectionIconText}>📊</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Reports</Text>
        </View>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('ReportsLeads')}
        >
          <LinearGradient
            colors={[colors.info, '#2563EB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardGradient}
          >
            <View style={styles.cardContent}>
              <View style={styles.cardIconContainer}>
                <Text style={styles.cardIcon}>📊</Text>
              </View>
              <View style={styles.cardTextContainer}>
                <Text style={styles.cardTitle}>Reports</Text>
                <Text style={styles.cardSubtitle}>View all reports</Text>
              </View>
              <View style={styles.cardArrowContainer}>
                <Text style={styles.cardArrow}>›</Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: '#F59E0B' + '15' }]}>
              <Text style={styles.sectionIconText}>🏢</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Warehouse</Text>
        </View>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('WarehouseDCAtWarehouse')}
        >
          <LinearGradient
            colors={['#F59E0B', '#D97706']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardGradient}
          >
            <View style={styles.cardContent}>
              <View style={styles.cardIconContainer}>
                <Text style={styles.cardIcon}>📦</Text>
              </View>
              <View style={styles.cardTextContainer}>
                <Text style={styles.cardTitle}>DC At Warehouse</Text>
                <Text style={styles.cardSubtitle}>Process warehouse DCs</Text>
              </View>
              <View style={styles.cardArrowContainer}>
                <Text style={styles.cardArrow}>›</Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('WarehouseInventoryItems')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}>
              <Text style={styles.cardIconWhite}>📋</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Inventory Items</Text>
              <Text style={styles.cardSubtitleWhite}>Manage inventory</Text>
            </View>
            <View style={styles.cardArrowContainer}>
              <Text style={styles.cardArrowWhite}>›</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('WarehouseSearchDC')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}>
              <Text style={styles.cardIconWhite}>🔍</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Search DC</Text>
              <Text style={styles.cardSubtitleWhite}>Search delivery challans</Text>
            </View>
            <View style={styles.cardArrowContainer}>
              <Text style={styles.cardArrowWhite}>›</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: '#14B8A6' + '15' }]}>
              <Text style={styles.sectionIconText}>🔄</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Stock Returns</Text>
        </View>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('ReturnsEmployee')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}>
              <Text style={styles.cardIconWhite}>👤</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Employee Returns</Text>
              <Text style={styles.cardSubtitleWhite}>View employee returns list</Text>
            </View>
            <View style={styles.cardArrowContainer}>
              <Text style={styles.cardArrowWhite}>›</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('ReturnsWarehouse')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}>
              <Text style={styles.cardIconWhite}>🏢</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Warehouse Returns</Text>
              <Text style={styles.cardSubtitleWhite}>View warehouse returns list</Text>
            </View>
            <View style={styles.cardArrowContainer}>
              <Text style={styles.cardArrowWhite}>›</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: '#EC4899' + '15' }]}>
              <Text style={styles.sectionIconText}>📊</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Sales & Inventory</Text>
        </View>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Sales')}
        >
          <LinearGradient
            colors={['#EC4899', '#DB2777']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardGradient}
          >
            <View style={styles.cardContent}>
              <View style={styles.cardIconContainer}>
                <Text style={styles.cardIcon}>💰</Text>
              </View>
              <View style={styles.cardTextContainer}>
                <Text style={styles.cardTitle}>Sales</Text>
                <Text style={styles.cardSubtitle}>View sales overview</Text>
              </View>
              <View style={styles.cardArrowContainer}>
                <Text style={styles.cardArrow}>›</Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Inventory')}
        >
          <View style={[styles.cardContent, styles.cardContentWhite]}>
            <View style={styles.cardIconContainer}>
              <Text style={styles.cardIconWhite}>📦</Text>
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitleWhite}>Stock Returns</Text>
              <Text style={styles.cardSubtitleWhite}>Manage returns</Text>
            </View>
            <View style={styles.cardArrowContainer}>
              <Text style={styles.cardArrowWhite}>›</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Determine which dashboard to show (order matches web Sidebar role precedence)
  const renderDashboardContent = () => {
    if (isAdmin) return renderAdminDashboard();
    if (isExecutiveManager) return renderExecutiveManagerDashboard();
    if (isWarehouseExecutive) return renderWarehouseExecutiveDashboard();
    if (isWarehouseManager) return renderWarehouseManagerDashboard();
    if (isTrainer && isSalesBDE) return renderCombinedDashboard();
    if (isTrainer) return renderTrainerDashboard();
    if (isSeniorCoordinator) return renderSeniorCoordinatorDashboard();
    if (isCoordinator) return renderCoordinatorDashboard();
    if (isManager || isFinanceManager) return renderManagerDashboard();
    if (isEmployee || isExecutive) return renderEmployeeDashboard();
    if (isSalesBDE) return renderSalesBDEDashboard();
    // Fallback: unknown role
    return (
      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Dashboard</Text>
        <Text style={styles.cardSubtitle}>No specific dashboard available for your role: {userRole || 'Unknown'}</Text>
        <Text style={[styles.cardSubtitle, { marginTop: 10, fontSize: 12 }]}>
          Roles: {JSON.stringify(userRoles)}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={gradients.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName}>{user?.name?.split(' ')[0] || 'User'}</Text>
            <View style={styles.roleBadge}>
              <View style={styles.roleBadgeDot} />
              <Text style={styles.roleBadgeText}>{userRole}</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.logoutButton} 
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <View style={styles.logoutButtonInner}>
              <Text style={styles.logoutIcon}>🚪</Text>
            </View>
          </TouchableOpacity>
        </View>
      </LinearGradient>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderDashboardContent()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTextContainer: {
    flex: 1,
  },
  greeting: {
    ...typography.body.medium,
    color: colors.textLight,
    opacity: 0.95,
    marginBottom: 6,
  },
  userName: {
    ...typography.display.small,
    color: colors.textLight,
    marginBottom: 16,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    backdropFilter: 'blur(10px)',
  },
  roleBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textLight,
    marginRight: 8,
    opacity: 0.9,
  },
  roleBadgeText: {
    ...typography.label.small,
    color: colors.textLight,
    textTransform: 'uppercase',
  },
  logoutButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logoutButtonInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutIcon: {
    fontSize: 22,
    opacity: 0.95,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionIconContainer: {
    marginRight: 12,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionIconText: {
    fontSize: 20,
  },
  sectionTitle: {
    ...typography.heading.h2,
    color: colors.textPrimary,
    flex: 1,
  },
  card: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  cardGradient: {
    borderRadius: 20,
    padding: 20,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
  },
  cardIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardIcon: {
    fontSize: 28,
  },
  cardTextContainer: {
    flex: 1,
  },
  cardTitle: {
    ...typography.heading.h3,
    color: colors.textLight,
    marginBottom: 6,
  },
  cardSubtitle: {
    ...typography.body.medium,
    color: colors.textLight,
    opacity: 0.9,
  },
  cardArrowContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  cardArrow: {
    fontSize: 20,
    color: colors.textLight,
    fontWeight: '700',
  },
  cardContentWhite: {
    padding: 20,
    backgroundColor: colors.backgroundLight,
    borderRadius: 20,
  },
  cardTitleWhite: {
    ...typography.heading.h3,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  cardSubtitleWhite: {
    ...typography.body.medium,
    color: colors.textSecondary,
  },
  cardArrowWhite: {
    fontSize: 20,
    color: colors.primary,
    fontWeight: '700',
  },
});

