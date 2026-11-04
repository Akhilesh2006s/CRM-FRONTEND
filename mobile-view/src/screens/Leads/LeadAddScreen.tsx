import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '../../ui/ScreenShell';
import { navigateRoot } from '../../navigation/navigationRef';
import { colors } from '../../theme/colors';
import { Card } from '../../ui/Kit';

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
        <Card key={opt.screen} onPress={() => navigateRoot(opt.screen)}>
          <View style={styles.cardContent}>
            <View style={[styles.iconBox, { backgroundColor: opt.colors[0] + '1A' }]}>
              <Ionicons name={opt.icon} size={24} color={opt.colors[1]} />
            </View>
            <View style={styles.textBox}>
              <Text style={styles.cardTitle}>{opt.title}</Text>
              <Text style={styles.cardSubtitle}>{opt.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </View>
        </Card>
      ))}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  cardContent: { flexDirection: 'row', alignItems: 'center' },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textBox: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  cardSubtitle: { fontSize: 13, color: colors.textTertiary },
});
