import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '../../ui/ScreenShell';
import { navigateRoot } from '../../navigation/navigationRef';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

type LeadOption = {
  title: string;
  subtitle: string;
  screen: string;
  colors: [string, string];
  icon: keyof typeof Ionicons.glyphMap;
};

const OPTIONS: LeadOption[] = [
  {
    title: 'New School',
    subtitle: 'Add a new school lead',
    screen: 'LeadAddNewSchool',
    colors: ['#3B82F6', '#2563EB'],
    icon: 'school-outline',
  },
  {
    title: 'Renewal Leads',
    subtitle: 'Search existing schools and submit renewal leads',
    screen: 'LeadsRenewalList',
    colors: ['#22C55E', '#16A34A'],
    icon: 'refresh-outline',
  },
  {
    title: 'Followup Leads',
    subtitle: 'View and manage followup leads',
    screen: 'LeadFollowup',
    colors: ['#F97316', '#EA580C'],
    icon: 'call-outline',
  },
];

export default function LeadAddScreen() {
  return (
    <ScreenShell title="Add Lead" subtitle="Select the type of lead you want to add">
      {OPTIONS.map((opt) => (
        <TouchableOpacity
          key={opt.screen}
          style={styles.card}
          activeOpacity={0.85}
          onPress={() => navigateRoot(opt.screen)}
        >
          <LinearGradient colors={opt.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardGradient}>
            <View style={styles.cardContent}>
              <View style={styles.iconBox}>
                <Ionicons name={opt.icon} size={28} color="#FFFFFF" />
              </View>
              <View style={styles.textBox}>
                <Text style={styles.cardTitle}>{opt.title}</Text>
                <Text style={styles.cardSubtitle}>{opt.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.95)" />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      ))}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 14,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
  },
  cardGradient: {
    borderRadius: 18,
    padding: 20,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  textBox: { flex: 1 },
  cardTitle: {
    ...typography.heading.h3,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  cardSubtitle: {
    ...typography.body.small,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 18,
  },
});
