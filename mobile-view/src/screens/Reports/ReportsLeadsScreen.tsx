import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '../../ui/ScreenShell';
import { Card } from '../../ui/Kit';
import { colors } from '../../theme/colors';

const cards = [
  {
    title: 'Open Leads',
    description: 'View all pending and processing leads',
    route: 'ReportsLeadsOpen',
    icon: 'document-text-outline' as const,
    iconBg: '#3b82f6',
  },
  {
    title: 'Follow-up Leads',
    description: 'Open leads in the follow-up pipeline',
    route: 'ReportsLeadsFollowup',
    icon: 'time-outline' as const,
    iconBg: '#f97316',
  },
  {
    title: 'Closed Leads',
    description: 'View all successfully closed leads',
    route: 'ReportsLeadsClosed',
    icon: 'checkmark-circle-outline' as const,
    iconBg: '#22c55e',
  },
];

export default function ReportsLeadsScreen({ navigation }: any) {
  return (
    <ScreenShell title="Leads Reports" subtitle="Pick a report to view lead details">
      {cards.map((card) => (
        <Card key={card.title} onPress={() => navigation.navigate(card.route)}>
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: `${card.iconBg}1A` }]}>
              <Ionicons name={card.icon} size={22} color={card.iconBg} />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardDescription}>{card.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </View>
        </Card>
      ))}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  textWrap: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  cardDescription: { fontSize: 13, color: colors.textTertiary, marginTop: 2 },
});
