/**
 * Pick which columns and header blocks the Delivery Challan prints; the choice is remembered.
 * Same options as the web (components/dc/DcPrintOptionsDialog.tsx).
 */
import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { WebButton } from '../../ui/WebPrimitives';
import { colors } from '../../theme/colors';
import {
  DC_PRINT_COLUMNS,
  DC_PRINT_SECTIONS,
  DEFAULT_DC_PRINT_OPTIONS,
  loadDcPrintOptions,
  saveDcPrintOptions,
  type DcPrintColumn,
  type DcPrintOptions,
  type DcPrintSection,
} from '../../lib/dcChallan';

function CheckRow({ label, checked, disabled, onPress }: { label: string; checked: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.checkRow}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
    >
      <View style={[styles.box, checked && styles.boxChecked, disabled && styles.boxDisabled]}>
        {checked ? <Text style={styles.tick}>✓</Text> : null}
      </View>
      <Text style={[styles.checkLabel, disabled && styles.checkLabelDisabled]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function DcPrintOptionsModal({
  visible,
  onClose,
  onPrint,
  busy,
}: {
  visible: boolean;
  onClose: () => void;
  onPrint: (options: DcPrintOptions) => void;
  busy?: boolean;
}) {
  const [options, setOptions] = useState<DcPrintOptions>(DEFAULT_DC_PRINT_OPTIONS);
  useEffect(() => {
    if (!visible) return;
    let live = true;
    loadDcPrintOptions().then((o) => {
      if (live) setOptions(o);
    });
    return () => {
      live = false;
    };
  }, [visible]);

  const toggleColumn = (key: DcPrintColumn) => {
    if (key === 'qty') return;
    setOptions((o) => ({ ...o, columns: o.columns.includes(key) ? o.columns.filter((c) => c !== key) : [...o.columns, key] }));
  };
  const toggleSection = (key: DcPrintSection) =>
    setOptions((o) => ({ ...o, sections: o.sections.includes(key) ? o.sections.filter((c) => c !== key) : [...o.sections, key] }));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Print Delivery Challan</Text>
            <TouchableOpacity onPress={onClose} disabled={busy}>
              <Text style={styles.close}>Close</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.description}>Choose what the printout shows. Your choice is remembered for the next DC.</Text>
            <Text style={styles.groupTitle}>Table columns</Text>
            <View style={styles.grid}>
              {DC_PRINT_COLUMNS.map((c) => (
                <View key={c.key} style={styles.gridCell}>
                  <CheckRow
                    label={`${c.label}${c.key === 'qty' ? ' (always)' : ''}`}
                    checked={options.columns.includes(c.key)}
                    disabled={c.key === 'qty'}
                    onPress={() => toggleColumn(c.key)}
                  />
                </View>
              ))}
            </View>
            <Text style={styles.groupTitle}>Details at the top</Text>
            {DC_PRINT_SECTIONS.map((s) => (
              <CheckRow key={s.key} label={s.label} checked={options.sections.includes(s.key)} onPress={() => toggleSection(s.key)} />
            ))}
            <Text style={styles.hint}>DC No and DC Date always print.</Text>
            <View style={styles.footer}>
              <View style={styles.footerBtn}>
                <WebButton title="Reset to default" variant="outline" onPress={() => setOptions(DEFAULT_DC_PRINT_OPTIONS)} disabled={busy} />
              </View>
              <View style={styles.footerBtn}>
                <WebButton
                  title={busy ? 'Preparing…' : 'Print'}
                  loading={busy}
                  disabled={busy}
                  onPress={() => {
                    saveDcPrintOptions(options);
                    onPrint(options);
                  }}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default DcPrintOptionsModal;

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.backgroundLight || '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '90%' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  close: { fontSize: 15, fontWeight: '600', color: colors.primary },
  body: { padding: 16, paddingBottom: 32 },
  description: { fontSize: 13, color: colors.textSecondary, marginBottom: 12 },
  groupTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginTop: 8, marginBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridCell: { width: '50%' },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  box: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  boxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  boxDisabled: { opacity: 0.55 },
  tick: { color: '#fff', fontSize: 13, fontWeight: '700', lineHeight: 15 },
  checkLabel: { flex: 1, fontSize: 14, color: colors.textPrimary },
  checkLabelDisabled: { color: colors.textSecondary },
  hint: { fontSize: 12, color: colors.textSecondary, marginTop: 6 },
  footer: { flexDirection: 'row', gap: 10, marginTop: 18 },
  footerBtn: { flex: 1 },
});
