/**
 * Mobile ports of web components/products/ProductStreamsField, ProductRelatedItemsField,
 * ProductSpecimenItemsField plus the Classes picker of the product form.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { WebInput, WebSelect } from '../../ui/WebPrimitives';
import { matchStream, streamLabel, suggestStreamName, type StreamCombo } from '../../lib/crm/iitStreams';
import { emptyRelatedItem, type ProductRelatedItem, type ProductSpecimenItem } from '../../lib/productFields';

function Chip({ label, onRemove, variant = 'outline' }: { label: string; onRemove: () => void; variant?: 'outline' | 'secondary' }) {
  return (
    <View style={[styles.chip, variant === 'secondary' && styles.chipSecondary]}>
      <Text style={styles.chipText}>{label}</Text>
      <TouchableOpacity onPress={onRemove} hitSlop={8} accessibilityLabel={`Remove ${label}`}>
        <Text style={styles.chipRemove}>×</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ---------------------------------- Classes ---------------------------------- */

export function ProductClassesField({ value, onChange }: { value: string[]; onChange: (classes: string[]) => void }) {
  const [newClass, setNewClass] = useState('');
  const add = () => {
    const v = newClass.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setNewClass('');
  };
  return (
    <View style={styles.section}>
      <Text style={styles.label}>Classes</Text>
      <Text style={styles.hint}>Choose the classes available for this product.</Text>
      <View style={styles.addRow}>
        <View style={{ flex: 1 }}>
          <WebInput value={newClass} onChangeText={setNewClass} placeholder="Class name or number" onSubmitEditing={add} style={styles.inputTight} />
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={add}>
          <Text style={styles.addBtnText}>Add Class</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.chipWrap}>
        {value.map((c) => (
          <Chip key={c} label={c} onRemove={() => onChange(value.filter((x) => x !== c))} />
        ))}
      </View>
    </View>
  );
}

/* ---------------------------------- Streams ---------------------------------- */

/** Streams: named combinations of this product's subjects, offered in the lead / DC Stream dropdown. */
export function ProductStreamsField({
  value,
  onChange,
  subjects,
}: {
  value: StreamCombo[];
  onChange: (streams: StreamCombo[]) => void;
  /** The product's subjects (Deliverables on this form). */
  subjects: string[];
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [nameEdited, setNameEdited] = useState(false);

  const toggle = (subject: string) => {
    const on = !picked.includes(subject);
    // Keep the product's subject order so names read the same way every time.
    const next = subjects.filter((s) => (s === subject ? on : picked.includes(s)));
    setPicked(next);
    if (!nameEdited) setName(suggestStreamName(next));
  };

  const add = () => {
    const streamName = name.trim();
    if (picked.length === 0) return Alert.alert('Streams', 'Tick the subjects in this stream.');
    if (!streamName) return Alert.alert('Streams', 'Enter a name for the stream.');
    if (value.some((c) => c.name.trim().toLowerCase() === streamName.toLowerCase())) {
      return Alert.alert('Streams', `A stream named ${streamName} already exists.`);
    }
    const existing = matchStream(picked.join(' + '), value);
    if (existing) return Alert.alert('Streams', `${existing} already has these subjects.`);
    onChange([...value, { name: streamName, subjects: picked }]);
    setPicked([]);
    setName('');
    setNameEdited(false);
  };

  return (
    <View style={styles.section}>
      <Text style={styles.label}>Streams</Text>
      <Text style={styles.hint}>
        Subject combinations offered in the lead and DC Stream dropdown. Tick this product's subjects, name the stream (e.g. MPC), and add it.
      </Text>
      {subjects.length === 0 ? (
        <Text style={styles.warn}>Add this product's deliverables first; streams are made from them.</Text>
      ) : (
        <View style={styles.box}>
          <View style={styles.chipWrap}>
            {subjects.map((subject) => {
              const on = picked.includes(subject);
              return (
                <TouchableOpacity key={subject} style={styles.checkRow} onPress={() => toggle(subject)}>
                  <Ionicons name={on ? 'checkbox' : 'square-outline'} size={20} color={on ? colors.primary : colors.textMuted} />
                  <Text style={styles.checkText}>{subject}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.addRow}>
            <View style={{ flex: 1 }}>
              <WebInput
                value={name}
                onChangeText={(t) => {
                  setName(t);
                  setNameEdited(true);
                }}
                placeholder="Stream name, e.g. MPC"
                onSubmitEditing={add}
                style={styles.inputTight}
              />
            </View>
            <TouchableOpacity style={styles.addBtn} onPress={add}>
              <Text style={styles.addBtnText}>Add Stream</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {value.length > 0 ? (
        <View style={[styles.chipWrap, { marginTop: 8 }]}>
          {value.map((combo) => (
            <Chip
              key={combo.name}
              variant="secondary"
              label={streamLabel(combo.name, value)}
              onRemove={() => onChange(value.filter((item) => item.name !== combo.name))}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/* ------------------------------- Related items ------------------------------- */

/** Items that ship with the product on every DC (e.g. EEL: Tensmat; IIT: Teacher Books). */
export function ProductRelatedItemsField({
  value,
  onChange,
}: {
  value: ProductRelatedItem[];
  onChange: (items: ProductRelatedItem[]) => void;
}) {
  const update = (index: number, patch: Partial<ProductRelatedItem>) =>
    onChange(value.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  return (
    <View style={styles.section}>
      <Text style={styles.label}>Product Related Items</Text>
      <Text style={styles.hint}>
        Added to every DC for this product. Billable items are charged at their price; non-billable items go as Training Material at ₹0.
      </Text>
      {value.map((item, index) => (
        <View key={index} style={styles.box}>
          <Text style={styles.smallLabel}>Item name *</Text>
          <WebInput value={item.name} onChangeText={(t) => update(index, { name: t })} placeholder="e.g. Tensmat" style={styles.inputTight} />
          <View style={styles.twoCol}>
            <View style={{ flex: 1 }}>
              <WebSelect
                label="Billing"
                compact
                value={item.billable ? 'billable' : 'free'}
                onValueChange={(v) => update(index, { billable: v === 'billable', ...(v === 'free' ? { price: 0 } : {}) })}
                items={[
                  { label: 'Billable', value: 'billable' },
                  { label: 'Non-billable', value: 'free' },
                ]}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.smallLabel}>Price ₹{item.billable ? ' *' : ''}</Text>
              <WebInput
                value={item.billable ? (item.price ? String(item.price) : '') : '0'}
                onChangeText={(t) => {
                  const raw = t.replace(/[^\d.]/g, '');
                  update(index, { price: Number(raw) || 0 });
                }}
                editable={item.billable}
                keyboardType="decimal-pad"
                style={[styles.inputTight, !item.billable && styles.disabled]}
              />
            </View>
          </View>
          <View style={styles.twoCol}>
            <View style={{ flex: 1 }}>
              <WebSelect
                label="Quantity basis"
                compact
                value={item.basis}
                onValueChange={(v) => update(index, { basis: v === 'per_class' ? 'per_class' : 'per_student' })}
                items={[
                  { label: 'Per student', value: 'per_student' },
                  { label: 'Per class', value: 'per_class' },
                ]}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.smallLabel}>Qty</Text>
              <WebInput
                value={item.quantity ? String(item.quantity) : ''}
                onChangeText={(t) => update(index, { quantity: Math.floor(Number(t.replace(/\D/g, ''))) || 0 })}
                onBlur={() => update(index, { quantity: Math.max(1, Math.floor(Number(item.quantity)) || 1) })}
                keyboardType="number-pad"
                style={styles.inputTight}
              />
            </View>
          </View>
          <TouchableOpacity style={styles.removeBtn} onPress={() => onChange(value.filter((_, i) => i !== index))}>
            <Text style={styles.removeBtnText}>Remove</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity style={styles.outlineBtn} onPress={() => onChange([...value, emptyRelatedItem()])}>
        <Text style={styles.outlineBtnText}>+ Add related item</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ------------------------------- Specimen set -------------------------------- */

/** Products sent as this product's specimen set (e.g. ABACUS: Level 1 Book, Flash Cards). */
export function ProductSpecimenItemsField({
  value,
  onChange,
  productOptions,
}: {
  value: ProductSpecimenItem[];
  onChange: (items: ProductSpecimenItem[]) => void;
  /** Catalogue product names offered in the dropdown. */
  productOptions: string[];
}) {
  const update = (index: number, patch: Partial<ProductSpecimenItem>) =>
    onChange(value.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  return (
    <View style={styles.section}>
      <Text style={styles.label}>Specimen Set</Text>
      <Text style={styles.hint}>
        Products sent when a school asks for specimen copies of this product. In the lead, the BDE ticks which of these to send. Leave empty to send one set as per the DC list.
      </Text>
      {value.map((item, index) => {
        const options = [...new Set([...(item.product ? [item.product] : []), ...productOptions])];
        return (
          <View key={index} style={styles.box}>
            <View style={styles.twoCol}>
              <View style={{ flex: 2 }}>
                <WebSelect
                  label="Product *"
                  compact
                  value={item.product}
                  onValueChange={(v) => update(index, { product: v })}
                  placeholder="Select product"
                  items={options.map((n) => ({ label: n, value: n }))}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.smallLabel}>Qty per set</Text>
                <WebInput
                  value={item.quantity ? String(item.quantity) : ''}
                  onChangeText={(t) => update(index, { quantity: Math.floor(Number(t.replace(/\D/g, ''))) || 0 })}
                  onBlur={() => update(index, { quantity: Math.max(1, Math.floor(Number(item.quantity)) || 1) })}
                  keyboardType="number-pad"
                  style={styles.inputTight}
                />
              </View>
            </View>
            <TouchableOpacity style={styles.removeBtn} onPress={() => onChange(value.filter((_, i) => i !== index))}>
              <Text style={styles.removeBtnText}>Remove</Text>
            </TouchableOpacity>
          </View>
        );
      })}
      <TouchableOpacity style={styles.outlineBtn} onPress={() => onChange([...value, { product: '', quantity: 1 }])}>
        <Text style={styles.outlineBtnText}>+ Add specimen product</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 },
  smallLabel: { fontSize: 12, fontWeight: '500', color: colors.textSecondary, marginBottom: 4 },
  hint: { fontSize: 12, color: colors.textSecondary, marginBottom: 8, lineHeight: 17 },
  warn: { fontSize: 13, color: colors.warning },
  box: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, marginBottom: 8, backgroundColor: colors.backgroundLight },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputTight: { marginBottom: 6 },
  disabled: { backgroundColor: colors.backgroundMuted, color: colors.textMuted },
  addBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.primary, marginBottom: 6 },
  addBtnText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.backgroundLight,
  },
  chipSecondary: { backgroundColor: colors.accent, borderColor: colors.infoLight },
  chipText: { fontSize: 13, color: colors.textPrimary },
  chipRemove: { fontSize: 16, fontWeight: '700', color: colors.error },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, marginRight: 8 },
  checkText: { fontSize: 14, color: colors.textPrimary },
  twoCol: { flexDirection: 'row', gap: 8 },
  removeBtn: { alignSelf: 'flex-end', paddingHorizontal: 10, paddingVertical: 6 },
  removeBtnText: { color: colors.error, fontWeight: '600', fontSize: 13 },
  outlineBtn: { alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  outlineBtnText: { color: colors.textPrimary, fontWeight: '600', fontSize: 13 },
});
