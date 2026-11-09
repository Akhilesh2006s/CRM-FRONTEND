import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../../theme/colors';
import { apiService, getApiUrl } from '../../services/api';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, WebLabel } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';
import { Card, Badge, ActionRow, EmptyState } from '../../ui/Kit';
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
  // Admin / Super Admin upload brochures and videos; everyone else only views.
  const canManage = getRoleFlags(user).isAdmin;

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState('brochure');
  const [file, setFile] = useState<{ uri: string; name: string; mimeType?: string } | null>(null);
  const [description, setDescription] = useState('');
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiService.get(canManage ? '/collateral?active=0' : '/collateral');
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setBanner({ type: 'error', message: errMsg(e, 'Failed to load collateral') });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canManage]);

  useEffect(() => {
    load();
  }, [load]);

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*', 'video/*', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const picked = result.assets[0];
    setFile({ uri: picked.uri, name: picked.name || 'collateral', mimeType: picked.mimeType || undefined });
    if (picked.mimeType?.startsWith('video/')) setType('video');
    if (!title.trim() && picked.name) setTitle(picked.name.replace(/\.[^.]+$/, ''));
  };

  const add = async () => {
    if (!title.trim() || (!file && !url.trim())) {
      setBanner({ type: 'error', message: 'Enter the title, then choose a file or enter a link' });
      return;
    }
    setAdding(true);
    try {
      let link = url.trim();
      if (file) {
        const data = new FormData();
        data.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' } as any);
        const uploaded = await apiService.upload('/collateral/upload', data);
        if (!uploaded?.url) throw new Error(uploaded?.message || 'Upload failed');
        link = uploaded.url;
      }
      await apiService.post('/collateral', { title, url: link, type, description });
      setTitle('');
      setUrl('');
      setFile(null);
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
      title="Demo Videos"
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

      {canManage ? (
      <PageSection title="Upload brochure / video">
        <WebLabel>Title *</WebLabel>
        <WebInput value={title} onChangeText={setTitle} />
        <WebButton title={file ? `File: ${file.name}` : 'Choose File (PDF / image / PPT / video)'} variant="outline" onPress={pickFile} />
        {file ? <WebButton title="Remove file" variant="outline" onPress={() => setFile(null)} /> : null}
        <WebLabel>Or link (YouTube / Drive)</WebLabel>
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
      ) : null}

      {loading ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : items.length === 0 ? (
        <EmptyState icon="📁" title="No collateral yet" />
      ) : (
        items.map((item) => {
          const active = item.isActive !== false;
          return (
            <Card key={item._id} style={!active ? styles.cardInactive : undefined}>
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
                <Badge label={active ? 'Active' : 'Inactive'} tone={active ? 'success' : 'neutral'} />
              </TouchableOpacity>
              <ActionRow>
                <WebButton title="Open" onPress={() => open(item)} />
                {canManage ? (
                  <WebButton
                    title={active ? 'Deactivate' : 'Activate'}
                    variant={active ? 'destructive' : 'outline'}
                    loading={busyId === item._id}
                    disabled={busyId !== null}
                    onPress={() => toggleActive(item)}
                  />
                ) : null}
              </ActionRow>
            </Card>
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
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  meta: { fontSize: 13, color: colors.textTertiary, marginTop: 2, textTransform: 'capitalize' },
  desc: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  url: { fontSize: 13, color: colors.primaryDark, marginTop: 4 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
});
