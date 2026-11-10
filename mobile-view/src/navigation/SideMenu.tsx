import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { getNavSections, MY_DATA_TITLE, type NavSection } from '../config/navConfig';
import { iconForSection } from '../config/moduleIcons';
import { navigateRoot } from './navigationRef';
import { getRoleFlags } from '../utils/roles';
import { confirmLogout } from '../utils/confirmLogout';
import { colors } from '../theme/colors';

type IonName = React.ComponentProps<typeof Ionicons>['name'];

/** Menu sections for this login (web sidebar order), plus Reports and Settings as on the old tabs. */
export function menuSections(user: any): NavSection[] {
  const flags = getRoleFlags(user);
  const sections = getNavSections(user);
  const has = (screen: string) => sections.some((s) => s.items.some((i) => i.screen === screen));
  const out = [...sections];
  // Leads Reports were a bottom tab for sales roles.
  if (!flags.isManager && !flags.isTrainer && !flags.isPartner && !has('ReportsLeads')) {
    const at = out.findIndex((s) => s.title === MY_DATA_TITLE || s.title === 'Settings');
    const reports: NavSection = { title: 'Reports', items: [{ label: 'Leads Report', screen: 'ReportsLeads' }] };
    if (at >= 0) out.splice(at, 0, reports);
    else out.push(reports);
  }
  if (!out.some((s) => s.title === 'Settings')) {
    const items = [{ label: 'Change Password', screen: 'SettingsPassword' }];
    if (flags.isAdmin) {
      items.push(
        { label: 'App Data Upload', screen: 'SettingsUpload' },
        { label: 'SMS Settings', screen: 'SettingsSMS' },
        { label: 'DB Backup', screen: 'SettingsBackup' },
        { label: 'Expense Policy', screen: 'SettingsExpenses' },
      );
    }
    out.push({ title: 'Settings', items });
  }
  return out;
}

const WIDTH = Math.min(320, Math.round(Dimensions.get('window').width * 0.84));

/** Side menu (drawer) like the web sidebar: each module expands to its options. */
export default function SideMenu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const x = useRef(new Animated.Value(-WIDTH)).current;
  const [mounted, setMounted] = useState(visible);
  const [openTitle, setOpenTitle] = useState<string | null>(null);
  const sections = menuSections(user);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(x, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    } else {
      Animated.timing(x, { toValue: -WIDTH, duration: 180, useNativeDriver: true }).start(() => setMounted(false));
    }
  }, [visible, x]);

  const go = (screen: string, params?: object) => {
    onClose();
    // Let the drawer close before the next screen slides in.
    setTimeout(() => navigateRoot(screen, params), 120);
  };

  const initial = (user?.name || 'U').trim().charAt(0).toUpperCase();

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close menu" />
        <Animated.View style={[styles.panel, { width: WIDTH, transform: [{ translateX: x }], paddingTop: insets.top }]}>
          <View style={styles.profile}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{user?.name || 'User'}</Text>
              {user?.role ? <Text style={styles.role} numberOfLines={1}>{user.role}</Text> : null}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel="Close menu">
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
            <TouchableOpacity style={styles.section} onPress={() => go('MainTabs')}>
              <Ionicons name="home-outline" size={20} color={colors.primaryDark} />
              <Text style={styles.sectionText}>Home</Text>
            </TouchableOpacity>
            {sections.map((s) => {
              const single = s.items.length === 1;
              const open = openTitle === s.title;
              return (
                <View key={s.title}>
                  <TouchableOpacity
                    style={styles.section}
                    onPress={() => (single ? go(s.items[0].screen, s.items[0].params) : setOpenTitle(open ? null : s.title))}
                  >
                    <Ionicons name={iconForSection(s.title) as IonName} size={20} color={colors.primaryDark} />
                    <Text style={styles.sectionText}>{single ? s.items[0].label : s.title}</Text>
                    {single ? null : <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />}
                  </TouchableOpacity>
                  {open && !single
                    ? s.items.map((item, i) => (
                        <TouchableOpacity key={`${item.screen}-${i}`} style={styles.item} onPress={() => go(item.screen, item.params)}>
                          <Text style={styles.itemText}>{item.label}</Text>
                        </TouchableOpacity>
                      ))
                    : null}
                </View>
              );
            })}
            <TouchableOpacity style={[styles.section, styles.logout]} onPress={() => { onClose(); confirmLogout(logout); }}>
              <Ionicons name="log-out-outline" size={20} color="#B91C1C" />
              <Text style={[styles.sectionText, { color: '#B91C1C' }]}>Sign out</Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.45)' },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.backgroundLight,
    shadowColor: '#0F172A',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 16,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '700', color: colors.primaryDark },
  name: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  role: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  section: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, minHeight: 48 },
  sectionText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  item: { paddingLeft: 48, paddingRight: 16, minHeight: 42, justifyContent: 'center' },
  itemText: { fontSize: 14, color: colors.textSecondary },
  logout: { marginTop: 8, borderTopWidth: 1, borderTopColor: '#EEF2F7' },
});
