import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Keyboard,
  Linking,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import LinearGradient from 'react-native-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useWorkspaceTranslation } from '../i18n/useWorkspaceTranslation';
import {
  errorCodes,
  isErrorWithCode,
  keepLocalCopy,
  pick,
  types,
} from '@react-native-documents/picker';
import RNFS from 'react-native-fs';
import { v4 as uuid } from 'uuid';
import { useWorkspaceStore } from '../state/useWorkspaceStore';
import { useWorkspaceJobs } from '../state/useWorkspaceJobs';
import { useSourceCapabilities } from '../state/useSourceWorkspaceAvailability';
import { supportsSourceWorkspace } from '../lib/sourceWorkspaceAvailability';
import { ensureWorkspaceKey } from '../lib/workspaceIdentity';
import { SubscriptionAccessContext } from '../context/SubscriptionContext';
import { resolvePremiumStatus } from '../lib/resolvePremiumStatus';
import { setPendingPremiumAction } from '../state/premiumActions';
import { SOURCE_WORKSPACE_REQUIRES_PREMIUM } from '../constants/featureFlags';
import { validateWorkspaceRecord } from '../lib/workspaceContract';
import { ensureDeviceId } from '../lib/deviceId';
import { processDocument } from '../api/processDocument';
import { documentCoverageNotes } from '../lib/documentCoverage';
import {
  analyzeSource,
  waitForSourceJob,
  cancelSourceJob,
} from '../api/analyzeSource';
import {
  formatFileSize,
  sanitizeDocumentName,
  toPersistedAttachment,
  validatePickedDocument,
} from '../lib/documentAttachments';
import {
  formatTimestamp,
  MAX_TRANSCRIPT_CHARS,
  MAX_VIDEO_BYTES,
  normalizeYouTubeUrl,
  summaryLabels,
  summaryPlainText,
  timestampUrl,
  usableDocuments,
} from '../lib/workspace';
import { createWorkspaceDemo } from '../lib/workspaceDemo';
import { openWorkspaceChat } from '../lib/workspaceChat';
import { useAndroidNavigationMenu } from '../navigation/AndroidNavigationMenuContext';
import { colors } from '../styles/colors';
import { SUPPORTED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_SIZE_BYTES } from '../config/chatLimits';
import SvgIcon from '../components/SvgIcon';
import {
  WorkspaceHero,
  WorkspacePendingCard,
  WorkspaceResultMark,
  workspaceThemes,
} from '../components/workspace/WorkspaceVisuals';

const WorkspaceTheme = React.createContext(workspaceThemes.document);

const errors = {
  ENCRYPTED_DOCUMENT: 'This PDF is password-protected. Upload an unlocked copy.',
  UNSUPPORTED_DOCUMENT: 'This file is unreadable or its contents are unsupported. Use a PDF, DOCX, XLSX, PPTX, ODT, TXT, CSV, TSV, MD or JSON file.',
  NETWORK:
    'Check your internet connection and try again. Your selected sources are still here.',
  TIMEOUT:
    'This source took too long. Try a shorter video or a smaller document.',
  NOT_CONFIGURED:
    'Source analysis is not available yet. Please try again later.',
  VIDEO_NOT_CONFIGURED:
    'Direct video analysis is not available yet. You can still summarize a pasted transcript.',
  DOCUMENT_EXPIRED: 'A source has expired. Select the original document again.',
  SOURCE_UNAVAILABLE:
    'This source could not be analyzed. Try another file or a pasted transcript.',
  TOO_MANY_PAGES:
    'This PDF has too many pages. Split it into files of up to 300 pages each.',
  INVALID_VIDEO:
    'Choose a readable MP4 or WebM video.',
  INVALID_DOCUMENTS: 'Select your documents again and retry.',
  CLIENT_ID_REQUIRED: 'Restart the app and try again.',
  RATE_LIMITED:
    'You have reached today’s analysis limit. Please try again tomorrow.',
  INVALID_RESULT: 'The analysis was incomplete. Please try again.',
  FILE_TOO_LARGE:
    'This file is too large. Choose a smaller file.',
  SOURCES_TOO_LARGE:
    'These documents are too large to analyze together. Summarize them separately or in smaller groups.',
  NO_READABLE_TEXT:
    'No readable text was found. Use a text-based PDF or paste the text; scanned PDFs need OCR.',
  ANALYSIS_FAILED: 'The source could not be analyzed. Please try again.',
  SERVICE_BUSY: 'The analysis service is busy. Please try again shortly.',
  PROVIDER_UNAVAILABLE:
    'The AI service is temporarily unavailable. Please try again shortly.',
  DAILY_LIMIT:
    'You have reached today’s source analysis limit. Your saved briefs remain available.',
  ALREADY_PROCESSING:
    'An analysis is already running. Check its progress below before starting another.',
  JOB_PENDING:
    'Your analysis is still processing. Use Check progress below to retrieve it.',
  JOB_NOT_FOUND:
    'This analysis was not found or has expired. If you just uploaded it, wait a moment and check again.',
  WORKSPACE_KEY_REQUIRED:
    'Could not unlock your source library. Restart the app and try again.',
  NO_SPEECH:
    'No clear speech could be transcribed. Try a video with audible speech or paste its transcript.',
  VIDEO_TOO_LONG: 'This video is too long. Choose a shorter video.',
};

// File names taken from content URIs can arrive percent-encoded.
function readableLabel(label) {
  if (typeof label !== 'string' || !/%[0-9A-Fa-f]{2}/.test(label)) return label;
  try {
    return decodeURIComponent(label);
  } catch {
    return label;
  }
}

async function cleanCopies(files) {
  for (const file of files) {
    if (!file?.ownedCopy || !file.uri?.startsWith('file://')) continue;
    try {
      await RNFS.unlink(decodeURIComponent(file.uri.slice(7)));
    } catch {}
  }
}

const DISABLED_FILL = [colors.surface, colors.surface];

function Button({ children, onPress, secondary, disabled, testID, icon }) {
  const theme = useContext(WorkspaceTheme);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && [
          styles.secondary,
          { borderColor: theme.border, backgroundColor: theme.panel },
        ],
        disabled && secondary && styles.dim,
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.85 },
      ]}
    >
      {!secondary && (
        <LinearGradient
          pointerEvents="none"
          colors={disabled ? DISABLED_FILL : theme.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 18 }]}
        />
      )}
      {icon && (
        <SvgIcon
          name={icon}
          size={20}
          color={secondary ? theme.accent : disabled ? colors.textMuted : '#FFFFFF'}
        />
      )}
      <Text
        style={[
          styles.buttonText,
          {
            color: secondary ? theme.accent : disabled ? colors.textMuted : '#FFFFFF',
          },
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}

export default function SourceWorkspace({ navigation, route }) {
  const video = route.name === 'VideoSummaries';
  const theme = workspaceThemes[video ? 'video' : 'document'];
  const { t } = useTranslation();
  const { c, i18n } = useWorkspaceTranslation();
  const insets = useSafeAreaInsets();
  const { reportScreenReady } = useAndroidNavigationMenu();
  const subscription = useContext(SubscriptionAccessContext);
  const records = useWorkspaceStore(s => s.records);
  const allPendingJobs = useWorkspaceJobs(s => s.jobs);
  const pendingJobs = useMemo(
    () => allPendingJobs.filter(job =>
      video
        ? ['upload', 'youtube', 'transcript'].includes(job.type)
        : job.type === 'document',
    ),
    [allPendingJobs, video],
  );
  const pendingError = useWorkspaceJobs(s => s.error);
  const capabilities = useSourceCapabilities();
  const storeError = useWorkspaceStore(s => s.error);
  const [files, setFiles] = useState([]);
  const [mode, setMode] = useState('upload');
  const [url, setUrl] = useState('');
  const [transcript, setTranscript] = useState('');
  const [detail, setDetail] = useState('detailed');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(null);
  const [tab, setTab] = useState('summary');
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [phase, setPhase] = useState('');
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [saveFailed, setSaveFailed] = useState(false);
  const [openingChat, setOpeningChat] = useState(false);
  const controller = useRef(null);
  const scrollRef = useRef(null);
  const selectedFiles = useRef([]);
  const mounted = useRef(true);
  const pickerLock = useRef(false);
  const seedRef = useRef(null);
  selectedFiles.current = files;
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      scrollRef.current?.scrollTo({ y: 0, animated: false }),
    );
    return () => cancelAnimationFrame(frame);
  }, [active?.id]);
  const sourceAvailable = supportsSourceWorkspace(
    capabilities,
    video ? mode : 'document',
  );
  useEffect(() => {
    if (!video || busy || supportsSourceWorkspace(capabilities, mode)) return;
    const next = ['upload', 'transcript', 'youtube'].find(key =>
      supportsSourceWorkspace(capabilities, key),
    );
    if (next) setMode(next);
  }, [capabilities, mode, video, busy]);

  useEffect(() => {
    mounted.current = true;
    useWorkspaceStore
      .getState()
      .hydrate()
      .catch(() => {});
    useWorkspaceJobs
      .getState()
      .hydrate()
      .catch(() => {});
    return () => {
      mounted.current = false;
      controller.current?.abort();
      cleanCopies(selectedFiles.current);
    };
  }, []);
  useFocusEffect(
    useCallback(() => {
      reportScreenReady?.(route.name);
      return () => controller.current?.abort();
    }, [reportScreenReady, route.name]),
  );
  useEffect(() => {
    if (
      !route.params?.seedId ||
      seedRef.current === route.params.seedId ||
      busy
    )
      return;
    seedRef.current = route.params.seedId;
    const docs = usableDocuments({
      documents: (route.params.seedDocuments || []).filter(
        doc => doc.kind === 'document' && doc.status === 'ready',
      ),
    }).slice(0, 3);
    if (docs.length) {
      cleanCopies(selectedFiles.current);
      setFiles(docs.map(doc => ({ ...doc, remoteId: doc.remoteId || doc.id })));
      setActive(null);
    }
  }, [route.params, busy]);

  const visibleRecords = useMemo(
    () =>
      records.filter(
        record =>
          (video ? record.type !== 'document' : record.type === 'document') &&
          `${record.result.title} ${record.sourceLabel}`
            .toLocaleLowerCase()
            .includes(query.toLocaleLowerCase()),
      ),
    [records, video, query],
  );

  async function chooseFiles() {
    if (pickerLock.current || busy) return;
    pickerLock.current = true;
    setPicking(true);
    setError('');
    let copied = [];
    try {
      const picked = await pick({
        // Android providers label CSVs differently (including generic binary).
        // Use the same MIME allowlist as validation; extensions stay restricted.
        type: video ? [types.video] : SUPPORTED_DOCUMENT_MIME_TYPES,
        allowMultiSelection: !video,
        allowVirtualFiles: false,
        mode: 'import',
      });
      if (!mounted.current) return;
      if (picked.length > (video ? 1 : 3))
        throw Object.assign(new Error(), { code: 'TOO_MANY_FILES' });
      const accepted = picked.map(file => {
        if (video) {
          if (!/\.(mp4|webm)$/i.test(file.name || ''))
            throw Object.assign(new Error(), { code: 'VIDEO_TYPE' });
          if (file.size > MAX_VIDEO_BYTES)
            throw Object.assign(new Error(), { code: 'FILE_TOO_LARGE' });
          if (file.size === 0) throw new Error('Empty file');
          const ext = file.name.toLowerCase().split('.').pop();
          return {
            ...file,
            id: uuid(),
            name: sanitizeDocumentName(file.name),
            mimeType: {
              mp4: 'video/mp4',
              mov: 'video/quicktime',
              webm: 'video/webm',
            }[ext],
          };
        }
        const valid = validatePickedDocument(file);
        if (!valid.ok)
          throw Object.assign(new Error(), {
            code:
              valid.code === 'file_too_large'
                ? 'FILE_TOO_LARGE'
                : 'DOCUMENT_TYPE',
          });
        return {
          ...valid.value,
          id: uuid(),
          kind: 'document',
          status: 'selected',
        };
      });
      const copies = await keepLocalCopy({
        destination: 'cachesDirectory',
        files: accepted.map(f => ({
          uri: f.uri,
          fileName: `workspace-${f.id}-${f.name}`,
        })),
      });
      copied = copies.flatMap((copy, index) =>
        copy.status === 'success'
          ? [{ ...accepted[index], uri: copy.localUri, ownedCopy: true }]
          : [],
      );
      if (copied.length !== accepted.length)
        throw new Error('Could not copy file');
      for (const file of copied) {
        const stat = await RNFS.stat(
          decodeURIComponent(file.uri.replace(/^file:\/\//, '')),
        );
        file.size = Number(stat.size);
        if (
          !Number.isFinite(file.size) ||
          file.size <= 0 ||
          file.size > (video ? MAX_VIDEO_BYTES : MAX_DOCUMENT_SIZE_BYTES)
        )
          throw Object.assign(new Error(), { code: 'FILE_TOO_LARGE' });
      }
      if (!mounted.current) {
        await cleanCopies(copied);
        return;
      }
      await cleanCopies(selectedFiles.current);
      setFiles(copied);
    } catch (err) {
      await cleanCopies(copied);
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED)
        return;
      if (mounted.current)
        setError(
          c(
            errors[err.code]
              ? `errors.${err.code}`
              : video
              ? 'pickVideoError'
              : 'pickDocumentsError',
            errors[err.code] ||
              (video
                ? 'Choose an MP4 or WebM video.'
                : 'Choose up to three PDF, DOCX, XLSX, PPTX, ODT, TXT, CSV, TSV, MD or JSON documents, up to 25 MB each.'),
          ),
        );
    } finally {
      pickerLock.current = false;
      if (mounted.current) setPicking(false);
    }
  }

  // Mirrors the chat composer's file-upload gate; inert while the policy flag is off.
  async function requirePremium() {
    if (!SOURCE_WORKSPACE_REQUIRES_PREMIUM) return true;
    if (await resolvePremiumStatus(subscription)) return true;
    setPendingPremiumAction(null);
    navigation.navigate('PaywallScreen', { returnTo: route.name });
    return false;
  }

  async function runAnalysis() {
    Keyboard.dismiss();
    if (controller.current || picking) return;
    if (!(await requirePremium())) return;
    // Entitlement resolution is asynchronous; a second tap may have started work.
    if (controller.current || picking) return;
    if (!sourceAvailable) {
      setError(
        c(
          'sourceUnavailable',
          'This source type is temporarily unavailable. Try an available input below.',
        ),
      );
      return;
    }
    setError('');
    const canonical = normalizeYouTubeUrl(url);
    if (video && mode === 'youtube' && !canonical) {
      setError(c('invalidUrl', 'Enter a valid https:// YouTube video link.'));
      return;
    }
    if (
      video &&
      mode === 'transcript' &&
      (transcript.trim().length < 40 ||
        transcript.length > MAX_TRANSCRIPT_CHARS)
    ) {
      setError(
        c(
          'invalidTranscript',
          'Paste a transcript between 40 and 120,000 characters.',
        ),
      );
      return;
    }
    if ((!video || mode === 'upload') && !files.length) {
      setError(c('chooseFirst', 'Choose a source first.'));
      return;
    }
    const aborter = new AbortController();
    controller.current = aborter;
    setBusy(true);
    setProgress(null);
    setSaveFailed(false);
    let pendingJob;
    try {
      const deviceId = await ensureDeviceId();
      const workspaceKey = await ensureWorkspaceKey();
      if (aborter.signal.aborted)
        throw Object.assign(new Error(), { code: 'ABORTED' });
      const ready = [];
      if (!video) {
        for (const file of files) {
          if (aborter.signal.aborted)
            throw Object.assign(new Error(), { code: 'ABORTED' });
          if (file.remoteId || (file.status === 'ready' && !file.uri)) {
            if (!usableDocuments({ documents: [file] }).length)
              throw Object.assign(new Error(), { code: 'DOCUMENT_EXPIRED' });
            ready.push(file);
            continue;
          }
          setPhase(c('uploading', 'Uploading {{name}}', { name: file.name }));
          const processed = await processDocument({
            file,
            deviceId,
            signal: aborter.signal,
            onProgress: value => {
              if (mounted.current) {
                setProgress(value);
                if (value === 1)
                  setPhase(c('extracting', 'Reading your document…'));
              }
            },
          }).promise;
          const doc = {
            ...toPersistedAttachment({ ...file, ...processed }),
            remoteId: processed.remoteId,
            expiresAt: processed.expiresAt,
            truncated: processed.truncated,
          };
          ready.push(doc);
          await cleanCopies([file]);
          if (mounted.current)
            setFiles(previous =>
              previous.map(f => (f.id === file.id ? doc : f)),
            );
        }
      }
      setProgress(null);
      setPhase(c('analyzing', 'Building your source brief…'));
      const source = {
        type: video ? mode : 'document',
        detail,
        language: i18n.resolvedLanguage || i18n.language || 'en',
        ...(video && mode === 'youtube' ? { url: canonical } : {}),
        ...(video && mode === 'transcript'
          ? { transcript: transcript.trim() }
          : {}),
        ...(video && mode === 'upload' ? { file: files[0] } : {}),
        ...(!video
          ? { documentIds: ready.map(doc => doc.remoteId || doc.id) }
          : {}),
      };
      pendingJob = {
        id: uuid(),
        type: source.type,
        createdAt: Date.now(),
        sourceLabel: video
          ? mode === 'youtube'
            ? canonical
            : mode === 'upload'
            ? files[0].name
            : c('transcript', 'Transcript')
          : ready.map(d => d.name).join(', '),
        url: video && mode === 'youtube' ? canonical : null,
        documents: ready.map(doc => ({
          ...toPersistedAttachment(doc),
          expiresAt: doc.expiresAt,
          truncated: doc.truncated,
        })),
      };
      await useWorkspaceJobs.getState().save(pendingJob);
      const result = await analyzeSource({
        source,
        deviceId,
        workspaceKey,
        requestId: pendingJob.id,
        signal: aborter.signal,
        onAccepted: () => {
          if (mounted.current) {
            setProgress(null);
            setPhase(
              c(
                'accepted',
                'Analyzing your source. You can leave this screen and check progress later.',
              ),
            );
          }
        },
        onProgress: value => {
          if (
            !mounted.current ||
            aborter.signal.aborted ||
            !video ||
            mode !== 'upload'
          )
            return;
          setProgress(value < 1 ? value : null);
          setPhase(
            value < 1
              ? c('uploading', 'Uploading {{name}}', { name: files[0].name })
              : c('analyzing', 'Building your source brief…'),
          );
        },
      });
      if (ready.some(doc => doc.truncated))
        result.coverage = { ...result.coverage, possibleExtractionLimit: true };
      if (aborter.signal.aborted || !mounted.current) return;
      const record = validateWorkspaceRecord({
        ...pendingJob,
        result,
        documents: [...pendingJob.documents, ...(result.sourceDocuments || [])],
      });
      setActive(record);
      setTab('summary');
      if (video && mode === 'upload') {
        await cleanCopies(files);
        setFiles([]);
      }
      try {
        await useWorkspaceStore.getState().save(record);
        await useWorkspaceJobs.getState().remove(record.id);
      } catch {
        if (mounted.current) setSaveFailed(true);
      }
    } catch (err) {
      if (
        pendingJob &&
        (err.terminal ||
          (!err.accepted && [
            'NOT_CONFIGURED',
            'VIDEO_NOT_CONFIGURED',
            'WORKSPACE_KEY_REQUIRED',
            'REQUEST_ID_REQUIRED',
          ].includes(err.code)) ||
          (!err.accepted && err.status && ![404, 408, 500, 502, 503, 504].includes(err.status)))
      )
        await useWorkspaceJobs
          .getState()
          .remove(pendingJob.id)
          .catch(() => {});
      if (err.code !== 'ABORTED' && !aborter.signal.aborted && mounted.current)
        setError(
          c(
            errors[err.code] ? `errors.${err.code}` : 'errors.ANALYSIS_FAILED',
            errors[err.code] || errors.ANALYSIS_FAILED,
          ),
        );
    } finally {
      controller.current = null;
      if (mounted.current) {
        setBusy(false);
        setProgress(null);
      }
    }
  }

  async function resumeJob(job, cancel = false) {
    if (controller.current) return;
    const aborter = new AbortController();
    controller.current = aborter;
    setBusy(true);
    setError('');
    setPhase(c('checkingProgress', 'Checking your saved analysis…'));
    setProgress(null);
    try {
      const options = {
        deviceId: await ensureDeviceId(),
        workspaceKey: await ensureWorkspaceKey(),
        requestId: job.id,
        signal: aborter.signal,
      };
      if (cancel) {
        try {
          await cancelSourceJob(options);
        } catch (err) {
          // Nothing to cancel server-side (never received, expired, or cleared):
          // the user asked to discard it, so clear the local card immediately.
          if (err.code !== 'JOB_NOT_FOUND') throw err;
        }
        await useWorkspaceJobs.getState().remove(job.id);
        return;
      }
      const result = await waitForSourceJob(options);
      if (aborter.signal.aborted || !mounted.current) return;
      const record = validateWorkspaceRecord({
        ...job,
        result,
        documents: [...job.documents, ...(result.sourceDocuments || [])],
      });
      if (mounted.current) {
        setActive(record);
        setTab('summary');
        setSaveFailed(false);
      }
      try {
        await useWorkspaceStore.getState().save(record);
        await useWorkspaceJobs.getState().remove(job.id);
      } catch {
        if (mounted.current) setSaveFailed(true);
      }
    } catch (err) {
      if (
        err.terminal ||
        (err.code === 'JOB_NOT_FOUND' && Date.now() - job.createdAt > 180000)
      )
        await useWorkspaceJobs
          .getState()
          .remove(job.id)
          .catch(() => {});
      if (err.code !== 'ABORTED' && mounted.current)
        setError(
          c(
            errors[err.code] ? `errors.${err.code}` : 'errors.ANALYSIS_FAILED',
            errors[err.code] || errors.ANALYSIS_FAILED,
          ),
        );
    } finally {
      controller.current = null;
      if (mounted.current) setBusy(false);
    }
  }

  async function continueChat() {
    if (openingChat) return;
    if (!(await requirePremium())) return;
    setOpeningChat(true);
    try {
      await openWorkspaceChat(active, navigation, {
        labels: summaryLabels(c),
        confirmLeavePrivate: () =>
          new Promise(resolve =>
            Alert.alert(
              c('leavePrivateTitle', 'Leave private chat?'),
              c(
                'leavePrivateBody',
                'Asking about this brief ends your private chat and saves the new conversation to your history.',
              ),
              [
                {
                  text: t('common.cancel', { defaultValue: 'Cancel' }),
                  style: 'cancel',
                  onPress: () => resolve(false),
                },
                {
                  text: c('leavePrivateConfirm', 'Continue'),
                  onPress: () => resolve(true),
                },
              ],
              { cancelable: true, onDismiss: () => resolve(false) },
            ),
          ),
      });
    } catch {
      setError(
        c('chatError', 'Could not open this source in chat. Please try again.'),
      );
    } finally {
      if (mounted.current) setOpeningChat(false);
    }
  }
  async function previewSample() {
    const record = createWorkspaceDemo(video ? mode : 'document');
    setActive(record);
    setTab('summary');
    setError('');
    setSaveFailed(false);
    try {
      await useWorkspaceStore.getState().save(record);
    } catch {
      if (mounted.current) setSaveFailed(true);
    }
  }
  async function exportBrief() {
    try {
      await Share.share({
        title: active.result.title,
        message: `${summaryPlainText(active.result, summaryLabels(c))}\n\n${active.sourceLabel}`,
      });
    } catch {
      setError(
        c('shareError', 'Could not share this brief. Please try again.'),
      );
    }
  }
  const removeRecord = useCallback(record => {
    Alert.alert(
      c('removeTitle', 'Remove saved brief?'),
      c(
        'removeBody',
        'This removes the saved brief from this device. Existing chats and server-side source expiry are unchanged.',
      ),
      [
        {
          text: t('common.cancel', { defaultValue: 'Cancel' }),
          style: 'cancel',
        },
        {
          text: c('remove', 'Remove'),
          style: 'destructive',
          onPress: async () => {
            try {
              await useWorkspaceStore.getState().remove(record.id);
              if (active?.id === record.id) setActive(null);
            } catch {
              setError(
                c(
                  'removeError',
                  'Could not remove this brief. Please try again.',
                ),
              );
            }
          },
        },
      ],
    );
  }, [active?.id, c, t]);

  const openRecord = useCallback(record => {
    setActive(record);
    setTab('summary');
    setError('');
    setSaveFailed(false);
  }, []);

  const result = active?.result;
  const hasSource =
    !video || mode === 'upload'
      ? files.length > 0
      : mode === 'transcript'
      ? transcript.trim().length >= 40
      : !!url.trim();
  return (
    <WorkspaceTheme.Provider value={theme}>
      <View style={styles.screen}>
        <KeyboardAwareScrollView
          ref={scrollRef}
          bottomOffset={20}
          onContentSizeChange={() =>
            scrollRef.current?.assureFocusedInputVisible?.()
          }
          style={styles.screen}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 28 },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {!active && <WorkspaceHero video={video} c={c} />}
          {!!error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}
          {pendingError && (
            <Text accessibilityRole="alert" style={styles.error}>
              {c(
                'pendingError',
                'Could not load pending analyses. Restart the app before starting another.',
              )}
            </Text>
          )}
          {!active &&
            !busy &&
            pendingJobs.map(job => (
              <WorkspacePendingCard
                key={job.id}
                video={video}
                title={readableLabel(job.sourceLabel)}
                status={c('pendingAnalysis', 'PENDING ANALYSIS')}
                actions={[
                  { testID: `workspace-resume-${job.id}`, label: c('checkProgress', 'Check progress'), onPress: () => resumeJob(job), disabled: busy },
                  { testID: `workspace-cancel-${job.id}`, label: c('cancelAnalysis', 'Cancel analysis'), onPress: () => resumeJob(job, true), secondary: true, disabled: busy },
                ]}
              />
            ))}
          {active ? (
            <>
              <View style={styles.resultToolbar}>
                <Button
                  secondary
                  icon="plus"
                  testID="workspace-new"
                  onPress={() => {
                    setActive(null);
                    setError('');
                    setSaveFailed(false);
                  }}
                >
                  {c('newAnalysis', 'New summary')}
                </Button>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={c('share', 'Share summary')}
                  testID="workspace-share"
                  onPress={exportBrief}
                  style={({ pressed }) => [
                    styles.iconButton,
                    pressed && styles.dim,
                  ]}
                >
                  <SvgIcon name="share" size={22} color={colors.text} />
                </Pressable>
              </View>
              <View style={styles.resultCard}>
                <LinearGradient
                  colors={theme.hero}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.summaryHero, { borderColor: theme.border }]}
                >
                  <View style={styles.resultLabel}>
                    <WorkspaceResultMark video={video} />
                    <View style={styles.grow}>
                      <Text style={[styles.eyebrow, { color: theme.accent }]}>
                        {c('summaryReady', 'READY TO EXPLORE')}
                      </Text>
                    </View>
                  </View>
                  <Text accessibilityRole="header" style={styles.title}>
                    {result.title}
                  </Text>
                  <View style={styles.resultLabel}>
                    <SvgIcon
                      name={video ? 'workspace-video' : 'workspace-document'}
                      size={18}
                      color={theme.accent}
                    />
                    <Text
                      style={[styles.caption, styles.grow]}
                      numberOfLines={2}
                    >
                      {readableLabel(active.sourceLabel)}
                    </Text>
                  </View>
                </LinearGradient>
                {active.demo && (
                  <Text style={styles.coverage}>
                    {c('demoNotice', 'Local demo · sample content · no source uploaded')}
                  </Text>
                )}
                {result.coverage?.possibleExtractionLimit && (
                  <Text style={styles.error}>
                    {c(
                      'extractionLimit',
                      'A document reached the text extraction limit. This brief may not cover the complete original file.',
                    )}
                  </Text>
                )}
                {saveFailed && (
                  <>
                    <Text style={styles.error}>
                      {c(
                        'saveError',
                        'This brief could not be saved. Keep this screen open and retry, or share a copy.',
                      )}
                    </Text>
                    <Button
                      secondary
                      testID="workspace-retry-save"
                      onPress={async () => {
                        try {
                          await useWorkspaceStore.getState().save(active);
                          await useWorkspaceJobs.getState().remove(active.id);
                          setSaveFailed(false);
                        } catch {}
                      }}
                    >
                      {c('retrySave', 'Retry saving')}
                    </Button>
                  </>
                )}
                <View style={styles.tabs}>
                  {['summary', 'details', 'sources'].map(key => (
                    <Pressable
                      testID={`workspace-result-${key}`}
                      key={key}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: tab === key }}
                      onPress={() => setTab(key)}
                      style={[
                        styles.tab,
                        tab === key && [
                          styles.tabActive,
                          {
                            backgroundColor: theme.selection,
                            borderColor: theme.accent + '55',
                          },
                        ],
                      ]}
                    >
                      <Text
                        style={[
                          styles.tabText,
                          tab === key && styles.tabTextActive,
                        ]}
                      >
                        {key === 'details' && video
                          ? c('chapters', 'Chapters')
                          : c(
                              key,
                              {
                                summary: 'Summary',
                                details: 'Details',
                                sources: 'Sources',
                              }[key],
                            )}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {tab === 'summary' && (
                  <>
                    <View
                      style={[
                        styles.overviewCard,
                        { borderColor: theme.border },
                      ]}
                    >
                      <Text style={[styles.eyebrow, { color: theme.accent }]}>
                        {c('atAGlance', 'AT A GLANCE')}
                      </Text>
                      <Text selectable style={styles.body}>
                        {result.overview}
                      </Text>
                    </View>
                    {!!result.keyPoints.length && (
                      <Text style={styles.sectionTitle}>
                        {c('keyPoints', 'Key takeaways')}
                      </Text>
                    )}
                    {result.keyPoints.map((point, index) => (
                      <View key={index} style={styles.point}>
                        <Text
                          style={[
                            styles.pointNumber,
                            {
                              color: theme.accent,
                              backgroundColor: theme.panel,
                            },
                          ]}
                        >
                          {String(index + 1).padStart(2, '0')}
                        </Text>
                        <Text selectable style={[styles.body, styles.grow]}>
                          {point}
                        </Text>
                      </View>
                    ))}
                    {!!result.actions?.length && (
                      <Text style={styles.sectionTitle}>
                        {c('actions', 'Next steps')}
                      </Text>
                    )}
                    {result.actions?.map((action, index) => (
                      <Text selectable style={styles.body} key={index}>
                        □ {action}
                      </Text>
                    ))}
                  </>
                )}
                {tab === 'details' && (
                  <>
                    {!result.sections?.length && (
                      <Text style={styles.body}>
                        {c(
                          'noSections',
                          'No additional sections were identified in this source.',
                        )}
                      </Text>
                    )}
                    {result.sections?.map((section, index) => (
                      <View style={styles.section} key={index}>
                        {Number.isFinite(section.startSeconds) && (
                          <Pressable
                            accessibilityRole="button"
                            disabled={!active.url}
                            onPress={async () => {
                              const link = timestampUrl(
                                active.url,
                                section.startSeconds,
                              );
                              try {
                                if (link) await Linking.openURL(link);
                              } catch {
                                setError(
                                  c('linkError', 'Could not open the video.'),
                                );
                              }
                            }}
                          >
                            <Text style={styles.timestamp}>
                              {formatTimestamp(section.startSeconds)}{' '}
                              {active.url ? '↗' : ''}
                            </Text>
                          </Pressable>
                        )}
                        <Text style={styles.sectionTitle}>{section.title}</Text>
                        <Text selectable style={styles.body}>
                          {section.body}
                        </Text>
                      </View>
                    ))}
                  </>
                )}
                {tab === 'sources' && (
                  <>
                    {result.evidence?.map((evidence, index) => (
                      <View style={styles.quote} key={index}>
                        <Text selectable style={styles.body}>
                          “{evidence.quote}”
                        </Text>
                        <Text style={styles.caption}>
                          {evidence.sourceName}
                        </Text>
                      </View>
                    ))}
                    {!result.evidence?.length && (
                      <Text style={styles.caption}>
                        {c(
                          'noEvidence',
                          'No verified text excerpts are available for this brief.',
                        )}
                      </Text>
                    )}
                    <Text style={styles.sectionTitle}>
                      {c('coverage', 'Coverage & limitations')}
                    </Text>
                    <Text
                      style={[
                        styles.coverage,
                        { backgroundColor: theme.panel, color: colors.textSecondary },
                      ]}
                    >
                      {active.type === 'document'
                        ? c(
                            'documentCoverage',
                            'Based on extracted text. Images and scanned pages may not be included.',
                            {
                              count: (
                                result.coverage?.extractedChars || 0
                              ).toLocaleString(),
                            },
                          )
                        : result.coverage?.kind === 'transcribed_audio'
                        ? c(
                            'audioCoverage',
                            'Speech summary · Visuals are not analyzed. Check names and numbers against the recording.',
                          )
                        : active.type === 'transcript'
                        ? c(
                            'transcriptCoverage',
                            'Based on the supplied transcript. Video visuals were not analyzed.',
                          )
                        : result.coverage?.chaptersChecked
                        ? c('chatContextShort', 'Curious about something? Ask a follow-up.')
                        : c(
                            'videoCoverageV3',
                            'Speech & visual scenes. Chapters are approximate; fast actions may be missed.',
                          )}
                    </Text>
                    {result.limitations?.map((note, index) => (
                      <Text selectable style={styles.body} key={index}>
                        • {note}
                      </Text>
                    ))}
                    {active.documents?.map(doc => (
                      <Text style={styles.caption} key={doc.id}>
                        {doc.name}
                        {documentCoverageNotes(doc, c).map(note => `\n${note}`).join('')}
                        {doc.expiresAt
                          ? ` · ${c(
                              'sourceExpires',
                              'Source available until',
                            )} ${new Date(doc.expiresAt).toLocaleDateString()}`
                          : ''}
                      </Text>
                    ))}
                  </>
                )}
              </View>
            </>
          ) : (
            <View style={styles.composer}>
              {video && (
                <View style={styles.tabs}>
                  {['upload', 'transcript', 'youtube']
                    .filter(key => supportsSourceWorkspace(capabilities, key))
                    .map(key => (
                      <Pressable
                        testID={`workspace-mode-${key}`}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: mode === key }}
                        disabled={busy}
                        key={key}
                        onPress={() => {
                          setMode(key);
                          setError('');
                        }}
                        style={[
                          styles.tab,
                          mode === key && [
                            styles.tabActive,
                            {
                              backgroundColor: theme.selection,
                              borderColor: theme.accent + '55',
                            },
                          ],
                        ]}
                      >
                        <Text
                          style={[
                            styles.tabText,
                            mode === key && styles.tabTextActive,
                          ]}
                        >
                          {c(
                            key === 'upload'
                              ? 'uploadVideo'
                              : key === 'transcript'
                              ? 'pasteTranscript'
                              : key,
                            {
                              youtube: 'YouTube',
                              upload: 'Upload video',
                              transcript: 'Paste transcript',
                            }[key],
                          )}
                        </Text>
                      </Pressable>
                    ))}
                </View>
              )}
              {video && mode === 'youtube' && (
                <>
                  <TextInput
                    testID="workspace-url"
                    editable={!busy}
                    value={url}
                    onChangeText={setUrl}
                    style={styles.input}
                    placeholder="https://www.youtube.com/watch?v=…"
                    placeholderTextColor={colors.textSecondary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    accessibilityLabel={c('videoLink', 'YouTube video link')}
                    maxLength={2048}
                  />
                </>
              )}
              {video && mode === 'transcript' && (
                <>
                  <TextInput
                    testID="workspace-transcript"
                    editable={!busy}
                    value={transcript}
                    onChangeText={setTranscript}
                    style={[styles.input, styles.transcript]}
                    multiline
                    textAlignVertical="top"
                    placeholder={c(
                      'transcriptHint',
                      'Paste the transcript or subtitles. Include timestamps for chapters.',
                    )}
                    placeholderTextColor={colors.textSecondary}
                    accessibilityLabel={c('transcript', 'Transcript')}
                  />
                  {transcript.length >= 108000 && (
                    <Text style={styles.caption}>
                      {transcript.length.toLocaleString()} / 120,000
                    </Text>
                  )}
                </>
              )}
              {!sourceAvailable && (
                <Text accessibilityRole="alert" style={styles.coverage}>
                  {c(
                    'sourceUnavailableLibrary',
                    'This source type is temporarily unavailable. You can still open your saved briefs.',
                  )}
                </Text>
              )}
              {(!video || mode === 'upload') && (
                <>
                  <View
                    style={[
                      styles.dropArea,
                      {
                        borderColor: theme.border,
                        backgroundColor: theme.panel,
                      },
                    ]}
                  >
                    <Button
                      secondary={files.length > 0}
                      icon="plus"
                      testID="workspace-pick"
                      disabled={busy || picking}
                      onPress={chooseFiles}
                    >
                      {picking
                        ? c('openingFiles', 'Opening files…')
                        : video
                        ? c('chooseVideo', 'Choose video')
                        : c('chooseFiles', 'Choose files')}
                    </Button>
                  </View>
                  {files.map(file => (
                    <View
                      style={[
                        styles.fileRow,
                        {
                          backgroundColor: theme.panel,
                          borderColor: theme.border,
                        },
                      ]}
                      key={file.id}
                    >
                      <View
                        style={[
                          styles.fileIcon,
                          { backgroundColor: theme.accent + '16' },
                        ]}
                      >
                        <SvgIcon
                          name={
                            video ? 'workspace-video' : 'workspace-document'
                          }
                          size={20}
                          color={theme.accent}
                        />
                      </View>
                      <View style={styles.grow}>
                        <Text numberOfLines={2} style={styles.fileName}>
                          {file.name}
                        </Text>
                        {!video && (
                          <Text style={styles.caption}>
                            {formatFileSize(file.size)}
                          </Text>
                        )}
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={c('removeFile', 'Remove {{name}}', {
                          name: file.name,
                        })}
                        disabled={busy}
                        style={styles.remove}
                        onPress={() => {
                          cleanCopies([file]);
                          setFiles(previous =>
                            previous.filter(f => f.id !== file.id),
                          );
                        }}
                      >
                        <SvgIcon
                          name="close"
                          size={18}
                          color={colors.textSecondary}
                        />
                      </Pressable>
                    </View>
                  ))}
                </>
              )}
              <Text style={styles.sectionTitle}>
                {c('depth', 'Make it yours')}
              </Text>
              <View style={styles.depthOptions}>
                {['concise', 'detailed'].map(key => (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: detail === key }}
                    disabled={busy}
                    key={key}
                    style={[
                      styles.depthOption,
                      detail === key && {
                        backgroundColor: theme.panel,
                        borderColor: theme.accent + '88',
                      },
                    ]}
                    onPress={() => setDetail(key)}
                  >
                    <View style={styles.depthHeading}>
                      <Text
                        style={[
                          styles.depthTitle,
                          detail === key && { color: theme.accent },
                        ]}
                      >
                        {c(
                          key,
                          key === 'concise' ? 'Quick overview' : 'In depth',
                        )}
                      </Text>
                      <View
                        style={[
                          styles.radioDot,
                          detail === key && {
                            backgroundColor: theme.accent,
                            borderColor: theme.accent,
                          },
                        ]}
                      >
                        {detail === key && (
                          <SvgIcon
                            name="check-bold"
                            size={12}
                            color={theme.panel}
                          />
                        )}
                      </View>
                    </View>
                    <Text style={styles.depthCaption}>
                      {key === 'concise'
                        ? c('quickDescription', 'The essentials, quickly')
                        : c('detailedDescription', 'More context & detail')}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {busy ? (
                <WorkspacePendingCard
                  video={video}
                  title={phase}
                  status={c('analyzing', 'Building your source brief…')}
                  progress={progress}
                  actions={[{ testID: 'workspace-cancel', label: c('stopWaiting', 'Stop waiting'), onPress: () => controller.current?.abort(), secondary: true }]}
                />
              ) : (
                <Button
                  testID="workspace-analyze"
                  disabled={
                    !hasSource ||
                    !sourceAvailable ||
                    picking ||
                    pendingError ||
                    pendingJobs.length > 0
                  }
                  onPress={runAnalysis}
                >
                  {video
                    ? c('summarizeVideo', 'Summarize video')
                    : c('analyzeDocuments', 'Analyze documents')}{' '}
                  →
                </Button>
              )}
            </View>
          )}
          {!active && (
            <>
              <View style={styles.libraryHeader}>
                <Text accessibilityRole="header" style={styles.sectionTitle}>
                  {c('library', 'Your saved briefs')}
                </Text>
                <Text style={styles.caption}>{visibleRecords.length}</Text>
              </View>
              {(visibleRecords.length > 0 || query.length > 0) && (
                <View style={styles.searchRow}>
                  <SvgIcon
                    name="search"
                    size={20}
                    color={colors.textSecondary}
                  />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    style={styles.searchInput}
                    placeholder={c('search', 'Search saved briefs')}
                    placeholderTextColor={colors.textSecondary}
                    accessibilityLabel={c('search', 'Search saved briefs')}
                  />
                  {!!query && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={c('clearSearch', 'Clear search')}
                      style={styles.remove}
                      onPress={() => setQuery('')}
                    >
                      <SvgIcon
                        name="close"
                        size={18}
                        color={colors.textSecondary}
                      />
                    </Pressable>
                  )}
                </View>
              )}
              {storeError && (
                <>
                  <Text style={styles.error}>
                    {c(
                      'loadError',
                      'Saved briefs could not be loaded. Your existing data has not been replaced.',
                    )}
                  </Text>
                  <Button
                    secondary
                    onPress={() =>
                      useWorkspaceStore
                        .getState()
                        .hydrate()
                        .catch(() => {})
                    }
                  >
                    {c('retry', 'Retry')}
                  </Button>
                </>
              )}
              {!visibleRecords.length && (
                <View style={styles.emptyLibrary}>
                  <SvgIcon
                    name={video ? 'workspace-video' : 'workspace-document'}
                    size={24}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.empty}>
                    {query
                      ? c(
                          'noSearchResults',
                          'No summaries found. Try a different search.',
                        )
                      : c(
                          'emptyLibrary',
                          'Your summaries will appear here, ready to revisit or discuss in chat.',
                        )}
                  </Text>
                </View>
              )}
              <WorkspaceLibrary records={visibleRecords} theme={theme} busy={busy} c={c} onOpen={openRecord} onRemove={removeRecord} />
              {typeof __DEV__ !== 'undefined' && __DEV__ && !busy && (
                <Button
                  secondary
                  testID="workspace-demo"
                  onPress={previewSample}
                >
                  {c('previewSample', 'Preview sample · local demo')}
                </Button>
              )}
            </>
          )}
        </KeyboardAwareScrollView>
        {active && (
          <View
            style={[
              styles.chatDock,
              { paddingBottom: Math.max(insets.bottom, 12) },
            ]}
          >
            <View style={styles.dockContent}>
              <Button
                testID="workspace-chat"
                disabled={openingChat}
                onPress={continueChat}
              >
                {openingChat
                  ? c('openingChat', 'Opening chat…')
                  : c('continueChat', 'Continue in chat')}{' '}
                →
              </Button>
            </View>
          </View>
        )}
      </View>
    </WorkspaceTheme.Provider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  composer: { gap: 14, paddingHorizontal: 2, paddingVertical: 6 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  intro: { gap: 8, paddingHorizontal: 4, paddingBottom: 4 },
  eyebrow: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.2,
  },
  hero: {
    color: colors.text,
    fontWeight: '500',
    fontSize: 28,
    lineHeight: 36,
  },
  subtitle: {
    color: colors.textSecondary,
    fontWeight: '400',
    fontSize: 15,
    lineHeight: 23,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
    padding: 18,
    gap: 16,
  },
  resultCard: { gap: 18, paddingBottom: 16 },
  summaryHero: { padding: 22, gap: 14, borderRadius: 26, borderWidth: 0 },
  overviewCard: {
    padding: 18,
    borderWidth: 1,
    borderRadius: 22,
    backgroundColor: colors.surface,
    gap: 12,
  },
  resultToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  resultLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: 24,
  },
  title: {
    fontSize: 23,
    lineHeight: 30,
    fontWeight: '500',
    color: colors.text,
  },
  caption: {
    color: colors.textSecondary,
    fontWeight: '400',
    fontSize: 13,
    lineHeight: 20,
  },
  body: {
    color: colors.text,
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 25,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 23,
  },
  button: {
    minHeight: 54,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 22,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontSize: 15,
    textAlign: 'center',
    flexShrink: 1,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  secondaryText: { color: colors.text },
  dim: { opacity: 0.6 },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    padding: 4,
    borderRadius: 24,
    backgroundColor: colors.surface,
  },
  tab: {
    flexGrow: 1,
    flexBasis: 80,
    paddingHorizontal: 6,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  tabActive: {
    backgroundColor: colors.surfaceElevated,
  },
  tabText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
    textAlign: 'center',
  },
  tabTextActive: { color: '#FFFFFF' },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceElevated,
    borderRadius: 18,
    padding: 14,
    minHeight: 50,
    color: colors.text,
    fontSize: 16,
    fontWeight: '400',
  },
  transcript: { minHeight: 180, maxHeight: 300 },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: { fontSize: 11, fontWeight: '500' },
  dropArea: {
    padding: 16,
    gap: 12,
    alignItems: 'stretch',
    borderWidth: 0,
    borderRadius: 24,
  },
  formatRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  formatChip: { paddingVertical: 6, paddingHorizontal: 9, borderRadius: 8 },
  formatLabel: {
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '500',
    letterSpacing: 0.4,
  },
  depthOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  depthOption: {
    flexGrow: 1,
    flexBasis: 130,
    gap: 8,
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
  },
  depthHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'space-between',
  },
  depthTitle: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  depthCaption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  radioDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTitle: {
    width: '100%',
    color: colors.text,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '500',
    textAlign: 'center',
  },
  centered: { textAlign: 'center' },
  sourceIcon: {
    width: 64,
    height: 64,
    backgroundColor: colors.surfaceInset,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileRow: {
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 10,
  },
  fileName: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
  },
  remove: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grow: { flex: 1, minWidth: 0 },
  fileIcon: {
    width: 40,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    color: '#FFB4AB',
    backgroundColor: 'rgba(239,68,68,0.1)',
    padding: 14,
    borderRadius: 12,
    lineHeight: 22,
    fontWeight: '400',
  },
  coverage: {
    color: colors.textSecondary,
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 12,
    fontSize: 12,
    lineHeight: 20,
    fontWeight: '400',
  },
  point: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  pointNumber: {
    fontSize: 13,
    width: 30,
    height: 30,
    textAlign: 'center',
    borderRadius: 10,
    color: colors.textSecondary,
    lineHeight: 30,
    fontWeight: '500',
  },
  section: {
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  timestamp: {
    color: colors.text,
    fontWeight: '500',
    paddingVertical: 8,
    fontSize: 14,
  },
  quote: {
    borderStartWidth: 2,
    borderColor: colors.borderLight,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    gap: 10,
  },
  libraryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  libraryRow: {
    borderWidth: 1,
    flexDirection: 'row',
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: 20,
    alignItems: 'center',
    gap: 4,
  },
  libraryOpen: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    minHeight: 64,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingStart: 16,
    paddingEnd: 4,
    borderRadius: 26,
    backgroundColor: colors.surface,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '400',
    color: colors.text,
  },
  emptyLibrary: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 20,
    gap: 14,
    backgroundColor: colors.surface,
  },
  empty: {
    flex: 1,
    color: colors.textSecondary,
    lineHeight: 22,
    fontSize: 14,
    fontWeight: '400',
  },
  chatDock: {
    paddingTop: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  dockContent: { width: '100%', maxWidth: 648, alignSelf: 'center', gap: 10 },
});

const WorkspaceLibrary = memo(function WorkspaceLibrary({ records, theme, busy, c, onOpen, onRemove }) {
  return <>
              {records.map(record => (
                <View
                  key={record.id}
                  style={[styles.libraryRow, { borderColor: theme.border }]}
                >
                  <Pressable
                    testID={`workspace-record-${record.id}`}
                    accessibilityRole="button"
                    disabled={busy}
                    style={styles.libraryOpen}
                    onPress={() => onOpen(record)}
                  >
                    <View
                      style={[
                        styles.fileIcon,
                        { backgroundColor: theme.panel },
                      ]}
                    >
                      <SvgIcon
                        name={
                          record.type === 'document'
                            ? 'workspace-document'
                            : 'workspace-video'
                        }
                        size={20}
                        color={theme.accent}
                      />
                    </View>
                    <View style={styles.grow}>
                      <Text numberOfLines={2} style={styles.fileName}>
                        {record.result.title}
                      </Text>
                      <Text numberOfLines={1} style={styles.caption}>
                        {readableLabel(record.sourceLabel)}
                      </Text>
                      <Text style={styles.caption}>
                        {new Date(record.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={c('removeBrief', 'Remove {{name}}', {
                      name: record.result.title,
                    })}
                    style={styles.remove}
                    onPress={() => onRemove(record)}
                  >
                    <SvgIcon
                      name="trash"
                      size={18}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                </View>
              ))}
  </>;
});
