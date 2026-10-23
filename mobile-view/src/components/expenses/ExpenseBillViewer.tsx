import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Image, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../../theme/colors';
import { resolveUploadUrl, isPdfUrl, isImageUrl } from '../../lib/expenseFiles';

let WebView: any = null;
try {
  WebView = require('react-native-webview').WebView;
} catch (_) {
  WebView = null;
}

/** Shows a bill / ticket inside the app (image or PDF) — mirrors web ExpenseBillDialog. */
export function ExpenseBillModal({
  url,
  title = 'Bill',
  visible,
  onClose,
}: {
  url?: string | null;
  title?: string;
  visible: boolean;
  onClose: () => void;
}) {
  const href = resolveUploadUrl(url);
  const pdf = !!href && isPdfUrl(href);

  const renderBody = () => {
    if (!href) return <Text style={styles.empty}>No bill uploaded.</Text>;
    if (pdf) {
      if (Platform.OS === 'web') {
        return React.createElement('iframe', {
          src: href,
          title,
          style: { width: '100%', height: '100%', border: 'none' },
        });
      }
      if (WebView) {
        // Android WebView cannot render PDFs natively — use Google Docs viewer there.
        const uri =
          Platform.OS === 'android' && !href.startsWith('data:')
            ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(href)}`
            : href;
        return <WebView source={{ uri }} style={styles.fill} startInLoadingState />;
      }
      return (
        <TouchableOpacity style={styles.openBtn} onPress={() => Linking.openURL(href).catch(() => {})}>
          <Text style={styles.openBtnText}>Open PDF</Text>
        </TouchableOpacity>
      );
    }
    return <Image source={{ uri: href }} style={styles.fill} resizeMode="contain" />;
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={26} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.body}>{renderBody()}</View>
      </View>
    </Modal>
  );
}

/** Thumbnail / icon that opens the bill in the in-app viewer (renders nothing without a URL). */
export function ExpenseBillButton({ label, url }: { label: string; url?: string | null }) {
  const [open, setOpen] = useState(false);
  const href = resolveUploadUrl(url);
  if (!href) return null;
  return (
    <>
      <TouchableOpacity style={styles.thumbBtn} onPress={() => setOpen(true)} accessibilityLabel={`View ${label}`}>
        {isImageUrl(href) ? (
          <Image source={{ uri: href }} style={styles.thumb} />
        ) : (
          <Ionicons name="document-text-outline" size={32} color={colors.primary} />
        )}
        <Text style={styles.thumbLabel}>{label}</Text>
      </TouchableOpacity>
      <ExpenseBillModal url={url} title={label} visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

export default ExpenseBillModal;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.backgroundLight },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  body: { flex: 1, backgroundColor: colors.backgroundMuted },
  fill: { flex: 1, width: '100%' },
  empty: { textAlign: 'center', paddingVertical: 32, color: colors.textSecondary },
  openBtn: {
    margin: spacing.lg,
    padding: 14,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  openBtnText: { color: colors.primaryForeground, fontWeight: '600' },
  thumbBtn: { alignItems: 'center', gap: 4, marginRight: spacing.md },
  thumb: { width: 56, height: 56, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border },
  thumbLabel: { fontSize: 12, color: colors.primary },
});
