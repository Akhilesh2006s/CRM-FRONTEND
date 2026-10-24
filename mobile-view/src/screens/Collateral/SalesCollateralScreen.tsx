import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../../theme/colors';
import { apiService, getApiUrl } from '../../services/api';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, WebLabel } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';
import { useAuth } from '../../context/AuthContext';
import { getRoleFlags } from '../../utils/roles';
import { showConfirm } from '../../utils/showAlert';

type Item = {
  _id: string;
  title: string;
  type: string;
  url: string;
  description?: string;
  product?: string;
  isActive?: boolean;
};

const TYPE_ITEMS = [
  { label: 'Video', value: 'video' },
  { label: 'PPT', value: 'ppt' },
  { label: 'Brochure', value: 'brochure' },
  { label: 'Link', value: 'link' },
  { label: 'Other', value: 'other' },
];

const TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  video: 'videocam-outline',
  ppt: 'easel-outline',
  brochure: 'document-text-outline',
  link: 'link-outline',
  other: 'folder-open-outline',
};

function errMsg(e: any, fallback: string) {
  return e?.response?.data?.message || e?.message || fallback;
}

/** Absolute links open as-is; server paths (e.g. /uploads/...) resolve against the API host. */
function resolveUrl(raw?: string) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('www.')) return `https://${trimmed}`;
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${getApiUrl().replace(/\/api\/?$/, '')}${path}`;
}

export default function SalesCollateralScreen() {
  const { user } = useAuth();
  // Web lets anyone who can open the page add collateral; activate/deactivate (PUT /collateral/:id)
  // has no web UI, so it is limited here to Admin / Super Admin.
  const canManage = getRoleFlags(user).isAdmin;

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState('link');
  const [description, setDescription] = useState('');
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiService.get('/collateral?active=0');
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setBanner({ type: 'error', message: errMsg(e, 'Failed to load collateral') });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!title.trim() || !url.trim()) {
      setBanner({ type: 'error', message: 'Title and URL are required' });
      return;
    }
    setAdding(true);
    try {
      await apiService.post('/collateral', { title, url, type, description });
      setTitle('');
      setUrl('');
      setDescription('');
      setBanner({ type: 'success', message: 'Collateral added' });
      await load();
    } catch (e: any) {
      setBanner({ type: 'error', message: errMsg(e, 'Failed to add') });
    } finally {
      setAdding(false);
    }
  };

  const open = (item: Item) => {
    const resolved = resolveUrl(item.url);
    if (!resolved) {
      setBanner({ type: 'error', message: 'This item has no link' });
      return;
    }
    Linking.openURL(resolved).catch(() =>
      setBanner({ type: 'error', message: 'Could not open this link on the device' })
    );
  };

  const toggleActive = (item: Item) => {
    const nextActive = item.isActive === false;
    showConfirm(
      nextActive ? 'Activate collateral' : 'Deactivate collateral',
      `${nextActive ? 'Activate' : 'Deactivate'} "${item.title}"?`,
      async () => {
        setBusyId(item._id);
        try {
          await apiService.put(`/collateral/${item._id}`, { isActive: nextActive });
          setBanner({ type: 'success', message: nextActive ? 'Collateral activated' : 'Collateral deactivated' });
          await load();
        } catch (e: any) {
          setBanner({ type: 'error', message: errMsg(e, 'Update failed') });
        } finally {
          setBusyId(null);
        }
      },
      nextActive ? 'Activate' : 'Deactivate'
    );
  };

  return (
    <ScreenShell
      title="Sales Collateral"
      subtitle="Demo videos, PPTs and brochures for field visits"
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      {banner ? (
        <MessageBanner type={banner.type} message={banner.message} onDismiss={() => setBanner(null)} />
      ) : null}

      <PageSection title="Add collateral">
        <WebLabel>Title</WebLabel>
        <WebInput value={title} onChangeText={setTitle} />
        <WebLabel>URL</WebLabel>
        <WebInput
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="https://"
        />
        <WebSelect label="Type" value={type} onValueChange={(v) => setType(v || 'link')} items={TYPE_ITEMS} />
        <WebLabel>Description</WebLabel>
        <WebInput value={description} onChangeText={setDescription} />
        <WebButton title="Add" onPress={add} loading={adding} disabled={adding} />
      </PageSection>

      {loading ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : items.length === 0 ? (
        <Text style={styles.empty}>No collateral yet.</Text>
      ) : (
        items.map((item) => {
          const active = item.isActive !== false;
          return (
            <View key={item._id} style={[styles.card, !active && styles.cardInactive]}>
              <TouchableOpacity style={styles.cardMain} onPress={() => open(item)} activeOpacity={0.75}>
                <View style={styles.iconBox}>
                  <Ionicons name={TYPE_ICONS[item.type] || 'document-outline'} size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.meta}>
                    {item.type}
                    {item.product ? ` · ${item.product}` : ''}
                  </Text>
                  {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
                  <Text style={styles.url} numberOfLines={1}>
                    {item.url}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: active ? colors.successLight : colors.backgroundMuted }]}>
                  <Text style={[styles.badgeText, { color: active ? colors.success : colors.textTertiary }]}>
                    {active ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </TouchableOpacity>
              <View style={styles.actions}>
                <View style={{ flex: 1 }}>
                  <WebButton title="Open" onPress={() => open(item)} />
                </View>
                {canManage ? (
                  <View style={{ flex: 1 }}>
                    <WebButton
                      title={active ? 'Deactivate' : 'Activate'}
                      variant={active ? 'destructive' : 'outline'}
                      loading={busyId === item._id}
                      disabled={busyId !== null}
                      onPress={() => toggleActive(item)}
                    />
                  </View>
                ) : null}
              </View>
            </View>
          );
        })
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  empty: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.lg },
  card: {
    backgroundColor: colors.backgroundLight,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardInactive: { opacity: 0.7 },
  cardMain: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  meta: { fontSize: 12, color: colors.textTertiary, marginTop: 2, textTransform: 'capitalize' },
  desc: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  url: { fontSize: 12, color: colors.primaryDark, marginTop: 4 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
});
