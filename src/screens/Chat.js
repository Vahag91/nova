import { IMAGE_STUDIO_ENABLED } from '../constants/featureFlags';
import React, { useEffect, useMemo, useRef, useState, useCallback, useContext } from 'react';
import { View, Text, StyleSheet, AppState, TouchableWithoutFeedback, Keyboard, Alert, Platform, InteractionManager } from 'react-native';
import Reanimated, { useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';
import { useHeaderHeight } from '@react-navigation/elements';
import { useFocusEffect } from '@react-navigation/native';
import NetInfo from '@react-native-community/netinfo';
import { launchImageLibrary } from 'react-native-image-picker';
import RNFS from 'react-native-fs';
import {
  errorCodes as documentPickerErrorCodes,
  isErrorWithCode as isDocumentPickerError,
  keepLocalCopy,
  pick as pickDocuments,
  types as documentTypes,
} from '@react-native-documents/picker';
import Svg, { Path } from 'react-native-svg';

// --- KEYBOARD CONTROLLER IMPORTS ---
import { 
  KeyboardAvoidingView, 
  KeyboardGestureArea,           
  KeyboardEvents,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller';

import { useThreadsStore } from '../state/useThreadsStore';
import { useSettingsStore } from '../state/useSettingsStore';
import { newUserMessage, newAssistantMessage } from '../state/types';
import { streamChat } from '../api/streamChat';
import { ensureDeviceId } from '../lib/deviceId';
import { mapProxyError } from '../lib/errors';
import MessageList from '../components/chat/MessageList';
import TestInput from '../components/chat/TestInput';
import VoiceOverlay from '../components/chat/VoiceOverlay';
import SuggestionCards from '../components/chat/SuggestionCards';
import AssistantHeader from '../components/chat/AssistantHeader';
import { colors } from '../styles/colors';
import { appendStream, getStream, clearStream } from '../lib/streamingBuffer';
import { ensureSummaryIfNeeded } from '../lib/summaryBuilder';
import { buildPayload } from '../lib/payloadBuilder';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { useTranslation } from 'react-i18next';
import { SubscriptionAccessContext } from '../context/SubscriptionContext';
import { isPremiumModel, FREE_MODEL } from '../config/premium';
import { normalizeChatModelKey } from '../config/models';
import { setPendingPremiumAction } from '../state/premiumActions';
import { resolvePremiumStatus } from '../lib/resolvePremiumStatus';

import { ensureMicAndSpeech, promptOpenSettings } from '../lib/permissions';
import CreativeStudioBanner from '../components/chat/CreativeStudioBanner';
import RateUsService from '../services/RateUsService';
import ChatToast from '../components/chat/ChatToast';
import ReportContentModal from '../components/reporting/ReportContentModal';
import { plainTextFromMarkdown } from '../lib/plainTextFromMarkdown';
import { perfEnd, perfLog, perfStart } from '../lib/perfTrace';
import { runImagePickerSingleFlight } from '../lib/imagePickerSingleFlight';
import { useAndroidNavigationMenu } from '../navigation/AndroidNavigationMenuContext';
import { processDocument } from '../api/processDocument';
import {
  FREE_MESSAGE_CHAR_LIMIT,
  LARGE_PASTE_ATTACHMENT_THRESHOLD,
  PREMIUM_PASTE_CAPTURE_CHAR_LIMIT,
  getChatTokenBudget,
  getMessageCharLimit,
} from '../config/chatLimits';
import {
  isDocumentAttachment,
  isImageAttachment,
  sanitizeDocumentName,
  toPersistedAttachment,
  validatePickedDocument,
} from '../lib/documentAttachments';

const STARTUP_DECORATIVE_MEDIA_DELAY_MS = 240;
const LARGE_PASTE_DELTA_THRESHOLD = 1000;
const DOCUMENT_PICK_TYPES = [
  documentTypes.pdf,
  documentTypes.docx,
  documentTypes.plainText,
  'text/csv',
  'text/comma-separated-values',
];

function makeAttachmentId(prefix = 'attachment') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function fileUriToPath(uri) {
  const raw = String(uri || '');
  if (!raw.startsWith('file://')) return raw;
  try {
    return decodeURIComponent(raw.slice('file://'.length));
  } catch {
    return raw.slice('file://'.length);
  }
}

async function removeTemporaryFile(uri) {
  const path = fileUriToPath(uri);
  if (!path) return;
  try {
    if (await RNFS.exists(path)) await RNFS.unlink(path);
  } catch {}
}

function mergeVoiceTranscript(base, chunk) {
  const left = String(base || '').trim();
  const right = String(chunk || '').trim();

  if (!right) {
    return left;
  }
  if (!left) {
    return right;
  }
  if (left === right || left.endsWith(right)) {
    return left;
  }
  if (right.startsWith(left)) {
    return right;
  }

  return `${left} ${right}`;
}

export default function Chat({ navigation }) {
  const { t, i18n } = useTranslation();
  const { reportScreenReady } = useAndroidNavigationMenu();
  const subscription = useContext(SubscriptionAccessContext);
  const isPremium = !!subscription?.isPremium;
  const subscriptionReady = !!subscription?.subscriptionReady;
  const entitlementCacheReady = !!subscription?.entitlementCacheReady;
  
  const headerHeight = useHeaderHeight();
  const { progress } = useReanimatedKeyboardAnimation();

  const suggestionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5], [1, 0], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [0, 20], Extrapolation.CLAMP) },
    ],
    pointerEvents: progress.value > 0.1 ? 'none' : 'auto',
  }));

  const bannerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.6], [1, 0], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [0, -100], Extrapolation.CLAMP) },
      { scale: interpolate(progress.value, [0, 1], [1, 0.9], Extrapolation.CLAMP) },
    ],
  }));

  // Stores
  const normalActive = useThreadsStore(
    useCallback(
      s => (s.activeThreadId ? s.threadsById?.[s.activeThreadId] || null : null),
      []
    )
  );
  const hydrated = useThreadsStore(s => s.hydrated);
  const hydrate = useThreadsStore(s => s.hydrate);
  const createThread = useThreadsStore(s => s.createThread);
  const setActiveThread = useThreadsStore(s => s.setActiveThread);
  const addMessage = useThreadsStore(s => s.addMessage);
  const updateMessage = useThreadsStore(s => s.updateMessage);
  const removeMessage = useThreadsStore(s => s.removeMessage);
  const updateLastAssistantContent = useThreadsStore(s => s.updateLastAssistantContent);
  const forceSaveThread = useThreadsStore(s => s.forceSaveThread);
  const setThreadSummary = useThreadsStore(s => s.setThreadSummary);
  const setInsertToChatCallback = useThreadsStore(s => s.setInsertToChatCallback);
  const clearInsertToChatCallback = useThreadsStore(s => s.clearInsertToChatCallback);

  const isPrivate = useThreadsStore(s => s.privateActive);
  const privateThread = useThreadsStore(s => s.privateThread);
  const endPrivate = useThreadsStore(s => s.endPrivate);
  const addPrivateMessage = useThreadsStore(s => s.addPrivateMessage);
  const updatePrivateMessage = useThreadsStore(s => s.updatePrivateMessage);
  const removePrivateMessage = useThreadsStore(s => s.removePrivateMessage);
  const updateLastAssistantContentPrivate = useThreadsStore(s => s.updateLastAssistantContentPrivate);

  // Settings
  const settingsHydrated = useSettingsStore(s => s.hydrated);
  const globalModel = useSettingsStore(s => s.model);
  const modelsMap = useSettingsStore(s => s.models);

  // Local
  const messageListRef = useRef(null);
  const didInitialScrollRef = useRef(false);
  const [selectionResetToken, setSelectionResetToken] = useState(0);
  const [pendingMicAfterSubscriptionReady, setPendingMicAfterSubscriptionReady] = useState(false);
  const tapRef = useRef({ x: 0, y: 0, ts: 0, moved: false });
  const suppressSelectionResetRef = useRef(false);
  const suppressSelectionResetTimeoutRef = useRef(null);
  const bumpSelectionResetToken = useCallback(() => {
    setSelectionResetToken(v => v + 1);
  }, []);
  const holdSelectionReset = useCallback(() => {
    suppressSelectionResetRef.current = true;
    if (suppressSelectionResetTimeoutRef.current) {
      clearTimeout(suppressSelectionResetTimeoutRef.current);
    }
    suppressSelectionResetTimeoutRef.current = setTimeout(() => {
      suppressSelectionResetRef.current = false;
      suppressSelectionResetTimeoutRef.current = null;
    }, 350);
  }, []);

  const activeThread = isPrivate ? privateThread : normalActive;

  // Model selection
  const pinnedModel = !!(activeThread?.meta && activeThread?.meta?.pinnedModel);
  const storedActiveModelKey = pinnedModel
    ? (activeThread?.model || globalModel)
    : (globalModel || activeThread?.model);
  const activeModelKey = normalizeChatModelKey(storedActiveModelKey);
  const activeModelCaps = modelsMap?.[activeModelKey]?.caps || {};
  const activeModelContext = modelsMap?.[activeModelKey]?.context;
  const messageCharLimit = getMessageCharLimit(isPremium);
  const nativeInputCharLimit = isPremium
    ? PREMIUM_PASTE_CAPTURE_CHAR_LIMIT
    : FREE_MESSAGE_CHAR_LIMIT;
  const chatTokenBudget = getChatTokenBudget(isPremium, activeModelContext);

  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [imagePickerActive, setImagePickerActive] = useState(false);
  const [documentPickerActive, setDocumentPickerActive] = useState(false);
  const [error, setError] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [offline, setOffline] = useState(false);
  const [streamingMsgId, setStreamingMsgId] = useState(null);
  const [forceCollapseInput, setForceCollapseInput] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [helpersVisible, setHelpersVisible] = useState(true);
  const [decorativeMediaReady, setDecorativeMediaReady] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const helperRevealTimeoutRef = useRef(null);
  const helperRevealInteractionRef = useRef(null);
  const decorativeMediaTimeoutRef = useRef(null);
  const decorativeMediaInteractionRef = useRef(null);
  const voiceOverlayUnmountTimeoutRef = useRef(null);
  const bannerMediaRef = useRef(null);

  const toastTimerRef = useRef(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const showToast = useCallback((message) => {
    const msg = String(message || '').trim();
    if (!msg) return;
    setToastMessage(msg);
    setToastVisible(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastVisible(false);
    }, 1200);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (suppressSelectionResetTimeoutRef.current) {
        clearTimeout(suppressSelectionResetTimeoutRef.current);
      }
    };
  }, []);

  const cancelHelperReveal = useCallback(() => {
    if (helperRevealTimeoutRef.current) {
      clearTimeout(helperRevealTimeoutRef.current);
      helperRevealTimeoutRef.current = null;
    }
    if (helperRevealInteractionRef.current) {
      helperRevealInteractionRef.current.cancel?.();
      helperRevealInteractionRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handleKeyboardWillShow = () => {
      // Keyboard progress already drives the banner/suggestion animations on
      // the UI thread. Do not trigger a full Chat render while those frames
      // are moving; only cancel a pending post-close reveal.
      cancelHelperReveal();
      bannerMediaRef.current?.pause?.();
      perfLog('chat.keyboard.animation_started');
    };
    const handleKeyboardDidShow = () => {
      // These updates are batched after the IME animation has settled. The
      // hidden helper subtree is removed once, outside the moving frames.
      setKeyboardVisible(true);
    };
    const handleKeyboardDidHide = () => setKeyboardVisible(false);

    const subscriptions = [
      KeyboardEvents.addListener('keyboardWillShow', handleKeyboardWillShow),
      KeyboardEvents.addListener('keyboardDidShow', handleKeyboardDidShow),
      KeyboardEvents.addListener('keyboardDidHide', handleKeyboardDidHide),
    ];

    return () => {
      cancelHelperReveal();
      subscriptions.forEach(sub => sub?.remove?.());
    };
  }, [cancelHelperReveal]);

  useEffect(() => {
    perfLog('chat.keyboard.visibility_changed', {
      visible: keyboardVisible,
    });
  }, [keyboardVisible]);
  
  const [showVoiceOverlay, setShowVoiceOverlay] = useState(false);
  const [keepVoiceOverlayMounted, setKeepVoiceOverlayMounted] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const committedVoiceTextRef = useRef('');
  const [webSearchNext, setWebSearchNext] = useState(false); 
  const voiceLocale = useMemo(() => {
    const raw = i18n?.resolvedLanguage || i18n?.language || '';
    const normalized = String(raw || '').trim().replace(/_/g, '-');
    return normalized || undefined;
  }, [i18n?.language, i18n?.resolvedLanguage]);
  const resolvedActiveModel = useMemo(
    () => activeModelKey,
    [activeModelKey]
  );
  const requestModelKey = resolvedActiveModel;
  const successfulMessagesRef = useRef(0); 
  const abortRef = useRef(null);
  const documentUploadsRef = useRef(new Map());
  const composerAttachmentsRef = useRef([]);
  const largePasteBusyRef = useRef(false);
  const documentSendBusyRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const isMountedRef = useRef(true);
  const isFocusedRef = useRef(false);
  const startupReadyFrameRef = useRef(null);
  const startupReadyReportedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      return () => {
        isFocusedRef.current = false;
      };
    }, []),
  );

  useEffect(() => {
    composerAttachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    isMountedRef.current = true;
    const activeUploads = documentUploadsRef.current;
    const composerAttachments = composerAttachmentsRef;
    return () => {
      isMountedRef.current = false;
      isFocusedRef.current = false;
      for (const upload of activeUploads.values()) {
        try { upload.abort?.(); } catch {}
        removeTemporaryFile(upload.localUri);
      }
      activeUploads.clear();
      for (const attachment of composerAttachments.current) {
        if (isDocumentAttachment(attachment) && attachment?.uri) {
          removeTemporaryFile(attachment.uri);
        }
      }
      if (startupReadyFrameRef.current !== null) {
        cancelAnimationFrame(startupReadyFrameRef.current);
      }
      if (decorativeMediaTimeoutRef.current) {
        clearTimeout(decorativeMediaTimeoutRef.current);
        decorativeMediaTimeoutRef.current = null;
      }
      decorativeMediaInteractionRef.current?.cancel?.();
      decorativeMediaInteractionRef.current = null;
      if (voiceOverlayUnmountTimeoutRef.current) {
        clearTimeout(voiceOverlayUnmountTimeoutRef.current);
        voiceOverlayUnmountTimeoutRef.current = null;
      }
    };
  }, []);

  const messagesNoSystem = useMemo(
    () => {
      if (!activeThread) return [];
      return (activeThread.messages || []).filter(m => m.role !== 'system');
    },
    [activeThread]
  );

  useEffect(() => {
    perfLog('chat.screen.mounted');
    return () => {
      perfLog('chat.screen.unmounted');
    };
  }, []);

  useEffect(() => {
    if (!activeThread?.id) return;
    perfLog('chat.thread.active_changed', {
      threadId: activeThread.id,
      messages: activeThread.messages?.length || 0,
      isPrivate,
    });
  }, [activeThread?.id, activeThread?.messages?.length, isPrivate]);

  useEffect(() => {
    if (!activeThread || !hydrated) return;
    const emptyMessages = (activeThread.messages || []).filter(m => 
      m.role === 'assistant' && 
      (!m.content || m.content.trim().length === 0) &&
      m.meta?.activity &&
      m.id !== streamingMsgId 
    );
    
    if (emptyMessages.length > 0) {
      emptyMessages.forEach(msg => {
        if (!isPrivate && activeThread.id) {
          removeMessage(activeThread.id, msg.id);
        }
      });
    }
  }, [activeThread, hydrated, streamingMsgId, isPrivate, removeMessage]);

  const isChatEmpty = messagesNoSystem.length === 0;
  const isAssistantThread = !!(activeThread?.system) || activeThread?.messages?.some(m => m.role === 'system');
  const showQuickSuggestions = !isPrivate && isChatEmpty && !isAssistantThread;
  const showKeyboardHelpers = showQuickSuggestions && helpersVisible;
  const keyboardVerticalOffset = Platform.OS === 'android'
    ? headerHeight
    : (headerHeight - 25 || 65);

  useEffect(() => {
    const initialVisualReady =
      hydrated &&
      settingsHydrated &&
      entitlementCacheReady &&
      !!activeThread &&
      (!showQuickSuggestions || helpersVisible);
    if (!initialVisualReady || startupReadyReportedRef.current) {
      return undefined;
    }

    startupReadyFrameRef.current = requestAnimationFrame(() => {
      startupReadyFrameRef.current = requestAnimationFrame(() => {
        startupReadyFrameRef.current = null;
        if (!isMountedRef.current || startupReadyReportedRef.current) return;
        startupReadyReportedRef.current = true;
        reportScreenReady?.();

        // The banner shell is already laid out, but its native TextureView and
        // player are decorative. Start them after App's 180 ms startup fade so
        // media initialization cannot pause the launch loader.
        decorativeMediaTimeoutRef.current = setTimeout(() => {
          decorativeMediaTimeoutRef.current = null;
          decorativeMediaInteractionRef.current = InteractionManager.runAfterInteractions(() => {
            decorativeMediaInteractionRef.current = null;
            if (isMountedRef.current) {
              setDecorativeMediaReady(true);
            }
          });
        }, STARTUP_DECORATIVE_MEDIA_DELAY_MS);
      });
    });

    return () => {
      if (startupReadyFrameRef.current !== null) {
        cancelAnimationFrame(startupReadyFrameRef.current);
        startupReadyFrameRef.current = null;
      }
    };
  }, [
    activeThread,
    entitlementCacheReady,
    helpersVisible,
    hydrated,
    reportScreenReady,
    settingsHydrated,
    showQuickSuggestions,
  ]);

  useEffect(() => {
    if (!showQuickSuggestions) {
      cancelHelperReveal();
      setHelpersVisible(false);
      return;
    }

    // Keep the helper/video subtree mounted while the keyboard is moving.
    // Reanimated hides it on the UI thread; retaining the native TextureView
    // avoids decoder teardown, remount and resize churn on every IME cycle.
    if (keyboardVisible) {
      cancelHelperReveal();
      return undefined;
    }

    cancelHelperReveal();
    // The first complete Chat frame must not wait for React Navigation's
    // interaction queue. Later keyboard re-shows keep the small delay below.
    if (!startupReadyReportedRef.current) {
      setHelpersVisible(true);
      return undefined;
    }
    if (helpersVisible) {
      return undefined;
    }

    helperRevealTimeoutRef.current = setTimeout(() => {
      helperRevealTimeoutRef.current = null;
      helperRevealInteractionRef.current = InteractionManager.runAfterInteractions(() => {
        helperRevealInteractionRef.current = null;
        setHelpersVisible(true);
      });
    }, 90);

    return cancelHelperReveal;
  }, [
    cancelHelperReveal,
    helpersVisible,
    keyboardVisible,
    showQuickSuggestions,
  ]);

  useEffect(() => {
    if (showVoiceOverlay) {
      if (voiceOverlayUnmountTimeoutRef.current) {
        clearTimeout(voiceOverlayUnmountTimeoutRef.current);
        voiceOverlayUnmountTimeoutRef.current = null;
      }
      setKeepVoiceOverlayMounted(true);
      return undefined;
    }
    if (!keepVoiceOverlayMounted) {
      return undefined;
    }

    voiceOverlayUnmountTimeoutRef.current = setTimeout(() => {
      voiceOverlayUnmountTimeoutRef.current = null;
      setKeepVoiceOverlayMounted(false);
    }, 320);

    return () => {
      if (voiceOverlayUnmountTimeoutRef.current) {
        clearTimeout(voiceOverlayUnmountTimeoutRef.current);
        voiceOverlayUnmountTimeoutRef.current = null;
      }
    };
  }, [keepVoiceOverlayMounted, showVoiceOverlay]);

  useEffect(() => {
    perfLog('chat.helpers.visibility_changed', {
      visible: helpersVisible,
      quickSuggestions: showQuickSuggestions,
    });
  }, [helpersVisible, showQuickSuggestions]);

  const onFinalText = useCallback((text) => {
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    const merged = mergeVoiceTranscript(committedVoiceTextRef.current, trimmed);
    committedVoiceTextRef.current = merged;
    setVoiceText(merged);
  }, [setVoiceText]);
  const onPartialText = useCallback((text) => {
    const partial = String(text || '').trim();
    if (!partial) {
      setVoiceText(committedVoiceTextRef.current);
      return;
    }

    setVoiceText(mergeVoiceTranscript(committedVoiceTextRef.current, partial));
  }, [setVoiceText]);
  const onVoiceError = useCallback((message) => {
    const pretty = mapProxyError({ message }, t);
    setError(pretty.message || t('chat.voiceStartFailed', { defaultValue: 'Could not start voice.' }));
    if (!String(voiceText || '').trim()) {
      setShowVoiceOverlay(false);
    }
  }, [setError, setShowVoiceOverlay, t, voiceText]);
  const { isRecording, volume, start: startVoice, stop: stopVoice } = useVoiceInput({
    locale: voiceLocale,
    onPartialText,
    onFinalText,
    onErrorText: onVoiceError,
  });

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);
  
  useEffect(() => {
    if (
      entitlementCacheReady &&
      !isPremium &&
      activeModelKey &&
      isPremiumModel(activeModelKey)
    ) {
      if (!pinnedModel) {
        const setModel = useSettingsStore.getState().setModel;
        setModel(FREE_MODEL);
      }
    }
  }, [entitlementCacheReady, isPremium, activeModelKey, pinnedModel]);

  useEffect(() => {
    if (!hydrated || isPrivate) return;
    if (!activeThread) {
      const th = createThread({ title: t('history.newChat'), model: globalModel });
      setActiveThread(th.id);
    }
  }, [hydrated, isPrivate, activeThread, createThread, setActiveThread, globalModel, t]);

  useEffect(() => { didInitialScrollRef.current = false; }, [activeThread?.id]);
  useEffect(() => {
    if (!activeThread?.messages?.length || didInitialScrollRef.current) return;
    requestAnimationFrame(() => {
      messageListRef.current?.scrollToBottom(false);
      setTimeout(() => messageListRef.current?.scrollToBottom(false), 0);
    });
    didInitialScrollRef.current = true;
  }, [activeThread?.messages?.length, activeThread?.id]);

  useEffect(() => {
    const sub = NetInfo.addEventListener(s =>
      setOffline(!(s.isConnected && s.isInternetReachable))
    );
    return () => sub && sub();
  }, []);

  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      appStateRef.current = nextAppState;
      if (nextAppState !== 'active' && isRecording) {
        stopVoice();
      }
    };
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [stopVoice, isRecording]);

  useEffect(() => {
    if (!showVoiceOverlay || isRecording || String(voiceText || '').trim()) {
      return;
    }

    const timeoutId = setTimeout(() => {
      if (!isRecording && !String(voiceText || '').trim()) {
        setShowVoiceOverlay(false);
        setError(t('chat.voiceNoSpeechDetected', { defaultValue: 'No voice was recognized. Please try again.' }));
      }
    }, 600);

    return () => clearTimeout(timeoutId);
  }, [isRecording, setError, showVoiceOverlay, t, voiceText]);

  useEffect(() => {
    return () => {
      if (useThreadsStore.getState().privateActive) endPrivate();
      clearInsertToChatCallback();
    };
  }, [clearInsertToChatCallback, endPrivate]);
  useEffect(() => {
    return () => {
      if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    };
  }, []);

  useEffect(() => {
    if (forceCollapseInput) {
      const timeoutId = setTimeout(() => setForceCollapseInput(false), 200);
      return () => clearTimeout(timeoutId);
    }
  }, [forceCollapseInput]);

  const addPickedAssets = useCallback((assets = []) => {
    const normalized = assets
      .filter(a => a?.uri && a?.type)
      .map((a, idx) => ({
        id: `${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
        kind: 'image',
        status: 'ready',
        uri: a.uri,
        type: a.type,
        mimeType: a.type,
        name: a.fileName || `photo-${idx + 1}`,
        size: Number.isFinite(a.fileSize) ? a.fileSize : null,
        base64: a.base64 || null,
      }));
    if (!normalized.length) return;
    setAttachments(prev => {
      const seen = new Set(prev.map(p => p.uri));
      const merged = [...prev];
      for (const n of normalized) if (!seen.has(n.uri)) { merged.push(n); seen.add(n.uri); }
      return merged;
    });
  }, []);

  const updateAttachment = useCallback((attachmentId, updater) => {
    setAttachments(prev => prev.map(attachment => {
      if (attachment.id !== attachmentId) return attachment;
      const patch = typeof updater === 'function' ? updater(attachment) : updater;
      return patch ? { ...attachment, ...patch } : attachment;
    }));
  }, []);

  const uploadDocumentAttachment = useCallback(async attachment => {
    const abortController = new AbortController();
    documentUploadsRef.current.set(attachment.id, {
      abort: () => abortController.abort(),
      localUri: attachment.uri,
    });

    let completed = false;
    try {
      updateAttachment(attachment.id, { status: 'uploading', progress: 0, error: null });
      const deviceId = await ensureDeviceId();
      if (abortController.signal.aborted) {
        const abortedError = new Error('Document upload cancelled.');
        abortedError.code = 'ABORTED';
        throw abortedError;
      }

      const request = processDocument({
        file: attachment,
        deviceId,
        signal: abortController.signal,
        onProgress: uploadProgress => {
          if (!isMountedRef.current) return;
          updateAttachment(attachment.id, {
            status: uploadProgress >= 1 ? 'processing' : 'uploading',
            progress: uploadProgress,
          });
        },
      });
      documentUploadsRef.current.set(attachment.id, {
        abort: request.abort,
        localUri: attachment.uri,
      });

      const processed = await request.promise;
      completed = true;
      const readyAttachment = {
        ...attachment,
        ...processed,
        status: 'ready',
        progress: 1,
        uri: null,
        error: null,
      };
      if (isMountedRef.current) {
        updateAttachment(attachment.id, readyAttachment);
      }
      return readyAttachment;
    } catch (uploadError) {
      if (uploadError?.code !== 'ABORTED' && !abortController.signal.aborted && isMountedRef.current) {
        updateAttachment(attachment.id, {
          status: 'error',
          error: uploadError?.message || t('chat.files.failed', { defaultValue: 'Upload failed' }),
        });
      }
      throw uploadError;
    } finally {
      documentUploadsRef.current.delete(attachment.id);
      if (completed) removeTemporaryFile(attachment.uri);
    }
  }, [t, updateAttachment]);

  const onOpenFilePress = useCallback(async () => {
    if (documentPickerActive) return;
    setDocumentPickerActive(true);
    try {
      let picked = [];
      try {
        picked = await pickDocuments({
          type: DOCUMENT_PICK_TYPES,
          allowMultiSelection: true,
          allowVirtualFiles: false,
          mode: 'import',
        });
      } catch (pickerError) {
        if (
          isDocumentPickerError(pickerError)
          && pickerError.code === documentPickerErrorCodes.OPERATION_CANCELED
        ) {
          return;
        }
        Alert.alert(
          t('chat.files.pickerErrorTitle', { defaultValue: 'Unable to open files' }),
          t('chat.files.pickerErrorMessage', { defaultValue: 'Please try selecting the document again.' }),
        );
        return;
      }

      // Android may briefly pause the activity while its system file manager is
      // open. The picker result is still valid as long as this screen is mounted.
      if (!isMountedRef.current || !picked.length) return;

      const accepted = [];
      const simulatedAttachments = [...attachments];
      let firstValidationError = null;

      for (const file of picked) {
        const validation = validatePickedDocument(file, simulatedAttachments);
        if (!validation.ok) {
          firstValidationError ||= validation;
          continue;
        }
        const id = makeAttachmentId('document');
        const attachment = {
          id,
          kind: 'document',
          status: 'selected',
          progress: 0,
          source: 'file',
          ...validation.value,
        };
        accepted.push(attachment);
        simulatedAttachments.push(attachment);
      }

      if (firstValidationError) {
        const message = firstValidationError.code === 'too_many_files'
          ? t('chat.files.tooMany', { defaultValue: 'You can attach up to 3 documents per message.' })
          : firstValidationError.code === 'file_too_large'
            ? t('chat.files.tooLarge', { defaultValue: 'Each document must be 10 MB or smaller.' })
            : firstValidationError.code === 'empty_file'
              ? t('chat.files.empty', { defaultValue: 'The selected document is empty.' })
              : t('chat.files.unsupported', { defaultValue: 'Use a PDF, DOCX, TXT or CSV file.' });
        Alert.alert(t('chat.files.invalidTitle', { defaultValue: 'File not supported' }), message);
      }

      if (!accepted.length) return;

      let copyResults = [];
      try {
        copyResults = await keepLocalCopy({
          destination: 'cachesDirectory',
          files: accepted.map(attachment => ({
            uri: attachment.uri,
            fileName: sanitizeDocumentName(`${attachment.id}-${attachment.name}`),
          })),
        });
      } catch {}

      const localAttachments = accepted.flatMap((attachment, index) => {
        const copyResult = copyResults[index];
        if (
          copyResult?.status !== 'success'
          || typeof copyResult.localUri !== 'string'
          || !copyResult.localUri
        ) {
          return [];
        }
        return [{ ...attachment, uri: copyResult.localUri }];
      });

      if (localAttachments.length !== accepted.length && isMountedRef.current) {
        Alert.alert(
          t('chat.files.pickerErrorTitle', { defaultValue: 'Unable to open files' }),
          t('chat.files.pickerErrorMessage', {
            defaultValue: 'The selected file could not be read. Try choosing it again from Downloads.',
          }),
        );
      }

      if (!localAttachments.length) return;
      if (isMountedRef.current) {
        setAttachments(prev => [...prev, ...localAttachments]);
      } else {
        localAttachments.forEach(attachment => removeTemporaryFile(attachment.uri));
      }
    } finally {
      if (isMountedRef.current) setDocumentPickerActive(false);
    }
  }, [attachments, documentPickerActive, t]);

  const createPastedTextAttachment = useCallback(async text => {
    if (largePasteBusyRef.current) return;
    const validation = validatePickedDocument(
      { name: 'Pasted text.txt', type: 'text/plain', size: text.length, uri: 'pending' },
      attachments,
    );
    if (!validation.ok) {
      setInput(text.slice(0, messageCharLimit));
      Alert.alert(
        t('chat.files.invalidTitle', { defaultValue: 'Cannot attach pasted text' }),
        t('chat.files.tooMany', { defaultValue: 'You can attach up to 3 documents per message.' }),
      );
      return;
    }

    largePasteBusyRef.current = true;
    const id = makeAttachmentId('paste');
    const name = `Pasted text ${new Date().toISOString().slice(0, 10)}.txt`;
    const path = `${RNFS.CachesDirectoryPath}/${id}.txt`;
    const uri = `file://${path}`;
    try {
      await RNFS.writeFile(path, text, 'utf8');
      const stat = await RNFS.stat(path);
      const attachment = {
        id,
        kind: 'document',
        status: 'selected',
        progress: 0,
        source: 'paste',
        name,
        mimeType: 'text/plain',
        type: 'text/plain',
        size: Number(stat.size) || text.length,
        uri,
      };
      if (!isMountedRef.current) {
        removeTemporaryFile(uri);
        return;
      }
      setInput('');
      setAttachments(prev => [...prev, attachment]);
    } catch {
      if (isMountedRef.current) {
        setInput(text.slice(0, messageCharLimit));
        Alert.alert(
          t('chat.files.pasteFailedTitle', { defaultValue: 'Could not attach pasted text' }),
          t('chat.files.pasteFailedMessage', { defaultValue: 'Your text was kept in the message box.' }),
        );
      }
      removeTemporaryFile(uri);
    } finally {
      largePasteBusyRef.current = false;
    }
  }, [attachments, messageCharLimit, t]);

  const handleInputChange = useCallback(nextValue => {
    const next = String(nextValue || '');
    const addedCharacters = next.length - input.length;
    if (
      isPremium
      && next.length > LARGE_PASTE_ATTACHMENT_THRESHOLD
      && addedCharacters >= LARGE_PASTE_DELTA_THRESHOLD
      && !largePasteBusyRef.current
    ) {
      createPastedTextAttachment(next);
      return;
    }
    setInput(next);
  }, [createPastedTextAttachment, input.length, isPremium]);

  const onOpenCameraPress = useCallback(async () => {
    try {
      const result = await runImagePickerSingleFlight(async () => {
        if (isMountedRef.current) {
          setImagePickerActive(true);
        }
        try {
          return await launchImageLibrary({
            mediaType: 'photo',
            includeBase64: true,
            selectionLimit: 2,
            maxWidth: 500,
            maxHeight: 500,
            quality: 0.52,
          });
        } finally {
          if (isMountedRef.current) {
            setImagePickerActive(false);
          }
        }
      });

      if (!result.started || !isMountedRef.current || !isFocusedRef.current) {
        return;
      }

      const response = result.response;
      if (response?.didCancel) return;
      if (response?.errorCode || response?.errorMessage) {
        Alert.alert(
          t('chat.imagePickerErrorTitle'),
          t('chat.imagePickerErrorMessage', { defaultValue: 'Unable to access your photos. Please try again.' })
        );
        return;
      }
      const assetsList = Array.isArray(response?.assets) ? response.assets : [];
      if (!assetsList.some(asset => asset?.uri)) return;
      addPickedAssets(assetsList);
    } catch {
      if (!isMountedRef.current || !isFocusedRef.current) return;
      Alert.alert(
        t('chat.imagePickerErrorTitle'),
        t('chat.imagePickerErrorMessage', { defaultValue: 'Unable to access your photos. Please try again.' })
      );
    }
  }, [addPickedAssets, t]);

  const activeThreadIdForInsert = activeThread?.id;

  const onInsertImagesMarkdown = useCallback((md) => {
    const a = newAssistantMessage(md);
    if (isPrivate) addPrivateMessage(a);
    else if (activeThreadIdForInsert) addMessage(activeThreadIdForInsert, a);
    requestAnimationFrame(() => messageListRef.current?.scrollToBottom(true));
  }, [addMessage, addPrivateMessage, activeThreadIdForInsert, isPrivate]);

  const handleCreateImagesPress = useCallback(() => {
    if (!IMAGE_STUDIO_ENABLED) return;
    setInsertToChatCallback(onInsertImagesMarkdown);
    try {
      navigation.navigate('Studio');
    } catch (err) { }
  }, [navigation, onInsertImagesMarkdown, setInsertToChatCallback]);

  const startVoiceFlow = useCallback(async () => {
    perfStart('chat.voice.flow', {
      isRecording,
    });
    if (isRecording) {
      stopVoice();
      setShowVoiceOverlay(false);
      perfEnd('chat.voice.flow', {
        status: 'stop_existing',
      });
      return;
    }

    const res = await ensureMicAndSpeech();
    if (!res.ok) {
      const voiceTitle = t('chat.permissions.voiceTitle', { defaultValue: 'Voice Permissions Needed' });
      const voiceMessage = t('chat.permissions.voiceMessage', { defaultValue: 'Microphone and speech access is required to use voice.' });
      if (res.blocked) {
        promptOpenSettings(voiceTitle, voiceMessage);
      } else {
        Alert.alert(
          voiceTitle,
          voiceMessage,
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('common.allow', { defaultValue: 'Allow' }),
              onPress: async () => {
                const retry = await ensureMicAndSpeech();
                if (!retry.ok && retry.blocked) {
                  promptOpenSettings(voiceTitle, voiceMessage);
                }
              }
            }
          ],
          { cancelable: true }
        );
      }
      perfEnd('chat.voice.flow', {
        status: 'permission_denied',
        blocked: res.blocked,
      });
      return;
    }

    committedVoiceTextRef.current = '';
    setVoiceText('');
    try {
      const started = await startVoice();
      if (!started) {
        perfEnd('chat.voice.flow', {
          status: 'not_started',
        });
        return;
      }
    } catch (err) {
      const pretty = mapProxyError(err, t);
      setError(pretty.message || t('chat.voiceStartFailed', { defaultValue: 'Could not start voice.' }));
      perfEnd('chat.voice.flow', {
        status: 'error',
        message: err?.message,
      });
      return;
    }
    setInput('');
    setShowVoiceOverlay(true);
    perfEnd('chat.voice.flow', {
      status: 'started',
    });
  }, [isRecording, setShowVoiceOverlay, stopVoice, setInput, startVoice, setError, t, setVoiceText]);

  const openMicPaywall = useCallback(() => {
    setPendingPremiumAction(() => {
      // Let the paywall close animation finish first.
      setTimeout(() => {
        try {
          startVoiceFlow();
        } catch {}
      }, 450);
    });

    try {
      navigation?.navigate('PaywallScreen', { returnTo: 'Chat' });
    } catch {}
  }, [navigation, startVoiceFlow]);

  useEffect(() => {
    if (!subscriptionReady || !pendingMicAfterSubscriptionReady) {
      return;
    }

    let cancelled = false;
    (async () => {
      const hasPremiumAccess = await resolvePremiumStatus(subscription);
      if (cancelled) {
        return;
      }

      setPendingMicAfterSubscriptionReady(false);
      if (hasPremiumAccess) {
        startVoiceFlow();
        return;
      }

      openMicPaywall();
    })();

    return () => {
      cancelled = true;
    };
  }, [
    openMicPaywall,
    pendingMicAfterSubscriptionReady,
    startVoiceFlow,
    subscription,
    subscriptionReady,
  ]);

  const handleMicPress = useCallback(async () => {
    if (isRecording) {
      startVoiceFlow();
      return;
    }

    if (!subscriptionReady) {
      setPendingMicAfterSubscriptionReady(true);
      return;
    }

    if (await resolvePremiumStatus(subscription)) {
      startVoiceFlow();
      return;
    }

    openMicPaywall();
  }, [
    isRecording,
    openMicPaywall,
    startVoiceFlow,
    subscription,
    subscriptionReady,
  ]);

  const handleEditImagePress = useCallback(() => {
    if (!IMAGE_STUDIO_ENABLED) return;
    setInsertToChatCallback(onInsertImagesMarkdown);
    try {
      navigation.navigate('EditImage', {
        seedPrompt: input || '',
        returnTo: 'Chat',
      });
    } catch (err) { }
  }, [input, navigation, onInsertImagesMarkdown, setInsertToChatCallback]);

  const handleAssistantsPress = useCallback(() => {
    navigation.navigate('Assistants');
  }, [navigation]);

  const handleQuickSuggestionPress = useCallback((suggestion) => {
    const id = suggestion?.id;
    if (id === 'create-images') {
      handleCreateImagesPress();
      return;
    }
    if (id === 'open-camera') {
      onOpenCameraPress();
      return;
    }
    if (id === 'edit-image') {
      handleEditImagePress();
      return;
    }
    if (id === 'assistants') {
      handleAssistantsPress();
      return;
    }
    if (id === 'start-voice') {
      handleMicPress();
      return;
    }
    setInput(suggestion?.title || '');
  }, [handleAssistantsPress, handleCreateImagesPress, handleEditImagePress, handleMicPress, onOpenCameraPress]);

  const onRemoveAttachment = useCallback((att) => {
    const activeUpload = documentUploadsRef.current.get(att?.id);
    if (activeUpload) {
      try { activeUpload.abort?.(); } catch {}
      documentUploadsRef.current.delete(att.id);
    }
    if (isDocumentAttachment(att)) {
      removeTemporaryFile(activeUpload?.localUri || att?.uri);
    }
    setAttachments(prev => prev.filter(a => a.id !== att.id));
  }, []);

  const onRetryAttachment = useCallback(att => {
    if (!isDocumentAttachment(att) || att.status !== 'error' || !att.uri) return;
    uploadDocumentAttachment(att).catch(() => {});
  }, [uploadDocumentAttachment]);

  // ==== Send flow ====
  async function onSend(overrideText) {
    if (offline) {
      setError(t('chat.offlineError', { defaultValue: 'No internet connection. Please check your connection and try again.' }));
      return;
    }
    if (streaming) {
      return;
    }
    if (documentSendBusyRef.current) {
      return;
    }

    setError('');
    const textRaw = typeof overrideText === 'string' ? overrideText : input;
    const text = (textRaw || '').trim();
    const hasText = !!text;
    let sendAttachments = [...attachments];
    let imageAttachments = sendAttachments.filter(isImageAttachment);
    let documentAttachments = sendAttachments.filter(isDocumentAttachment);
    const hasImages = imageAttachments.length > 0;
    const hasDocuments = documentAttachments.length > 0;
    const hasAttachments = hasImages || hasDocuments;
    const perfKey = `chat.send.${Date.now()}`;

    if (!hasText && !hasAttachments) {
      return;
    }
    if (!activeThread) {
      return;
    }

    if (hasImages && !activeModelCaps.visionInput) {
      setError(t('chat.modelNoImageSupport', { 
        defaultValue: 'The selected model does not support images. Please choose a different model.' 
      }));
      return;
    }

    if (text.length > messageCharLimit) {
      setError(t('chat.messageTooLong', { length: text.length, limit: messageCharLimit }));
      return;
    }

    const previousInput = input;
    let previousAttachments = [...attachments];

    const mmParts = [
      ...(hasText ? [{ type: 'text', text }] : []),
      ...imageAttachments.filter(a => a.base64 && a.type).map(a => ({
        type: 'image_url', image_url: { url: `data:${a.type};base64,${a.base64}` }
      })),
    ];
    let persistedDocuments = documentAttachments
      .map(toPersistedAttachment)
      .filter(Boolean);
    let mUser = {
      role: 'user',
      content: mmParts.length ? mmParts : text,
      ...(persistedDocuments.length ? { attachments: persistedDocuments } : {}),
    };

    const mdImages = imageAttachments.map(a => `![photo](${a.uri})`).join('\n');
    const displayMd = [mdImages, text].filter(Boolean).join('\n\n');
    const u = newUserMessage(displayMd);
    u.mm = mmParts;
    u.attachments = persistedDocuments;

    let assistantId = null;
    let assistantAdded = false;
    let composerCleared = false;
    let documentsReadyForChat = !hasDocuments;
    let uploadCancelled = false;
    const throwIfDocumentSendCancelled = () => {
      if (!uploadCancelled) return;
      const cancelledError = new Error('Document upload cancelled.');
      cancelledError.code = 'ABORTED';
      throw cancelledError;
    };

    try {
      perfStart(perfKey, {
        threadId: activeThread.id,
        textLength: text.length,
        attachments: attachments.length,
        model: requestModelKey,
        webSearchNext,
        isPrivate,
      });
      const a = newAssistantMessage();
      assistantId = a.id;
      
      try {
        const initialActivity = hasDocuments
          ? t('chat.activity.analyzingDocuments', { defaultValue: 'Analyzing documents…' })
          : hasImages
            ? t('chat.activity.analyzingImages', { defaultValue: 'Analyzing images…' })
          : (webSearchNext
            ? t('chat.activity.searching', { defaultValue: 'Searching…' })
            : t('chat.activity.thinking', { defaultValue: 'Thinking…' }));
        a.meta = { ...(a.meta || {}), activity: initialActivity, model: requestModelKey };
      } catch { }

      if (isPrivate) { addPrivateMessage(u); addPrivateMessage(a); }
      else { addMessage(activeThread.id, u); addMessage(activeThread.id, a); }
      setStreamingMsgId(assistantId);
      requestAnimationFrame(() => messageListRef.current?.scrollToBottom(true));
      assistantAdded = true;

      setInput('');
      setAttachments([]);
      setForceCollapseInput(true);
      composerCleared = true;

      if (hasDocuments) {
        // Match the normal chat flow: show the sent message and assistant
        // activity immediately, while document processing continues safely
        // before the model request is started.
        setStreaming(true);
        documentSendBusyRef.current = true;
        abortRef.current = {
          abort: () => {
            uploadCancelled = true;
            for (const upload of documentUploadsRef.current.values()) {
              try { upload.abort?.(); } catch {}
            }
          },
        };

        const documentsToUpload = documentAttachments.filter(
          attachment => attachment.status !== 'ready' && !!attachment.uri,
        );
        for (const attachment of documentsToUpload) {
          const uploaded = await uploadDocumentAttachment(attachment);
          sendAttachments = sendAttachments.map(current => (
            current.id === attachment.id ? uploaded : current
          ));
          previousAttachments = [...sendAttachments];
        }

        throwIfDocumentSendCancelled();

        imageAttachments = sendAttachments.filter(isImageAttachment);
        documentAttachments = sendAttachments.filter(isDocumentAttachment);
        if (!documentAttachments.every(attachment => attachment.status === 'ready')) {
          throw new Error(t('chat.files.waitUntilReady', {
            defaultValue: 'Please wait for your documents to finish uploading.',
          }));
        }

        persistedDocuments = documentAttachments
          .map(toPersistedAttachment)
          .filter(Boolean);
        mUser = {
          role: 'user',
          content: mmParts.length ? mmParts : text,
          ...(persistedDocuments.length ? { attachments: persistedDocuments } : {}),
        };
        if (isPrivate) {
          updatePrivateMessage(u.id, { attachments: persistedDocuments });
        } else {
          updateMessage(activeThread.id, u.id, { attachments: persistedDocuments });
        }
        documentsReadyForChat = true;
        documentSendBusyRef.current = false;
      }

      const threadMessages = activeThread.messages || [];
      const threadForContext = { ...activeThread, messages: [...threadMessages, mUser] };
      await ensureSummaryIfNeeded(threadForContext, isPrivate ? undefined : setThreadSummary);
      throwIfDocumentSendCancelled();
      const payload = buildPayload({
        thread: threadForContext,
        newMsg: mUser,
        tokenCap: chatTokenBudget,
      });

      setStreaming(true);
      const deviceId = await ensureDeviceId();
      throwIfDocumentSendCancelled();
      const controller = new AbortController(); abortRef.current = controller;

      streamChat({
        model: requestModelKey,
        messages: payload,
        deviceId,
        allowWebSearch: webSearchNext,
        webSearchConfig: { recencyDays: 30 },
        signal: controller.signal,
        onToken: (chunk) => {
          if (typeof chunk === 'string') {
            appendStream(assistantId, chunk);
          }
        },
        onDone: () => {
          const full = getStream(assistantId);
          perfEnd(perfKey, {
            status: 'done',
            assistantId,
            fullLength: (full || '').length,
          });
          
          if (!full || full.trim().length === 0) {
            if (isPrivate) {
              updateLastAssistantContentPrivate(() => '');
            } else if (activeThread?.id) {
              removeMessage(activeThread.id, assistantId);
            }
          } else {
            if (isPrivate) {
              updateLastAssistantContentPrivate(() => full);
            } else {
              updateLastAssistantContent(activeThread.id, () => full);
            }
          }
          
          setStreaming(false);
          abortRef.current = null;
          setStreamingMsgId(null);
          clearStream(assistantId);
          if (!isPrivate) forceSaveThread(activeThread.id);
          setWebSearchNext(false);

          successfulMessagesRef.current += 1;
          if (successfulMessagesRef.current >= 2) {
            (async () => {
              const checkResult = await RateUsService.canShowRatePrompt();
              if (checkResult.canShow) {
                setTimeout(() => {
                  RateUsService.showRatePrompt();
                }, 2000);
              }
            })();
          }
        },
        onError: (err) => {
          const wasBackgrounded = appStateRef.current !== 'active';
          const isOSTermination = err.code === 0 || err.code === 'NETWORK';
          const partial = getStream(assistantId);
          perfEnd(perfKey, {
            status: 'error',
            assistantId,
            partialLength: (partial || '').length,
            code: err?.code,
            message: err?.message,
          });

          if (partial && partial.trim().length > 0) {
            if (isPrivate) updateLastAssistantContentPrivate(() => partial);
            else {
              updateLastAssistantContent(activeThread.id, () => partial);
              forceSaveThread(activeThread.id);
            }
          } else if (!partial || partial.trim().length === 0) {
            if (!isPrivate && activeThread?.id) {
              removeMessage(activeThread.id, assistantId);
            }
          }
          setStreaming(false);
          abortRef.current = null;
          setStreamingMsgId(null);
          clearStream(assistantId);

          if (wasBackgrounded && isOSTermination) {
            // swallow expected background termination
          } else {
            const pretty = mapProxyError(err, t);
            setError(pretty.message || t('chat.sendFailed', { defaultValue: 'Failed to send message. Please try again.' }));
          }
        },
      });
    } catch (err) {
      const wasCancelled = err?.code === 'ABORTED';
      const documentPreparationFailed = hasDocuments && !documentsReadyForChat;
      documentSendBusyRef.current = false;
      perfEnd(perfKey, {
        status: 'caught_error',
        assistantId,
        message: err?.message,
      });
      if (assistantAdded && assistantId) {
        if (isPrivate) {
          if (documentPreparationFailed || wasCancelled) removePrivateMessage(assistantId);
          else updateLastAssistantContentPrivate(() => t('chat.sendFailed', { defaultValue: 'Failed to send.' }));
        } else if (activeThread?.id) {
          removeMessage(activeThread.id, assistantId);
        }
        clearStream(assistantId);
      }
      if (documentPreparationFailed) {
        if (isPrivate) removePrivateMessage(u.id);
        else if (activeThread?.id) removeMessage(activeThread.id, u.id);
      }
      if (composerCleared && !(wasCancelled && documentsReadyForChat)) {
        setInput(previousInput);
        setAttachments(previousAttachments);
        setForceCollapseInput(false);
      }
      setStreaming(false);
      abortRef.current = null;
      setStreamingMsgId(null);
      if (!wasCancelled) {
        const pretty = mapProxyError(err, t);
        setError(
          (documentPreparationFailed && err?.message)
          || pretty.message
          || t('chat.sendFailed', { defaultValue: 'Failed to send message. Please try again.' }),
        );
      }
    }
  }

  function onStop() {
    perfLog('chat.stop_triggered', {
      streamingActive: !!abortRef.current,
      streamingMsgId,
      isRecording,
    });
    if (abortRef.current) {
      if (streamingMsgId) {
        const partial = getStream(streamingMsgId);
        if (partial && partial.trim().length > 0) {
          if (isPrivate) {
            updateLastAssistantContentPrivate(() => partial);
          } else {
            updateLastAssistantContent(activeThread.id, () => partial);
            forceSaveThread(activeThread.id);
          }
        } else {
          if (isPrivate) {
            // leave as empty non-typing bubble in private mode
          } else if (activeThread?.id) {
            removeMessage(activeThread.id, streamingMsgId);
          }
        }
        clearStream(streamingMsgId);
        setStreamingMsgId(null);
      }
      abortRef.current.abort();
      abortRef.current = null;
      setStreaming(false);
    }
    if (isRecording) {
      stopVoice();
    }
  }
  function onRetryFromHere(message) {
    perfLog('chat.retry_from_message', {
      messageId: message?.id,
      role: message?.role,
    });
    const raw = message?.content || '';
    const isAssistant = message?.role === 'assistant';
    setInput(isAssistant ? plainTextFromMarkdown(raw) : raw);
  }

  const handleReportAssistantResponse = useCallback(({ message, prompt }) => {
    if (!message || message.role !== 'assistant') return;
    setReportTarget({
      content_type: 'chat_response',
      content_id: message.id,
      prompt: typeof prompt === 'string' ? plainTextFromMarkdown(prompt) : '',
      output_text: message.content,
      model: message?.meta?.model || activeModelKey,
      source_screen: 'chat',
      metadata: {
        private_chat: !!isPrivate,
        ...(isPrivate ? {} : { thread_id: activeThread?.id || null }),
      },
    });
  }, [activeModelKey, activeThread?.id, isPrivate]);


  if (!activeThread) return <View style={styles.container}><Text>{t('chat.loading')}</Text></View>;

  if (!hydrated) {
    return (
      <View style={styles.container}>
        <View style={styles.header}><Text style={styles.headerTitle}>{t('chat.loading')}</Text></View>
        <View style={styles.loadingCenter}>
          <Text style={styles.loadingHint}>{t('chat.loadingChat')}</Text>
        </View>
      </View>
    );
  }

  const messageListContent = (
    <View
      style={styles.flex1}
      onTouchStart={(e) => {
        const { pageX, pageY } = e?.nativeEvent || {};
        tapRef.current = {
          x: typeof pageX === 'number' ? pageX : 0,
          y: typeof pageY === 'number' ? pageY : 0,
          ts: Date.now(),
          moved: false,
        };
      }}
      onTouchMove={(e) => {
        const s = tapRef.current;
        if (!s.ts || s.moved) return;
        const { pageX, pageY } = e?.nativeEvent || {};
        if (typeof pageX !== 'number' || typeof pageY !== 'number') return;
        const dx = pageX - s.x;
        const dy = pageY - s.y;
        if (dx * dx + dy * dy > 64) s.moved = true; // ~8px
      }}
      onTouchEnd={() => {
        const s = tapRef.current;
        const dt = s.ts ? Date.now() - s.ts : 0;
        const isTap = !!s.ts && !s.moved && dt > 0 && dt < 260;
        tapRef.current.ts = 0;
        tapRef.current.moved = false;
        if (!isTap) return;
        if (suppressSelectionResetRef.current) {
          suppressSelectionResetRef.current = false;
          if (suppressSelectionResetTimeoutRef.current) {
            clearTimeout(suppressSelectionResetTimeoutRef.current);
            suppressSelectionResetTimeoutRef.current = null;
          }
          return;
        }
        Keyboard.dismiss();
        bumpSelectionResetToken();
      }}
    >
      <MessageList
        ref={messageListRef}
        messages={messagesNoSystem}
        streaming={streaming}
        streamingMessageId={streamingMsgId}
        onRetryFromHere={onRetryFromHere}
        onToast={showToast}
        threadKey={activeThread.id}
        contentContainerStyle={styles.messageListContent}
        selectionResetToken={selectionResetToken}
        onActionPressIn={holdSelectionReset}
        onReport={handleReportAssistantResponse}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <ChatToast visible={toastVisible} message={toastMessage} />
      <ReportContentModal
        visible={!!reportTarget}
        report={reportTarget}
        privateDisclosure={!!reportTarget?.metadata?.private_chat}
        onClose={() => setReportTarget(null)}
      />
      <KeyboardAvoidingView
        behavior="translate-with-padding"
        keyboardVerticalOffset={keyboardVerticalOffset}
        style={styles.flex1}
      >
        {/* We moved the inner flex wrapper here to contain everything */}
        <View style={styles.flex1}>
          
          {!!error && (
            <View style={styles.error}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {isChatEmpty ? (
            // --- FIX IS HERE: Wrapping Empty State in TouchableWithoutFeedback ---
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.flex1}>
                {isAssistantThread ? (
                  <AssistantHeader thread={activeThread} showOnlyWhenEmpty />
                ) : (
                  <View style={[styles.emptyState, isPrivate && styles.emptyStatePrivate]}>
                    {isPrivate ? (
                      <>
                        <View style={styles.emptyStateIcon}>
                          <Svg height={48} width={48} viewBox="0 -960 960 960" fill="#FFFFFF">
                            <Path d="M720-240q25 0 42.5-17.5T780-300q0-25-17.5-42.5T720-360q-25 0-42.5 17.5T660-300q0 25 17.5 42.5T720-240Zm0 120q30 0 56-14t43-39q-23-14-48-20.5t-51-6.5q-26 0-51 6.5T621-173q17 25 43 39t56 14ZM360-640h240v-80q0-50-35-85t-85-35q-50 0-85 35t-35 85v80ZM490-80H240q-33 0-56.5-23.5T160-160v-400q0-33 23.5-56.5T240-640h40v-80q0-83 58.5-141.5T480-920q83 0 141.5 58.5T680-720v80h40q33 0 56.5 23.5T800-560v52q-18-6-37.5-9t-42.5-3v-40H240v400h212q8 24 16 41.5T490-80Zm230 40q-83 0-141.5-58.5T520-240q0-83 58.5-141.5T720-440q83 0 141.5 58.5T920-240q0 83-58.5 141.5T720-40ZM240-560v400-400Z" />
                          </Svg>
                        </View>
                        <Text style={styles.emptyStateTitle}>{t('chat.privateTitle')}</Text>
                        <Text style={styles.emptyStateSubtitle}>{t('chat.privateSubtitle')}</Text>
                      </>
                    ) : (
                      showKeyboardHelpers && IMAGE_STUDIO_ENABLED ? (
                        <Reanimated.View style={bannerStyle}>
                          <CreativeStudioBanner
                            ref={bannerMediaRef}
                            onPress={handleCreateImagesPress}
                            paused={showVoiceOverlay || isRecording}
                            playVideo={decorativeMediaReady && !keyboardVisible}
                          />
                        </Reanimated.View>
                      ) : null
                    )}
                  </View>
                )}
              </View>
            </TouchableWithoutFeedback>
          ) : (
            // --- Normal List with Drag-to-Dismiss ---
            <View style={styles.flex1}>
              <KeyboardGestureArea
                style={styles.flex1}
                interpolator="ios"
                showOnKeyboardWillShow={false}
              >
                {messageListContent}
              </KeyboardGestureArea>
            </View>
          )}

          <View>
            <Reanimated.View style={suggestionStyle}>
              {showKeyboardHelpers && (
                <SuggestionCards
                  onSuggestionPress={handleQuickSuggestionPress}
                  imagePickerActive={imagePickerActive}
                />
              )}
            </Reanimated.View>
            <TestInput
              value={input}
              onChange={handleInputChange}
              onSend={onSend}
              onStop={onStop}
              onCreateImagesPress={handleCreateImagesPress}
              onOpenCameraPress={onOpenCameraPress}
              onOpenFilePress={onOpenFilePress}
              imagePickerActive={imagePickerActive}
              documentPickerActive={documentPickerActive}
              onSearchPress={() => {
                setWebSearchNext(v => !v);
              }}
              onClipboardPress={() => { }}
              webSearchEnabled={webSearchNext}
              onMicPress={handleMicPress}
              streaming={streaming}
              offline={offline}
              maxLength={nativeInputCharLimit}
              counterLimit={messageCharLimit}
              attachments={attachments}
              onRemoveAttachment={onRemoveAttachment}
              onRetryAttachment={onRetryAttachment}
              forceCollapsed={forceCollapseInput || isRecording}
              isRecording={isRecording}
              navigation={navigation}
            />
            {showVoiceOverlay || keepVoiceOverlayMounted ? (
              <VoiceOverlay
                visible={showVoiceOverlay}
                isRecording={isRecording}
                transcript={voiceText}
                volume={isRecording ? Math.max(volume || 0, 0.4) : 0}
                onInsert={() => {
                  setShowVoiceOverlay(false);
                  if (isRecording) stopVoice();
                  if (voiceText?.trim()) setInput(voiceText.trim());
                  committedVoiceTextRef.current = '';
                  setVoiceText('');
                }}
                onClose={() => {
                  setShowVoiceOverlay(false);
                  if (isRecording) stopVoice();
                  committedVoiceTextRef.current = '';
                  setVoiceText('');
                }}
              />
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  flex1: { flex: 1 },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingHint: { color: colors.textSecondary },
  header: { padding: 16 },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  error: { backgroundColor: colors.error + '20', padding: 10, borderRadius: 10, margin: 13, borderLeftWidth: 3, borderLeftColor: colors.error },
  errorText: { color: colors.error, fontSize: 14, fontWeight: '500' },
  messageListContent: { paddingBottom: 20 },
  emptyState: { flex: 1, alignItems: 'stretch', justifyContent: 'flex-start', paddingHorizontal: 16, paddingTop: 32, paddingBottom: 40, gap: 24 },
  emptyStatePrivate: { alignItems: 'center', justifyContent: 'center', paddingTop: 0, paddingBottom: 40, gap: 12 },
  emptyStateIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 19 },
  emptyStateTitle: { fontSize: 21, fontWeight: '700', color: colors.text, marginBottom: 6, textAlign: 'center' },
  emptyStateSubtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
