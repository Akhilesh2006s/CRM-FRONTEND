import React from 'react';
import DashboardScreen from '../screens/Dashboard/DashboardScreen';

/**
 * Main screen after login: Home, with every module in the side menu (☰) like the web sidebar.
 * The bottom tabs (Home / Reports / More) were replaced by the side menu; the route keeps the
 * name MainTabs so existing navigate('MainTabs', …) calls still land on Home.
 */
export default function MainTabs() {
  return <DashboardScreen />;
}
