/**
 * Employee Returns List — admin view of all executive stock returns.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { apiService } from '../../services/api';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebLabel } from '../../ui/WebPrimitives';
import { Card, CardTitle, InfoRow, ActionRow, EmptyState, SectionTitle, toneFor } from '../../ui/Kit';
import MessageBanner from '../../components/MessageBanner';
import { useAuth } from '../../context/AuthContext';
import { getRoleFlags } from '../../utils/roles';
import { printReturnSlip } from '../../lib/returnSlip';

import DateField from '../../ui/DateField';
function printSlip(ret: any) {
  printReturnSlip({
    ...ret,
    saleId: ret.saleId || ret.dcOrderId?.dc_code || '',
    customerName: ret.customerName || ret.dcOrderId?.school_name || '',
  }).catch((e: any) => Alert.alert('Print', e?.message || 'Could not create the return slip'));
}

function formatDate(dateString?: string) {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '-';
  }
}

function formatCreated(dateString?: string) {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return '-';
  }
}

function cell(value: string | number | undefined | null) {
  if (value === undefined || value === null || value === '') return '-';
  return String(value);
}

function getLeadName(ret: any) {
  return ret.leadId?.school_name || ret.dcOrderId?.school_name || ret.customerName || '-';
}

function getExecutiveName(ret: any) {
  return ret.executiveName || ret.createdBy?.name || '-';
}

function getManagerText(ret: any) {
  if (ret.rejectionReason) return { text: `Rejected: ${ret.rejectionReason}`, rejected: true };
  if (ret.managerRemarks) return { text: ret.managerRemarks, rejected: false };
  return { text: '-', rejected: false };
}

function showError(message: string, setBanner: (v: any) => void) {
  if (Platform.OS === 'web') {
    setBanner({ type: 'error', message });
  } else {
    Alert.alert('Error', message);
  }
}

export default function ReturnsEmployeeScreen({ navigation, route }: any) {
  const { user } = useAuth();
  const { isAdmin } = getRoleFlags(user);
  const isExecutiveScreen = route?.name === 'ReturnsExecutive';

  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [returnDate, setReturnDate] = useState('');
  const [query, setQuery] = useState('');

  const loadData = useCallback(async () => {
    if (!user?._id) return;
    try {
      setLoading(true);
      const url = isExecutiveScreen
        ? '/stock-returns/executive/mine'
        : isAdmin
          ? '/stock-returns/executive/list'
          : '/stock-returns/executive/mine';
      const returnsData = await apiService.get(url).catch(() => []);
      setReturns(Array.isArray(returnsData) ? returnsData : returnsData?.data || []);
    } catch (error: any) {
      showError(error.message || 'Failed to load returns', setBanner);
      setReturns([]);
    } finally {
      setLoading(false);
    }
  }, [user?._id, isAdmin, isExecutiveScreen]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const openReturn = (ret: any) => {
    navigation.navigate('StockReturnAdd', { returnId: ret._id });
  };

  if (isExecutiveScreen) {
    const allReturns = returns.filter((r) => r.status !== 'Draft');
    const drafts = returns.filter((r) => r.status === 'Draft');

    const getReturnId = (ret: any) =>
      ret.returnId || (ret.returnNumber != null ? `RET-${ret.returnNumber}` : String(ret._id || '').slice(-8));
    const getSaleId = (ret: any) =>
      ret.saleId ||
      ret.dcOrderId?.dc_code ||
      (typeof ret.dcOrderId === 'string' ? ret.dcOrderId : '-') ||
      '-';
    const getSchool = (ret: any) => ret.customerName || ret.dcOrderId?.school_name || '-';
    const getQty = (ret: any) =>
      ret.totalQuantity ??
      ret.returnQty ??
      (Array.isArray(ret.products)
        ? ret.products.reduce((s: number, p: any) => s + (p.returnQty || 0), 0)
        : 0);

    return (
      <ScreenShell
        title="Stock Returns"
        subtitle="Manage stock returns for your sales"
        loading={loading}
        onRefresh={loadData}
      >
        {banner ? (
          <MessageBanner type={banner.type} message={banner.message} onDismiss={() => setBanner(null)} />
        ) : null}

        <WebButton title="+ Add Return" onPress={() => navigation.navigate('StockReturnAdd')} />
        <View style={{ height: 12 }} />

        {drafts.length > 0 && (
          <>
            <SectionTitle>{`Saved drafts (${drafts.length})`}</SectionTitle>
            {drafts.map((ret) => (
              <Card key={ret._id} onPress={() => openReturn(ret)}>
                <CardTitle title={getReturnId(ret)} subtitle="Tap to continue" badge="Draft" tone="neutral" />
              </Card>
            ))}
            <SectionTitle>Returns</SectionTitle>
          </>
        )}

        {allReturns.length === 0 && !loading ? (
          <EmptyState icon="↩️" title="No returns found" />
        ) : (
          allReturns.map((ret) => (
            <Card key={ret._id}>
              <CardTitle title={getReturnId(ret)} subtitle={getSchool(ret) !== '-' ? getSchool(ret) : undefined} badge={cell(ret.status)} tone={toneFor(ret.status)} />
              <InfoRow label="LR No" value={cell(ret.lrNumber)} />
              <InfoRow label="Fin Year" value={cell(ret.finYear)} />
              <InfoRow label="School Code" value={cell(ret.schoolCode)} />
              <InfoRow label="Sale ID" value={getSaleId(ret)} />
              <InfoRow label="Return Type" value={cell(ret.returnType)} />
              <InfoRow label="Return Qty" value={String(getQty(ret))} />
              <ActionRow>
                <WebButton title="View" variant="outline" onPress={() => openReturn(ret)} />
                <WebButton title="Print" variant="outline" onPress={() => printSlip(ret)} />
              </ActionRow>
            </Card>
          ))
        )}
      </ScreenShell>
    );
  }

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const toYmd = (d?: string) => {
    if (!d) return '';
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return '';
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  };
  const visibleReturns = returns.filter((ret) => {
    if (returnDate && toYmd(ret.returnDate) !== returnDate) return false;
    if (!words.length) return true;
    const text = [
      ret.returnNumber,
      ret.status,
      ret.lrNumber,
      ret.finYear,
      ret.schoolType,
      ret.schoolCode,
      getLeadName(ret),
      getExecutiveName(ret),
      ret.remarks,
      getManagerText(ret).text,
      formatDate(ret.returnDate),
    ]
      .filter((v) => v !== undefined && v !== null)
      .join(' ')
      .toLowerCase();
    return words.every((w) => text.includes(w));
  });

  return (
    <ScreenShell title="Employee Stock Returns" loading={loading} onRefresh={loadData}>
      {banner ? (
        <MessageBanner type={banner.type} message={banner.message} onDismiss={() => setBanner(null)} />
      ) : null}

      <PageSection title="Search">
        <WebInput
          placeholder="Search LR no, fin year, school, executive, remarks…"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <WebLabel>Return Date</WebLabel>
        <DateField placeholder="Select date" value={returnDate} onChange={setReturnDate} />
      </PageSection>

      <SectionTitle>{`${isAdmin ? 'All Executive Returns' : 'My Returns'} (${visibleReturns.length})`}</SectionTitle>

      {visibleReturns.length === 0 && !loading ? (
        <EmptyState icon="↩️" title="No returns yet" />
      ) : (
        visibleReturns.map((ret) => {
          const manager = getManagerText(ret);
          return (
            <Card key={ret._id}>
              <CardTitle
                title={`Return #${ret.returnNumber}`}
                subtitle={getLeadName(ret) !== '-' ? getLeadName(ret) : undefined}
                badge={cell(ret.status)}
                tone={toneFor(ret.status)}
              />
              <InfoRow label="LR No" value={cell(ret.lrNumber)} />
              <InfoRow label="Fin Year" value={cell(ret.finYear)} />
              <InfoRow label="Return Date" value={formatDate(ret.returnDate)} />
              {isAdmin && <InfoRow label="Executive" value={getExecutiveName(ret)} />}
              <InfoRow label="Remarks" value={cell(ret.remarks)} />
              {isAdmin && manager.text !== '-' ? (
                <InfoRow
                  label="Manager"
                  value={<Text style={[styles.infoValue, manager.rejected && styles.rejectedText]}>{manager.text}</Text>}
                />
              ) : null}
              <InfoRow label="Created" value={formatCreated(ret.createdAt)} />
              <ActionRow>
                <WebButton title="View" variant="outline" onPress={() => openReturn(ret)} />
                <WebButton title="Print" variant="outline" onPress={() => printSlip(ret)} />
              </ActionRow>
            </Card>
          );
        })
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  infoValue: { fontSize: 14, color: colors.textPrimary },
  rejectedText: { color: colors.error },
});
