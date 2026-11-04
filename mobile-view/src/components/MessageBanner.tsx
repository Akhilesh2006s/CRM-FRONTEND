import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { typography } from '../theme/typography';

interface MessageBannerProps {
  type: 'success' | 'error';
  message: string;
  onDismiss?: () => void;
  actionLabel?: string;
  onAction?: () => void;
}

export default function MessageBanner({
  type,
  message,
  onDismiss,
  actionLabel,
  onAction,
}: MessageBannerProps) {
  const isSuccess = type === 'success';

  return (
    <View style={[styles.banner, isSuccess ? styles.successBanner : styles.errorBanner]}>
      <Text style={[styles.icon, isSuccess ? styles.successIcon : styles.errorIcon]}>
        {isSuccess ? '✓' : '!'}
      </Text>
      <Text style={[styles.text, isSuccess ? styles.successText : styles.errorText]}>{message}</Text>
      {isSuccess && actionLabel && onAction && (
        <TouchableOpacity style={styles.actionButton} onPress={onAction}>
          <Text style={styles.actionButtonText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
      {!isSuccess && onDismiss && (
        <TouchableOpacity onPress={onDismiss} style={styles.dismissButton}>
          <Text style={styles.dismissText}>Dismiss</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
  },
  successBanner: { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' },
  errorBanner: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
  icon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    overflow: 'hidden',
    textAlign: 'center',
    lineHeight: 22,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  successIcon: { backgroundColor: '#16A34A' },
  errorIcon: { backgroundColor: '#DC2626' },
  text: { flex: 1, minWidth: 160, fontSize: 14, lineHeight: 20 },
  successText: { color: '#14532D', fontWeight: '600' },
  errorText: { color: '#7F1D1D' },
  actionButton: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  dismissButton: { paddingHorizontal: 4, paddingVertical: 4 },
  dismissText: { color: '#B91C1C', fontWeight: '700', fontSize: 13 },
});
