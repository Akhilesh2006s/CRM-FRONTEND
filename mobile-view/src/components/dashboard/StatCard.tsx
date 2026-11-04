import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PremiumIcon from '../ui/PremiumIcon';
import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

type IonName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  label: string;
  value: string | number;
  subtitle?: string;
  ion: IonName;
  color: string;
  bg: string;
};

export default function StatCard({ label, value, subtitle, ion, color, bg }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <PremiumIcon name={ion} color={color} bg={bg} size={18} />
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      {subtitle ? (
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '46%',
    maxWidth: '48.5%',
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
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textTertiary,
    marginTop: 10,
  },
  value: {
    flexShrink: 1,
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
});
