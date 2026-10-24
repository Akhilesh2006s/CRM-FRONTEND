/**
 * Transport details entered by the BDE (Transport Name, Transport To, location, landmark, pincode).
 * Coordinators can unlock and correct them: PUT /dc-orders/:id with the same keys the web sends
 * (components/dc/TransportDetailsSection.tsx).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { WebInput, WebButton } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { colors } from '../../theme/colors';
import { TransportNameField, TransportToFields, transportToError, transportToLabel } from './TransportFields';

export type TransportDetails = {
  transport_name?: string;
  transport_location?: string;
  transportation_landmark?: string;
  pincode?: string;
  transport_to?: string;
  transport_to_name?: string;
  transport_to_mobile?: string;
};

const SAVED_KEYS: (keyof TransportDetails)[] = [
  'transport_name',
  'transport_location',
  'transportation_landmark',
  'pincode',
  'transport_to',
  'transport_to_name',
  'transport_to_mobile',
];

/** Plain text fields (Transport Name and Transport To have their own dropdowns). */
const FIELDS: { key: keyof TransportDetails; label: string }[] = [
  { key: 'transport_location', label: 'Transport Location' },
  { key: 'transportation_landmark', label: 'Transportation Landmark' },
  { key: 'pincode', label: 'Pincode' },
];

export function canEditTransportDetails(role?: string) {
  return role === 'Coordinator' || role === 'Senior Coordinator';
}

/** Transport details of an order, with the BDE's pendingEdit values taking precedence (web buildTransportDisplay). */
export function transportDetailsFromOrder(order: any): TransportDetails {
  const pe = order?.pendingEdit || {};
  const req = order?.dcRequestData || {};
  const pick = (key: keyof TransportDetails) => String(pe[key] || order?.[key] || req[key] || '').trim();
  return Object.fromEntries(SAVED_KEYS.map((k) => [k, pick(k)])) as TransportDetails;
}

export function TransportDetailsSection({
  dcOrderId,
  details,
  canEdit,
  onSaved,
  title = 'Delivery and Address',
  subtitle = 'Transport details entered by the BDE',
  bde,
  school,
  inputStyle,
  disabledInputStyle,
}: {
  dcOrderId?: string;
  details: TransportDetails;
  canEdit: boolean;
  onSaved?: (details: TransportDetails) => void;
  title?: string;
  subtitle?: string;
  /** Prefill for Transport To = BDE / School. */
  bde?: { name?: string; mobile?: string };
  school?: { name?: string; mobile?: string };
  inputStyle?: any;
  disabledInputStyle?: any;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<TransportDetails>(details);

  useEffect(() => {
    if (!editing) setDraft(details);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [details, editing]);

  const save = async () => {
    if (!dcOrderId) return;
    const pincode = String(draft.pincode || '').trim();
    if (pincode && !/^\d{6}$/.test(pincode)) {
      Alert.alert('Invalid pincode', 'Pincode must be 6 digits.');
      return;
    }
    const toProblem = draft.transport_to || draft.transport_to_name ? transportToError(draft) : '';
    if (toProblem) {
      Alert.alert('Transport To', toProblem);
      return;
    }
    setSaving(true);
    try {
      const payload = Object.fromEntries(SAVED_KEYS.map((key) => [key, String(draft[key] || '').trim()])) as TransportDetails;
      await apiService.put(`/dc-orders/${dcOrderId}`, payload);
      onSaved?.(payload);
      setEditing(false);
      Alert.alert('Saved', 'Transport details updated');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Unable to update transport details.');
    } finally {
      setSaving(false);
    }
  };

  const readOnly = (label: string, value?: string) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <WebInput style={[inputStyle, styles.disabled, disabledInputStyle]} value={value || ''} editable={false} placeholder="-" />
    </View>
  );

  return (
    <View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {canEdit && dcOrderId ? (
        <View style={styles.actions}>
          {editing ? (
            <>
              <View style={styles.actionBtn}>
                <WebButton
                  title="Cancel"
                  variant="outline"
                  disabled={saving}
                  onPress={() => {
                    setDraft(details);
                    setEditing(false);
                  }}
                />
              </View>
              <View style={styles.actionBtn}>
                <WebButton title={saving ? 'Saving…' : 'Save transport details'} onPress={save} disabled={saving} loading={saving} />
              </View>
            </>
          ) : (
            <View style={styles.actionBtn}>
              <WebButton title="Edit transport details" variant="outline" onPress={() => setEditing(true)} />
            </View>
          )}
        </View>
      ) : null}

      {editing ? (
        <>
          <TransportNameField
            label="Transport Name"
            inputStyle={inputStyle}
            value={draft.transport_name || ''}
            onChange={(transport_name) => setDraft((d) => ({ ...d, transport_name }))}
          />
          <TransportToFields
            inputStyle={inputStyle}
            value={draft}
            onChange={(next) => setDraft((d) => ({ ...d, ...next }))}
            bde={bde}
            school={school}
          />
          <View style={{ height: 10 }} />
        </>
      ) : (
        <>
          {readOnly('Transport Name', details.transport_name)}
          {readOnly('Transport To', transportToLabel(details))}
        </>
      )}
      {FIELDS.map(({ key, label }) =>
        editing ? (
          <View key={key} style={styles.field}>
            <Text style={styles.label}>{label}</Text>
            <WebInput
              style={inputStyle}
              value={draft[key] || ''}
              keyboardType={key === 'pincode' ? 'number-pad' : 'default'}
              maxLength={key === 'pincode' ? 6 : undefined}
              placeholder={label}
              onChangeText={(t) =>
                setDraft((d) => ({ ...d, [key]: key === 'pincode' ? t.replace(/\D/g, '').slice(0, 6) : t }))
              }
            />
          </View>
        ) : (
          <React.Fragment key={key}>{readOnly(label, details[key])}</React.Fragment>
        )
      )}
    </View>
  );
}

export default TransportDetailsSection;

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 8 },
  actions: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  actionBtn: { flex: 1 },
  field: { marginTop: 10 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 },
  disabled: { opacity: 0.8 },
});
