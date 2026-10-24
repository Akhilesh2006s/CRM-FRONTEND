/**
 * Transport Name (parcel service or Others) and Transport To (BDE / School / Trainer / Others with
 * name and mobile). Same options as the web (components/dc/TransportFields.tsx).
 */
import React, { useEffect, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { WebInput, WebSelect } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { colors } from '../../theme/colors';

export const TRANSPORT_COMPANIES = ['APSRTC', 'TGSRTC', 'ANL', 'Navatha', 'DSPS', 'Kranthi', 'SRMT', 'Blue Dart', 'DTDC'];

export const TRANSPORT_TO_OPTIONS = [
  { value: 'BDE', label: 'BDE Name' },
  { value: 'School', label: 'School Name' },
  { value: 'Trainer', label: 'Trainer Name' },
  { value: 'Others', label: 'Others' },
];

export type TransportTo = {
  transport_to?: string;
  transport_to_name?: string;
  transport_to_mobile?: string;
};

const isListed = (name: string) => TRANSPORT_COMPANIES.some((c) => c.toLowerCase() === String(name || '').trim().toLowerCase());

export function transportToLabel(v: TransportTo): string {
  if (!v.transport_to && !v.transport_to_name) return '';
  const kind = TRANSPORT_TO_OPTIONS.find((o) => o.value === v.transport_to)?.label || v.transport_to || '';
  const who = [v.transport_to_name, v.transport_to_mobile ? `(${v.transport_to_mobile})` : ''].filter(Boolean).join(' ');
  return [kind === 'Others' ? '' : kind, who].filter(Boolean).join(': ');
}

export function transportToError(v: TransportTo): string {
  if (!v.transport_to) return 'Select who the transport is to (BDE, School, Trainer or Others).';
  if (!String(v.transport_to_name || '').trim()) return 'Enter the name of the person collecting the parcel.';
  if (!/^\d{10}$/.test(String(v.transport_to_mobile || ''))) return 'Enter a 10-digit mobile number for Transport To.';
  return '';
}

export function TransportNameField({ value, onChange, inputStyle }: { value: string; onChange: (v: string) => void; inputStyle?: any }) {
  const [others, setOthers] = useState(!isListed(value) && Boolean(String(value || '').trim()));
  useEffect(() => {
    if (String(value || '').trim() && !isListed(value)) setOthers(true);
  }, [value]);
  const selected = others ? 'Others' : TRANSPORT_COMPANIES.find((c) => c.toLowerCase() === String(value || '').trim().toLowerCase()) || '';
  return (
    <>
      <Text style={styles.label}>Transport Name *</Text>
      <WebSelect
        value={selected}
        placeholder="Select transport"
        onValueChange={(v) => {
          if (v === 'Others') {
            setOthers(true);
            onChange(isListed(value) ? '' : value);
          } else {
            setOthers(false);
            onChange(v);
          }
        }}
        items={[...TRANSPORT_COMPANIES.map((c) => ({ label: c, value: c })), { label: 'Others', value: 'Others' }]}
      />
      {others ? (
        <WebInput style={inputStyle} value={value} onChangeText={onChange} placeholder="Enter transport name" />
      ) : null}
    </>
  );
}

type Trainer = { _id: string; name?: string; phone?: string; mobile?: string };

export function TransportToFields({
  value,
  onChange,
  bde,
  school,
  inputStyle,
}: {
  value: TransportTo;
  onChange: (next: TransportTo) => void;
  bde?: { name?: string; mobile?: string };
  school?: { name?: string; mobile?: string };
  inputStyle?: any;
}) {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  useEffect(() => {
    if (value.transport_to !== 'Trainer' || trainers.length) return;
    apiService.get('/trainers?status=active')
      .then((rows: any) => setTrainers(Array.isArray(rows) ? rows : []))
      .catch(() => setTrainers([]));
  }, [value.transport_to, trainers.length]);

  const pick = (kind: string) => {
    if (kind === 'BDE') onChange({ transport_to: kind, transport_to_name: bde?.name || '', transport_to_mobile: bde?.mobile || '' });
    else if (kind === 'School') onChange({ transport_to: kind, transport_to_name: school?.name || '', transport_to_mobile: school?.mobile || '' });
    else onChange({ transport_to: kind, transport_to_name: '', transport_to_mobile: '' });
  };

  return (
    <>
      <Text style={styles.label}>Transport To *</Text>
      <WebSelect value={value.transport_to || ''} placeholder="Select who collects" onValueChange={pick} items={TRANSPORT_TO_OPTIONS} />
      {value.transport_to === 'Trainer' ? (
        <>
          <Text style={styles.label}>Trainer *</Text>
          <WebSelect
            value={trainers.find((t) => t.name === value.transport_to_name)?._id || ''}
            placeholder={value.transport_to_name || 'Select trainer'}
            onValueChange={(id) => {
              const t = trainers.find((x) => x._id === id);
              onChange({ ...value, transport_to_name: t?.name || '', transport_to_mobile: t?.mobile || t?.phone || value.transport_to_mobile || '' });
            }}
            items={trainers.map((t) => ({ label: t.name || '-', value: t._id }))}
          />
        </>
      ) : (
        <>
          <Text style={styles.label}>Name *</Text>
          <WebInput
            style={inputStyle}
            value={value.transport_to_name || ''}
            editable={Boolean(value.transport_to)}
            onChangeText={(t) => onChange({ ...value, transport_to_name: t })}
            placeholder="Name of the person collecting"
          />
        </>
      )}
      <Text style={styles.label}>Mobile Number *</Text>
      <WebInput
        style={inputStyle}
        value={value.transport_to_mobile || ''}
        editable={Boolean(value.transport_to)}
        keyboardType="number-pad"
        maxLength={10}
        onChangeText={(t) => onChange({ ...value, transport_to_mobile: t.replace(/\D/g, '').slice(0, 10) })}
        placeholder="10-digit mobile"
      />
    </>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginTop: 10, marginBottom: 4 },
});
