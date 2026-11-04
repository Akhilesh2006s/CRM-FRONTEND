import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
  TouchableOpacity,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { InfoRow } from '../../ui/Kit';
import { WebInput, WebButton, WebSelect, WebLabel } from '../../ui/WebPrimitives';
import { apiService, getApiUrl } from '../../services/api';
import { prepareFeedbackUpload } from '../../utils/prepareFeedbackUpload';
import { showAlert } from '../../utils/showAlert';

type Training = {
  _id: string;
  schoolCode?: string;
  schoolName?: string;
  zone?: string;
  town?: string;
  subject?: string;
  trainerId?: { _id: string; name?: string };
  trainingDate?: string;
  remarks?: string;
  status?: 'Scheduled' | 'Completed' | 'Cancelled' | string;
  feedbackPdfUrl?: string;
  poImageUrl?: string;
};

function getUploadsBaseUrl(): string {
  return getApiUrl().replace(/\/api\/?$/, '');
}

function extractFeedbackUrl(raw: any): string | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  const nested =
    raw.feedbackPdfUrl ||
    raw.poImageUrl ||
    raw.training?.feedbackPdfUrl ||
    raw.training?.poImageUrl ||
    raw.data?.feedbackPdfUrl ||
    raw.data?.training?.feedbackPdfUrl;
  if (typeof nested === 'string' && nested.trim()) return nested.trim();
  return undefined;
}

function buildPdfUrl(raw: string | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:')) return trimmed;
  const base = getUploadsBaseUrl();
  let path: string;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const u = new URL(trimmed);
      path = `${u.pathname}${u.search}` || `/${trimmed.split('/').pop() || 'file'}`;
    } catch {
      path = `/${trimmed.split('/').pop() || 'file'}`;
    }
    if (!path.startsWith('/')) path = `/${path}`;
  } else {
    path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }
  return `${base}${path}`;
}

function pdfFileName(url?: string) {
  if (!url) return 'feedback.pdf';
  try {
    const cleaned = url.split('?')[0];
    const name = cleaned.split('/').pop() || 'feedback.pdf';
    return decodeURIComponent(name) || 'feedback.pdf';
  } catch {
    return 'feedback.pdf';
  }
}

function formatDateInput(dateString?: string) {
  if (!dateString) return '';
  try {
    return new Date(dateString).toISOString().split('T')[0];
  } catch {
    return '';
  }
}

export default function TrainingEditScreen({ navigation, route }: any) {
  const { id } = route.params;
  const [training, setTraining] = useState<Training | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingFeedback, setUploadingFeedback] = useState(false);
  const [feedbackPdfUrl, setFeedbackPdfUrl] = useState<string | undefined>();
  const [status, setStatus] = useState<'' | 'Completed' | 'Cancelled'>('');
  const [remarks, setRemarks] = useState('');
  const [statusError, setStatusError] = useState('');
  const [feedbackError, setFeedbackError] = useState('');
  const [feedbackNotice, setFeedbackNotice] = useState('');
  const webFileInputRef = useRef<HTMLInputElement | null>(null);

  const loadTraining = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiService.get(`/training/${id}`);
      const resolved = (data as any)?.training || (data as any)?.data || data;
      if (!resolved || !(resolved as Training)._id) {
        Alert.alert('Error', 'Training not found', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
        return;
      }
      const row = resolved as Training;
      setTraining(row);
      setStatus(
        row.status === 'Completed' || row.status === 'Cancelled' ? row.status : '',
      );
      setRemarks(row.remarks || '');
      setFeedbackPdfUrl(extractFeedbackUrl(row) || extractFeedbackUrl(data));
      setStatusError('');
      setFeedbackError('');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to load training', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } finally {
      setLoading(false);
    }
  }, [id, navigation]);

  useFocusEffect(
    useCallback(() => {
      loadTraining();
    }, [loadTraining]),
  );

  const address = [training?.zone, training?.town].filter(Boolean).join(', ');
  const resolvedPdfUrl = buildPdfUrl(feedbackPdfUrl);

  const uploadPickedAsset = async (asset: {
    uri: string;
    name?: string | null;
    mimeType?: string | null;
    file?: File | null;
  }) => {
    setUploadingFeedback(true);
    setFeedbackError('');
    setFeedbackNotice('Processing file…');
    try {
      const prepared = await prepareFeedbackUpload(asset);
      setFeedbackNotice('Uploading PDF…');
      const formData = new FormData();
      if (
        Platform.OS === 'web' ||
        (typeof Blob !== 'undefined' && prepared.blobOrFile instanceof Blob)
      ) {
        formData.append('feedback', prepared.blobOrFile as Blob, prepared.fileName);
      } else {
        formData.append('feedback', prepared.blobOrFile as any);
      }

      const res = await apiService.upload(`/training/${id}/upload-feedback`, formData);
      const uploaded = extractFeedbackUrl(res);
      if (!uploaded) {
        throw new Error('Upload succeeded but no PDF URL was returned');
      }
      setFeedbackPdfUrl(uploaded);
      setFeedbackError('');
      setFeedbackNotice('Uploaded successfully. Tap View to open the PDF.');
      showAlert('Success', 'Feedback converted to PDF and uploaded');
      try {
        const data = await apiService.get(`/training/${id}`);
        const resolved = (data as any)?.training || (data as any)?.data || data;
        const url = extractFeedbackUrl(resolved) || extractFeedbackUrl(data) || uploaded;
        if (url) setFeedbackPdfUrl(url);
      } catch (_) {
        /* keep local uploaded URL */
      }
    } catch (e: any) {
      const msg = e?.message || 'Failed to upload feedback';
      setFeedbackError(msg);
      setFeedbackNotice('');
      showAlert('Upload failed', msg);
    } finally {
      setUploadingFeedback(false);
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission needed', 'Photo library access is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    await uploadPickedAsset({
      uri: asset.uri,
      name: asset.fileName || 'feedback.jpg',
      mimeType: asset.mimeType || 'image/jpeg',
    });
  };

  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission needed', 'Camera access is required.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    await uploadPickedAsset({
      uri: asset.uri,
      name: asset.fileName || 'feedback.jpg',
      mimeType: asset.mimeType || 'image/jpeg',
    });
  };

  const pickPdfFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const file = result.assets[0];
    await uploadPickedAsset({
      uri: file.uri,
      name: file.name,
      mimeType: file.mimeType,
      file: (file as any).file || null,
    });
  };

  const pickWebFile = () => {
    if (typeof document === 'undefined') {
      void pickPdfFile();
      return;
    }
    let input = webFileInputRef.current;
    if (!input) {
      input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,application/pdf,.pdf,.jpg,.jpeg,.png';
      input.style.display = 'none';
      input.onchange = () => {
        const file = input?.files?.[0];
        if (!file) return;
        const uri = URL.createObjectURL(file);
        void uploadPickedAsset({
          uri,
          name: file.name,
          mimeType: file.type,
          file,
        }).finally(() => {
          try {
            URL.revokeObjectURL(uri);
          } catch (_) {
            /* ignore */
          }
          if (input) input.value = '';
        });
      };
      document.body.appendChild(input);
      webFileInputRef.current = input;
    }
    input.click();
  };

  const pickFeedbackPdf = () => {
    if (Platform.OS === 'web') {
      pickWebFile();
      return;
    }

    const open = (key: string) => {
      if (key === 'gallery') void pickFromGallery();
      else if (key === 'camera') void pickFromCamera();
      else if (key === 'file') void pickPdfFile();
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Photo Library', 'Camera', 'PDF / File'],
          cancelButtonIndex: 0,
        },
        (index) => {
          if (index === 1) open('gallery');
          else if (index === 2) open('camera');
          else if (index === 3) open('file');
        },
      );
      return;
    }

    void pickFromGallery();
  };

  const viewFeedback = () => {
    if (!resolvedPdfUrl) {
      showAlert('No document', 'Feedback PDF is not available.');
      return;
    }
    Linking.openURL(resolvedPdfUrl).catch(() =>
      showAlert('Error', 'Could not open feedback PDF'),
    );
  };

  const handleSubmit = async () => {
    const nextStatus = status.trim() as '' | 'Completed' | 'Cancelled';
    if (!nextStatus) {
      setStatusError('Training Status is required.');
      return;
    }
    setStatusError('');

    if (nextStatus === 'Completed' && !feedbackPdfUrl) {
      setFeedbackError('Please upload the feedback form (PDF) for completed training.');
      return;
    }
    setFeedbackError('');

    setSubmitting(true);
    try {
      const payload: Record<string, string> = { status: nextStatus };
      if (remarks) payload.remarks = remarks;
      await apiService.put(`/training/${id}`, payload);
      Alert.alert('Success', 'Training updated successfully', [
        { text: 'OK', onPress: () => navigation.navigate('TrainingList') },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to update training');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenShell
      title="Trainings"
      subtitle="Edit Training Details"
      loading={loading}
      noScroll
    >
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        <PageSection title="Training details">
          <InfoRow label="School code" value={training?.schoolCode || ''} />
          <InfoRow label="School name" value={training?.schoolName || ''} bold />
          <InfoRow label="Address" value={address || ''} />
          <InfoRow label="Product" value={training?.subject || ''} />
          <InfoRow label="Trainer" value={training?.trainerId?.name || ''} />
          <InfoRow label="Prev. scheduled" value="—" />
          <InfoRow label="Prev. remarks" value="—" />
          <InfoRow label="Training date" value={formatDateInput(training?.trainingDate)} />
        </PageSection>

        <PageSection title="Update">
          <WebLabel>Training Status *</WebLabel>
          <WebSelect
            placeholder="Select Training Status"
            value={status}
            onValueChange={(v) => {
              const next = (v === 'Completed' || v === 'Cancelled' ? v : '') as
                | ''
                | 'Completed'
                | 'Cancelled';
              setStatus(next);
              setStatusError('');
              if (next !== 'Completed') setFeedbackError('');
            }}
            items={[
              { label: 'Completed', value: 'Completed' },
              { label: 'Cancelled', value: 'Cancelled' },
            ]}
          />
          {statusError ? <Text style={styles.errorText}>{statusError}</Text> : null}

          <WebLabel>Remarks</WebLabel>
          <WebInput
            value={remarks}
            onChangeText={setRemarks}
            placeholder="Enter remarks (optional)"
            multiline
            numberOfLines={4}
            style={styles.textArea}
          />

        </PageSection>

        <PageSection title="Feedback form (PDF) *">
            <Text style={styles.feedbackHint}>Signed image or PDF; images are converted to PDF.</Text>

            {feedbackPdfUrl ? (
              <View style={styles.uploadedCard}>
                <Ionicons name="document-text-outline" size={22} color="#1D4ED8" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.uploadedLabel}>Uploaded PDF</Text>
                  <Text style={styles.uploadedName} numberOfLines={2}>
                    {pdfFileName(feedbackPdfUrl)}
                  </Text>
                </View>
                <TouchableOpacity style={styles.viewBtn} onPress={viewFeedback}>
                  <Ionicons name="eye-outline" size={16} color="#1D4ED8" />
                  <Text style={styles.viewBtnText}>View</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.missingPdf}>No feedback PDF uploaded yet.</Text>
            )}
            {feedbackNotice ? <Text style={styles.noticeText}>{feedbackNotice}</Text> : null}

            <View style={styles.feedbackActions}>
              <WebButton
                title={
                  uploadingFeedback
                    ? 'Uploading...'
                    : feedbackPdfUrl
                      ? 'Replace Image / PDF'
                      : 'Upload Image / PDF'
                }
                variant="outline"
                onPress={pickFeedbackPdf}
                disabled={uploadingFeedback}
              />
            </View>
            {feedbackError ? <Text style={styles.errorText}>{feedbackError}</Text> : null}
        </PageSection>

        <View style={styles.footer}>
          <View style={styles.footerCol}>
            <WebButton title="Cancel" variant="outline" onPress={() => navigation.goBack()} />
          </View>
          <View style={styles.footerCol}>
            <WebButton
              title={submitting ? 'Updating...' : 'Update Training'}
              onPress={handleSubmit}
              disabled={submitting}
              loading={submitting}
            />
          </View>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 40 },
  textArea: { minHeight: 96, textAlignVertical: 'top' },
  errorText: { color: colors.error, fontSize: 13, marginBottom: 8, marginTop: -6 },
  feedbackHint: { fontSize: 13, color: colors.textTertiary, marginBottom: 8 },
  missingPdf: { fontSize: 13, color: '#B45309', marginBottom: 8 },
  noticeText: { fontSize: 13, color: colors.success, marginBottom: 8 },
  uploadedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  uploadedLabel: { fontSize: 13, color: colors.primaryDark, fontWeight: '700' },
  uploadedName: { fontSize: 13, color: colors.textPrimary, marginTop: 2 },
  feedbackActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  viewBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 6 },
  viewBtnText: { color: colors.primaryDark, fontWeight: '700', fontSize: 13 },
  footer: { flexDirection: 'row', gap: 8, marginTop: 4 },
  footerCol: { flex: 1 },
});
