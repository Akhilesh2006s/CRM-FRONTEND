import React, { useCallback, useRef } from 'react';
import { View, BackHandler, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DashboardScreen from '../screens/Dashboard/DashboardScreen';
import ReportsLeadsScreen from '../screens/Reports/ReportsLeadsScreen';
import MoreHubScreen from '../screens/Navigation/MoreHubScreen';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { getRoleFlags } from '../utils/roles';

const Tab = createBottomTabNavigator();

type IonName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, { focused: IonName; unfocused: IonName }> = {
  Home: { focused: 'home', unfocused: 'home-outline' },
  Menu: { focused: 'grid', unfocused: 'grid-outline' },
  Reports: { focused: 'bar-chart', unfocused: 'bar-chart-outline' },
  More: { focused: 'ellipsis-horizontal-circle', unfocused: 'ellipsis-horizontal-circle-outline' },
};

function TabIcon({
  routeName,
  color,
  size,
  focused,
}: {
  routeName: string;
  color: string;
  size: number;
  focused: boolean;
}) {
  const entry = TAB_ICONS[routeName];
  const name = entry ? (focused ? entry.focused : entry.unfocused) : 'ellipse-outline';
  // Wrap icon so tab-bar Animated does not treat Ionicons class as an animatable host
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={name} size={size} color={color} />
    </View>
  );
}

export default function MainTabs() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);
  const tabRef = useRef<any>(null);
  const { user } = useAuth();
  const flags = getRoleFlags(user);
  // Leads Reports are for sales roles; Product Heads and Trainers do not work leads.
  const showReports = !flags.isManager && !flags.isTrainer;

  // Native stack calls exitApp() on Android back from the root screen.
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        const nav = tabRef.current;
        const state = nav?.getState?.();
        const current = state?.routes?.[state.index]?.name;
        if (current && current !== 'Home') {
          nav.navigate('Home');
        }
        return true;
      });
      return () => sub.remove();
    }, [])
  );

  return (
    <Tab.Navigator
      ref={tabRef}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
        tabBarStyle: {
          paddingTop: 6,
          paddingBottom: bottomInset,
          height: 52 + bottomInset,
          backgroundColor: colors.backgroundLight,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          elevation: 8,
          shadowColor: colors.shadowDark,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
        },
        lazy: true,
        tabBarIcon: ({ color, size, focused }) => (
          <TabIcon routeName={route.name} color={color} size={size} focused={focused} />
        ),
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} options={{ tabBarLabel: 'Home' }} />
      {showReports ? <Tab.Screen name="Reports" component={ReportsLeadsScreen} options={{ tabBarLabel: 'Reports' }} /> : null}
      <Tab.Screen name="More" component={MoreHubScreen} options={{ tabBarLabel: 'More' }} />
    </Tab.Navigator>
  );
}
