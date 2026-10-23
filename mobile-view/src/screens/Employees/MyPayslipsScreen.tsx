import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../../theme/colors';
import ScreenShell from '../../ui/ScreenShell';
import MessageBanner from '../../components/MessageBanner';
import { ExpenseBillModal } from '../../components/expenses/ExpenseBillViewer';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

let WebView: any = null;
try {
  WebView = require('react-native-webview').WebView;
} catch (_) {
  WebView = null;
}

type Slip = { month: string; yearlySalary: number; monthlyTakeHome: number; pdfUrl?: string; name?: string };

const rupees = (n?: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

/** Web: app/dashboard/payslips/page.tsx — GET /hr/payslips/mine (last 3 months). */
export default function MyPayslipsScreen() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Slip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [pdf, setPdf] = useState<{ url: string; title: string } | null>(null);
  const [html, setHtml] = useState<{ html: string; title: string } | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiService.get('/hr/payslips/mine');
      setRows(Array.isArray(data) ? data : []);
      setError('');
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load pay slips');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openGenerated = async (month: string) => {
    if (!user?._id) return;
    setOpening(month);
    try {
      const file: { filename: string; html: string } = await apiService.get(`/hr/payslips/${user._id}/${month}/download`);
      setHtml({ html: file.html, title: `Pay slip ${month}` });
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to open pay slip');
    } finally {
      setOpening(null);
    }
  };

  return (
    <ScreenShell
      title="My Pay Slips"
      subtitle="Your last 3 months of pay slips."
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      {error ? <MessageBanner type="error" message={error} onDismiss={() => setError('')} /> : null}
      {!error && rows.length === 0 ? <Text style={styles.empty}>No pay slips yet.</Text> : null}
      {rows.map((row) => (
        <View key={row.month} style={styles.card}>
          <View style={{ flex: 1 }}>
            <Text style={styles.month}>{row.month}</Text>
            <Text style={styles.meta}>Yearly salary: {rupees(row.yearlySalary)}</Text>
            <Text style={styles.meta}>Monthly take-home: {rupees(row.monthlyTakeHome)}</Text>
          </View>
          {row.pdfUrl ? (
            <TouchableOpacity style={styles.btn} onPress={() => setPdf({ url: row.pdfUrl!, title: `Pay slip ${row.month}` })}>
              <Text style={styles.btnText}>View PDF</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.btn} onPress={() => openGenerated(row.month)} disabled={opening === row.month}>
              <Text style={styles.btnText}>{opening === row.month ? 'Opening…' : 'View'}</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      <ExpenseBillModal url={pdf?.url} title={pdf?.title} visible={!!pdf} onClose={() => setPdf(null)} />

      <Modal visible={!!html} animationType="slide" onRequestClose={() => setHtml(null)}>
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{html?.title}</Text>
            <TouchableOpacity onPress={() => setHtml(null)} hitSlop={12}>
              <Ionicons name="close" size={26} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
            {html ? (
              Platform.OS === 'web' ? (
                React.createElement('iframe', {
                  srcDoc: html.html,
                  title: html.title,
                  style: { width: '100%', height: '100%', border: 'none' },
                })
              ) : WebView ? (
                <WebView source={{ html: html.html }} style={{ flex: 1 }} />
              ) : (
                <Text style={styles.empty}>Viewer unavailable on this device.</Text>
              )
            ) : null}
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  empty: { textAlign: 'center', color: colors.textSecondary, paddingVertical: 32 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 12,
    marginBottom: 8,
  },
  month: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  meta: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  btn: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 8 },
  btnText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  modalRoot: { flex: 1, backgroundColor: colors.backgroundLight },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
});
