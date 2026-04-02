import React, { useEffect, useMemo, useRef, useState, useCallback, useContext } from 'react';
import { View, Text, StyleSheet, AppState, TouchableWithoutFeedback, Keyboard, Alert, Platform } from 'react-native';
import Reanimated, { useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';
import { useHeaderHeight } from '@react-navigation/elements';
import NetInfo from '@react-native-community/netinfo';
import { launchImageLibrary } from 'react-native-image-picker';
import Svg, { Path } from 'react-native-svg';

// --- KEYBOARD CONTROLLER IMPORTS ---
import { 
  KeyboardAvoidingView, 
  KeyboardGestureArea,           
  KeyboardEvents,
  useReanimatedKeyboardAnimation 
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
import { chatDebugLog, isChatDebugEnabled } from '../lib/chatDebug';
import { ensureSummaryIfNeeded } from '../lib/summaryBuilder';
import { buildPayload } from '../lib/payloadBuilder';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { useTranslation } from 'react-i18next';
import { SubscriptionContext } from '../context/SubscriptionContext';
import { isPremiumModel, FREE_MODEL } from '../config/premium';
import { setPendingPremiumAction } from '../state/premiumActions';

import { ensurePhotoLibraryAccess, ensureMicAndSpeech, promptOpenSettings } from '../lib/permissions';
import CreativeStudioBanner from '../components/chat/CreativeStudioBanner';
import RateUsService from '../services/RateUsService';
import ChatToast from '../components/chat/ChatToast';
import { plainTextFromMarkdown } from '../lib/plainTextFromMarkdown';

export default function Chat({ navigation }) {
  const { t } = useTranslation();
  const subscription = useContext(SubscriptionContext);
  const isPremium = !!subscription?.isPremium;
  
  const headerHeight = useHeaderHeight();

  // --- ANIMATION SETUP ---
  const { progress } = useReanimatedKeyboardAnimation();

  // 1. Suggestion Chips Animation
  const suggestionStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(progress.value, [0, 0.5], [1, 0], Extrapolation.CLAMP),
      transform: [
        { translateY: interpolate(progress.value, [0, 1], [0, 20], Extrapolation.CLAMP) }
      ],
      pointerEvents: progress.value > 0.1 ? 'none' : 'auto',
    };
  });

  // 2. Banner Animation
  const bannerStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(progress.value, [0, 0.6], [1, 0], Extrapolation.CLAMP),
      transform: [
        { translateY: interpolate(progress.value, [0, 1], [0, -100], Extrapolation.CLAMP) },
        { scale: interpolate(progress.value, [0, 1], [1, 0.9], Extrapolation.CLAMP) }
      ],
    };
  });

  // Stores
  const threads = useThreadsStore(s => s.threads);
  const activeThreadId = useThreadsStore(s => s.activeThreadId);
  const hydrated = useThreadsStore(s => s.hydrated);
  const hydrate = useThreadsStore(s => s.hydrate);
  const createThread = useThreadsStore(s => s.createThread);
  const setActiveThread = useThreadsStore(s => s.setActiveThread);
  const addMessage = useThreadsStore(s => s.addMessage);
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
  const updateLastAssistantContentPrivate = useThreadsStore(s => s.updateLastAssistantContentPrivate);

  // Settings
  const globalModel = useSettingsStore(s => s.model);
  const modelsMap = useSettingsStore(s => s.models);

  // Local
  const messageListRef = useRef(null);
  const didInitialScrollRef = useRef(false);
  const [selectionResetToken, setSelectionResetToken] = useState(0);
  const tapRef = useRef({ x: 0, y: 0, ts: 0, moved: false });
  const bumpSelectionResetToken = useCallback(() => {
    setSelectionResetToken(v => v + 1);
  }, []);

  const normalActive = useMemo(
    () => threads.find(d => d.id === activeThreadId) || null,
    [threads, activeThreadId]
  );
  const activeThread = isPrivate ? privateThread : normalActive;

  // Model selection
  const pinnedModel = !!(activeThread?.meta && activeThread?.meta?.pinnedModel);
  const activeModelKey = pinnedModel
    ? (activeThread?.model || globalModel)
    : (globalModel || activeThread?.model);
  const activeModelCaps = modelsMap?.[activeModelKey]?.caps || {};

  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [error, setError] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [offline, setOffline] = useState(false);
  const [streamingMsgId, setStreamingMsgId] = useState(null);
  const [forceCollapseInput, setForceCollapseInput] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

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
    };
  }, []);

  useEffect(() => {
    const show = () => setKeyboardVisible(true);
    const hide = () => setKeyboardVisible(false);

    const subscriptions = [
      KeyboardEvents.addListener('keyboardWillShow', show),
      KeyboardEvents.addListener('keyboardDidShow', show),
      KeyboardEvents.addListener('keyboardWillHide', hide),
      KeyboardEvents.addListener('keyboardDidHide', hide),
    ];

    return () => {
      subscriptions.forEach(sub => sub?.remove?.());
    };
  }, []);
  
  const [showVoiceOverlay, setShowVoiceOverlay] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [webSearchNext, setWebSearchNext] = useState(false); 
  const resolvedActiveModel = useMemo(
    () => (activeModelKey === 'gpt-5-nano' ? 'gpt-5.2-chat-latest' : activeModelKey),
    [activeModelKey]
  );
  const requestModelKey = useMemo(
    () => (webSearchNext ? 'gpt-5.2' : resolvedActiveModel),
    [webSearchNext, resolvedActiveModel]
  );
  const successfulMessagesRef = useRef(0); 
  const abortRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  const messagesNoSystem = useMemo(
    () => {
      if (!activeThread) return [];
      return (activeThread.messages || []).filter(m => m.role !== 'system');
    },
    [activeThread]
  );

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
  const showKeyboardHelpers = showQuickSuggestions && !keyboardVisible;
  const useIosKeyboardLayout = Platform.OS === 'ios';
  const RootKeyboardView = useIosKeyboardLayout ? KeyboardAvoidingView : View;

  const onFinalText = useCallback((text) => {
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    setVoiceText(trimmed);
  }, [setVoiceText]);
  const onPartialText = useCallback((text) => {
    setVoiceText(text || '');
  }, [setVoiceText]);
  const { isRecording, volume, start: startVoice, stop: stopVoice, activate: activateVoice } = useVoiceInput({
    onPartialText,
    onFinalText,
    autoInit: false,
  });

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);
  
  useEffect(() => {
    if (!isPremium && activeModelKey && isPremiumModel(activeModelKey)) {
      if (!pinnedModel) {
        const setModel = useSettingsStore.getState().setModel;
        setModel(FREE_MODEL);
      }
    }
  }, [isPremium, activeModelKey, pinnedModel]);

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

  function addPickedAssets(assets = []) {
    const normalized = assets
      .filter(a => a?.uri && a?.type)
      .map((a, idx) => ({
        id: `${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
        uri: a.uri, type: a.type, base64: a.base64 || null,
      }));
    if (!normalized.length) return;
    setAttachments(prev => {
      const seen = new Set(prev.map(p => p.uri));
      const merged = [...prev];
      for (const n of normalized) if (!seen.has(n.uri)) { merged.push(n); seen.add(n.uri); }
      return merged;
    });
  }

  const onOpenCameraPress = useCallback(async () => {
    const photosTitle = t('chat.permissions.photosTitle', { defaultValue: 'Photos Permission Needed' });
    const photosMessage = t('chat.permissions.photosMessage', { defaultValue: 'Photo access is required to choose images.' });
    const res = await ensurePhotoLibraryAccess({ write: false });
    if (!res.ok) {
      if (res.blocked) {
        promptOpenSettings(photosTitle, photosMessage);
      } else {
        Alert.alert(
          photosTitle,
          photosMessage,
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('common.allow', { defaultValue: 'Allow' }),
              onPress: async () => {
                const retry = await ensurePhotoLibraryAccess({ write: false });
                if (!retry.ok && retry.blocked) {
                  promptOpenSettings(photosTitle, photosMessage);
                }
              }
            }
          ],
          { cancelable: true }
        );
      }
      return;
    }

    launchImageLibrary(
      { mediaType: 'photo', includeBase64: true, selectionLimit: 2, maxWidth: 500, maxHeight: 500, quality: 0.52 },
      (response) => {
        if (response?.didCancel) return;
        if (response?.errorCode || response?.errorMessage) {
          Alert.alert(
            t('chat.imagePickerErrorTitle'),
            t('chat.imagePickerErrorMessage', { defaultValue: 'Unable to access your photos. Please try again.' })
          );
          return;
        }
        const assetsList = Array.isArray(response?.assets) ? response.assets : [];
        if (!assetsList.length) return;
        addPickedAssets(assetsList);
      }
    );
  }, [t]);

  const activeThreadIdForInsert = activeThread?.id;

  const onInsertImagesMarkdown = useCallback((md) => {
    const a = newAssistantMessage(md);
    if (isPrivate) addPrivateMessage(a);
    else if (activeThreadIdForInsert) addMessage(activeThreadIdForInsert, a);
    requestAnimationFrame(() => messageListRef.current?.scrollToBottom(true));
  }, [addMessage, addPrivateMessage, activeThreadIdForInsert, isPrivate]);

  const handleCreateImagesPress = useCallback(() => {
    setInsertToChatCallback(onInsertImagesMarkdown);
    try {
      navigation.navigate('Studio', {
        screen: 'StudioHome',
      });
    } catch (err) { }
  }, [navigation, onInsertImagesMarkdown, setInsertToChatCallback]);

  const handleEditImagePress = useCallback(() => {
    setInsertToChatCallback(onInsertImagesMarkdown);
    try {
      navigation.navigate('Studio', {
        screen: 'EditImage',
        params: { 
          seedPrompt: input || '', 
          returnTo: 'Chat' 
        },
      });
    } catch (err) { }
  }, [input, navigation, onInsertImagesMarkdown, setInsertToChatCallback]);

  const handleAssistantsPress = useCallback(() => {
    navigation.navigate('Assistants');
  }, [navigation]);

  const startVoiceFlow = useCallback(async () => {
    if (isRecording) {
      stopVoice();
      setShowVoiceOverlay(false);
      return;
    }

    activateVoice();
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
      return;
    }

    setInput('');
    try {
      const started = await startVoice();
      if (!started) return;
    } catch (err) {
      const pretty = mapProxyError(err);
      setError(pretty.message || t('chat.voiceStartFailed', { defaultValue: 'Could not start voice.' }));
      return;
    }
    setShowVoiceOverlay(true);
    setVoiceText('');
  }, [activateVoice, isRecording, setShowVoiceOverlay, stopVoice, setInput, startVoice, setError, t, setVoiceText]);

  const handleMicPress = useCallback(() => {
    if (isRecording) {
      startVoiceFlow();
      return;
    }

    if (isPremium) {
      startVoiceFlow();
      return;
    }

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
  }, [isRecording, isPremium, navigation, startVoiceFlow]);

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
  }, [handleAssistantsPress, handleCreateImagesPress, handleEditImagePress, handleMicPress, onOpenCameraPress, setInput]);

  const onRemoveAttachment = useCallback((att) => {
    setAttachments(prev => prev.filter(a => a.id !== att.id));
  }, []);

  // ==== Send flow ====
  async function onSend(overrideText) {
    if (offline) {
      setError(t('chat.offlineError', { defaultValue: 'No internet connection. Please check your connection and try again.' }));
      return;
    }
    if (streaming) {
      return;
    }

    setError('');
    const textRaw = typeof overrideText === 'string' ? overrideText : input;
    const text = (textRaw || '').trim();
    const hasText = !!text;
    const hasImages = attachments.length > 0;

    if (!hasText && !hasImages) {
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

    const MAX_CHARS = 16000;
    if (text.length > MAX_CHARS) {
      setError(t('chat.messageTooLong', { length: text.length, limit: MAX_CHARS }));
      return;
    }

    const previousInput = input;
    const previousAttachments = [...attachments];

    const mmParts = [
      ...(hasText ? [{ type: 'text', text }] : []),
      ...attachments.filter(a => a.base64 && a.type).map(a => ({
        type: 'image_url', image_url: { url: `data:${a.type};base64,${a.base64}` }
      })),
    ];
    const mUser = { role: 'user', content: mmParts.length ? mmParts : text };

    const mdImages = attachments.map(a => `![photo](${a.uri})`).join('\n');
    const displayMd = [mdImages, text].filter(Boolean).join('\n\n');
    const u = newUserMessage(displayMd); u.mm = mmParts;

    let assistantId = null;
    let assistantAdded = false;
    let composerCleared = false;

    try {
      const a = newAssistantMessage();
      assistantId = a.id;
      
      try {
        const initialActivity = hasImages
          ? t('chat.activity.analyzingImages', { defaultValue: 'Analyzing images…' })
          : (webSearchNext
            ? t('chat.activity.searching', { defaultValue: 'Searching…' })
            : t('chat.activity.thinking', { defaultValue: 'Thinking…' }));
        a.meta = { ...(a.meta || {}), activity: initialActivity };
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

      const threadMessages = activeThread.messages || [];
      const threadForContext = { ...activeThread, messages: [...threadMessages, mUser] };
      await ensureSummaryIfNeeded(threadForContext, isPrivate ? undefined : setThreadSummary);
      const payload = buildPayload({ thread: threadForContext, newMsg: mUser, tokenCap: 6000 });

      setStreaming(true);
      const deviceId = await ensureDeviceId();
      const controller = new AbortController(); abortRef.current = controller;

      const streamDebug = isChatDebugEnabled('streaming');
      const startedAt = Date.now();
      let netChars = 0;
      let netChunks = 0;
      let lastNetLogAt = startedAt;
      if (streamDebug) {
        chatDebugLog('streaming', 'request', {
          assistantId,
          model: requestModelKey,
          webSearchNext,
          hasImages,
        });
      }

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
            if (streamDebug) {
              netChars += chunk.length;
              netChunks += 1;
              const now = Date.now();
              if (now - lastNetLogAt > 1000) {
                lastNetLogAt = now;
                chatDebugLog('streaming', 'onToken', {
                  assistantId,
                  netChunks,
                  netChars,
                  bufferLen: getStream(assistantId).length,
                  elapsedMs: now - startedAt,
                });
                netChars = 0;
                netChunks = 0;
              }
            }
          }
        },
        onDone: () => {
          const full = getStream(assistantId);
          if (streamDebug) {
            const now = Date.now();
            chatDebugLog('streaming', 'done', {
              assistantId,
              fullLen: (full || '').length,
              elapsedMs: now - startedAt,
            });
          }
          
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
          if (streamDebug) {
            const now = Date.now();
            chatDebugLog('streaming', 'error', {
              assistantId,
              partialLen: (partial || '').length,
              elapsedMs: now - startedAt,
              code: err?.code,
              message: err?.message,
            });
          }

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
            const pretty = mapProxyError(err);
            setError(pretty.message || t('chat.sendFailed', { defaultValue: 'Failed to send message. Please try again.' }));
          }
        },
      });
    } catch (err) {
      if (assistantAdded && assistantId) {
        if (isPrivate) {
          updateLastAssistantContentPrivate(() => t('chat.sendFailed', { defaultValue: 'Failed to send.' }));
        } else if (activeThread?.id) {
          removeMessage(activeThread.id, assistantId);
        }
        clearStream(assistantId);
      }
      if (composerCleared) {
        setInput(previousInput);
        setAttachments(previousAttachments);
        setForceCollapseInput(false);
      }
      setStreaming(false);
      abortRef.current = null;
      setStreamingMsgId(null);
      const pretty = mapProxyError(err);
      setError(pretty.message || t('chat.sendFailed', { defaultValue: 'Failed to send message. Please try again.' }));
    }
  }

  function onStop() {
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
    const raw = message?.content || '';
    const isAssistant = message?.role === 'assistant';
    setInput(isAssistant ? plainTextFromMarkdown(raw) : raw);
  }


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
        contentContainerStyle={{ paddingBottom: 20 }}
        selectionResetToken={selectionResetToken}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <ChatToast visible={toastVisible} message={toastMessage} />
      <RootKeyboardView
        {...(useIosKeyboardLayout
          ? {
              behavior: 'padding',
              keyboardVerticalOffset: headerHeight - 25 || 65,
            }
          : {})}
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
                      // Collapse helper content out of layout when the keyboard is opening,
                      // otherwise the invisible banner/suggestions still push the composer below the keyboard.
                      showKeyboardHelpers ? (
                        <Reanimated.View style={bannerStyle}>
                          <CreativeStudioBanner onPress={handleCreateImagesPress} paused={showVoiceOverlay || isRecording} />
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
              {useIosKeyboardLayout ? (
                <KeyboardGestureArea
                  style={styles.flex1}
                  interpolator="ios"
                  showOnKeyboardWillShow={false}
                >
                  {messageListContent}
                </KeyboardGestureArea>
              ) : (
                messageListContent
              )}
            </View>
          )}

          <View>
            {/* Animated Suggestions */}
            <Reanimated.View style={suggestionStyle}>
              {showKeyboardHelpers && (
                <SuggestionCards onSuggestionPress={handleQuickSuggestionPress} />
              )}
            </Reanimated.View>
            
            <TestInput
              value={input}
              onChange={setInput}
              onSend={onSend}
              onStop={onStop}
              onCreateImagesPress={handleCreateImagesPress}
              onOpenCameraPress={onOpenCameraPress}
              onSearchPress={() => {
                setWebSearchNext(v => !v);
              }}
              onClipboardPress={() => { }}
              webSearchEnabled={webSearchNext}
              onMicPress={handleMicPress}
              streaming={streaming}
              offline={offline}
              maxLength={16000}
              attachments={attachments}
              onRemoveAttachment={onRemoveAttachment}
              forceCollapsed={forceCollapseInput || isRecording}
              isRecording={isRecording}
              navigation={navigation}
            />
            <VoiceOverlay
              visible={showVoiceOverlay}
              isRecording={isRecording}
              transcript={voiceText}
              volume={isRecording ? Math.max(volume || 0, 0.4) : 0}
              onInsert={() => {
                setShowVoiceOverlay(false);
                if (isRecording) stopVoice();
                if (voiceText?.trim()) setInput(voiceText.trim());
              }}
              onClose={() => {
                setShowVoiceOverlay(false);
                if (isRecording) stopVoice();
              }}
            />
          </View>
        </View>
      </RootKeyboardView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  flex1: { flex: 1 },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingHint: { color: colors.textSecondary },
  header: { padding: 16 },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  error: { backgroundColor: colors.error + '20', padding: 10, borderRadius: 10, margin: 13, borderLeftWidth: 3, borderLeftColor: colors.error },
  errorText: { color: colors.error, fontSize: 14, fontWeight: '500' },
  emptyState: { flex: 1, alignItems: 'stretch', justifyContent: 'flex-start', paddingHorizontal: 16, paddingTop: 32, paddingBottom: 40, gap: 24 },
  emptyStatePrivate: { alignItems: 'center', justifyContent: 'center', paddingTop: 0, paddingBottom: 40, gap: 12 },
  emptyStateIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 19 },
  emptyStateTitle: { fontSize: 21, fontWeight: '700', color: colors.text, marginBottom: 6, textAlign: 'center' },
  emptyStateSubtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
