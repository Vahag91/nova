import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, AppState, TouchableWithoutFeedback, Keyboard, Alert } from 'react-native';
import Reanimated, { useAnimatedKeyboard, useAnimatedStyle, useSharedValue, useDerivedValue, withTiming, Easing, KeyboardState } from 'react-native-reanimated';
import NetInfo from '@react-native-community/netinfo';
import { launchImageLibrary } from 'react-native-image-picker';

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
import { buildPayload, getPayloadSize } from '../lib/payloadBuilder';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { useTranslation } from 'react-i18next';


import { ensurePhotoLibraryAccess, ensureMicAndSpeech, promptOpenSettings } from '../lib/permissions';
import CreativeStudioBanner from '../components/chat/CreativeStudioBanner';

export default function Chat({ navigation }) {
  const { t } = useTranslation();

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

  const normalActive = useMemo(
    () => threads.find(d => d.id === activeThreadId) || null,
    [threads, activeThreadId]
  );
  const activeThread = isPrivate ? privateThread : normalActive;

  // Model selection
  // If this thread is an assistant with a pinned model, respect the thread's model
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
  const [showVoiceOverlay, setShowVoiceOverlay] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [webSearchNext, setWebSearchNext] = useState(false); // per-message web search
  const abortRef = useRef(null);
  const appStateRef = useRef(AppState.currentState); // Track if app is in background

  const messagesNoSystem = useMemo(
    () => (activeThread?.messages || []).filter(m => m.role !== 'system'),
    [activeThread?.messages]
  );

  // Check if chat is empty (no user/assistant messages)
  const isChatEmpty = messagesNoSystem.length === 0;
  // Check if this is an assistant thread (thread.system or legacy system message)
  const isAssistantThread = !!(activeThread?.system) || activeThread?.messages?.some(m => m.role === 'system');
  const showQuickSuggestions = !isPrivate && isChatEmpty && !isAssistantThread;

  // Voice: manual stop => send once
  const onFinalText = useCallback((text) => {
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    setVoiceText(trimmed);
  }, [setVoiceText]);
  const onPartialText = useCallback((text) => {
    setVoiceText(text || '');
  }, [setVoiceText]);
  const { isRecording, volume, start: startVoice, stop: stopVoice } = useVoiceInput({ onPartialText, onFinalText });

  // Hydrate & ensure thread
  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);
  // No debug logging of error state

useEffect(() => {
  if (!hydrated || isPrivate) return;
  if (!activeThread) {
    const th = createThread({ title: t('history.newChat'), model: globalModel });
    setActiveThread(th.id);
  }
}, [hydrated, isPrivate, activeThread, createThread, setActiveThread, globalModel, t]);

  // Scroll management
  useEffect(() => { didInitialScrollRef.current = false; }, [activeThread?.id]);
  useEffect(() => {
    if (!activeThread?.messages?.length || didInitialScrollRef.current) return;
    requestAnimationFrame(() => {
      messageListRef.current?.scrollToBottom(false);
      setTimeout(() => messageListRef.current?.scrollToBottom(false), 0);
    });
    didInitialScrollRef.current = true;
  }, [activeThread?.messages?.length, activeThread?.id]);
  // Keyboard animation
  const keyboard = useAnimatedKeyboard();
  const GAP = 6;
  const kTranslate = useSharedValue(0);
  const kGap = useSharedValue(0);
  useDerivedValue(() => {
    const h = keyboard.height.value;
    const isClosing = keyboard.state.value === KeyboardState.CLOSING;
    const duration = isClosing ? 240 : 40;
    kTranslate.value = withTiming(-h, { duration, easing: Easing.out(Easing.cubic) });
    kGap.value = withTiming(h > 0 ? GAP : 0, { duration, easing: Easing.out(Easing.cubic) });
  });
  const animatedContentStyle = useAnimatedStyle(() => ({ transform: [{ translateY: kTranslate.value }] }));
  const animatedFooterStyle = useAnimatedStyle(() => ({ transform: [{ translateY: kTranslate.value + kGap.value }] }));

  const logAi = useCallback(() => {}, []);

  // Network
  useEffect(() => {
    const sub = NetInfo.addEventListener(s =>
      setOffline(!(s.isConnected && s.isInternetReachable))
    );
    return () => sub && sub();
  }, []);

  // App background: track state + stop voice recording (streaming continues until OS kills it)
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

  // Cleanup on unmount
  useEffect(() => () => {
    if (useThreadsStore.getState().privateActive) endPrivate();
    clearInsertToChatCallback();
  }, [clearInsertToChatCallback, endPrivate]);
  useEffect(() => () => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
  }, []);

  useEffect(() => {
    if (forceCollapseInput) {
      const timeoutId = setTimeout(() => setForceCollapseInput(false), 200);
      return () => clearTimeout(timeoutId);
    }
  }, [forceCollapseInput]);

  // Attachments
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
    const res = await ensurePhotoLibraryAccess({ write: false });
    if (!res.ok) {
      // Mirror the official "blocked vs denied" flow with a single user-friendly prompt
      if (res.blocked) {
        promptOpenSettings(
          t('chat.imagePickerErrorTitle') || 'Photos Permission Needed',
          t('chat.photosPermissionMessage') || 'Photo access is blocked. Please enable it in Settings.'
        );
      } else {
        Alert.alert(
          t('chat.imagePickerErrorTitle') || 'Photos Permission Needed',
          t('chat.photosPermissionMessage') || 'Photo access is required to choose images.',
          [
            { text: t('common.cancel') || 'Cancel', style: 'cancel' },
            {
              text: t('common.allow') || 'Allow',
              onPress: async () => {
                const retry = await ensurePhotoLibraryAccess({ write: false });
                if (!retry.ok && retry.blocked) {
                  promptOpenSettings(
                    t('chat.imagePickerErrorTitle') || 'Photos Permission Needed',
                    t('chat.photosPermissionMessage') || 'Photo access is blocked. Please enable it in Settings.'
                  );
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
          Alert.alert(t('chat.imagePickerErrorTitle') || 'Photos Error', response?.errorMessage || response?.errorCode);
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
    navigation.navigate('ImagesStudio', { seedPrompt: input });
  }, [input, navigation, onInsertImagesMarkdown, setInsertToChatCallback]);

  const handleEditImagePress = useCallback(() => {
    setInsertToChatCallback(onInsertImagesMarkdown);
    navigation.navigate('ImagesStudio', {
      seedPrompt: input,
      startMode: 'img2img',
    });
  }, [input, navigation, onInsertImagesMarkdown, setInsertToChatCallback]);

  const handleAssistantsPress = useCallback(() => {
    navigation.navigate('Assistants');
  }, [navigation]);

  const handleMicPress = useCallback(async () => {
    if (isRecording) {
      stopVoice();
      setShowVoiceOverlay(false);
      return;
    }

    const res = await ensureMicAndSpeech();
    if (!res.ok) {
      if (res.blocked) {
        promptOpenSettings(
          t('chat.voicePermissionTitle') || 'Voice Permissions Needed',
          t('chat.voicePermissionMessage') || 'Microphone/Speech access is blocked. Please enable them in Settings.'
        );
      } else {
        Alert.alert(
          t('chat.voicePermissionTitle') || 'Voice Permissions Needed',
          t('chat.voicePermissionMessage') || 'Microphone and Speech Recognition are required to use voice.',
          [
            { text: t('common.cancel') || 'Cancel', style: 'cancel' },
            {
              text: t('common.allow') || 'Allow',
              onPress: async () => {
                const retry = await ensureMicAndSpeech();
                if (!retry.ok && retry.blocked) {
                  promptOpenSettings(
                    t('chat.voicePermissionTitle') || 'Voice Permissions Needed',
                    t('chat.voicePermissionMessage') || 'Microphone/Speech access is blocked. Please enable them in Settings.'
                  );
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
      setError(pretty.message || t('chat.voiceStartFailed') || 'Could not start voice.');
      return;
    }
    setShowVoiceOverlay(true);
    setVoiceText('');
  }, [isRecording, setShowVoiceOverlay, stopVoice, setInput, startVoice, setError, t, setVoiceText]);

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
      setError(t('chat.offlineBanner') || "You're offline. Try again when you're back online.");
      return;
    }
    if (streaming) return;

    setError('');
    const textRaw = typeof overrideText === 'string' ? overrideText : input;
    const text = (textRaw || '').trim();
    const hasText = !!text;
    const hasImages = attachments.length > 0;

    if (!hasText && !hasImages) return;
    if (!activeThread) return;

    if (hasImages && !activeModelCaps.visionInput) {
      setError(`The selected model (${modelsMap?.[activeModelKey]?.display?.name || activeModelKey}) does not support images.`);
      return;
    }

    const MAX_CHARS = 16000;
    if (text.length > MAX_CHARS) {
      setError(t('chat.messageTooLong', { length: text.length, limit: MAX_CHARS }) || `Message too long (${text.length}/${MAX_CHARS}).`);
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
          ? t('chat.activityAnalyzingImages', 'Analyzing images…')
          : (webSearchNext ? t('chat.activitySearching', 'Searching…') : t('chat.activityThinking', 'Thinking…'));
        a.meta = { ...(a.meta || {}), activity: initialActivity };
      } catch { }

      if (isPrivate) { addPrivateMessage(u); addPrivateMessage(a); }
      else { addMessage(activeThread.id, u); addMessage(activeThread.id, a); }
      setStreamingMsgId(assistantId);
      requestAnimationFrame(() => messageListRef.current?.scrollToBottom(true));
      assistantAdded = true;

      // reset composer (but leave webSearchNext until send completion)
      setInput('');
      setAttachments([]);
      setForceCollapseInput(true);
      composerCleared = true;

      const threadForContext = { ...activeThread, messages: [...(activeThread.messages || []), mUser] };
      // Dev: log thread context snapshot (sanitized) before payload build
      logAi('thread_meta', {
        threadId: activeThread?.id,
        title: activeThread?.title,
        hasSystem: !!activeThread?.system,
        pinnedModel: !!activeThread?.meta?.pinnedModel,
        assistantName: activeThread?.meta?.assistantName || activeThread?.title,
        presetId: activeThread?.meta?.presetId || null,
        msgCountNoSystem: (activeThread?.messages || []).filter(m => m.role !== 'system').length,
      });
      await ensureSummaryIfNeeded(threadForContext, isPrivate ? undefined : setThreadSummary);
      const payload = buildPayload({ thread: threadForContext, newMsg: mUser, tokenCap: 6000 });

      // Classify system parts for easier debugging
      const sys0 = payload[0]?.role === 'system' ? payload[0].content : '';
      const sys1 = payload[1]?.role === 'system' ? payload[1].content : '';
      const maybeExtras = payload.slice(2).filter(m => m.role === 'system').map(m => m.content);
      logAi('context', {
        threadId: activeThread?.id,
        model: activeModelKey,
        tokensEst: (() => { try { return getPayloadSize(payload); } catch { return -1; } })(),
        systemGlobalPreview: typeof sys0 === 'string' ? sys0.slice(0, 160) : '[mm] ',
        systemPersonaPreview: typeof sys1 === 'string' ? sys1.slice(0, 160) : '[none]',
        extraSystemPreviews: maybeExtras.map(s => (s || '').slice(0, 160)),
        messageCount: payload.length,
      });

      // Dedicated context size log for quick metrics
      try {
        const size = typeof getPayloadSize === 'function' ? getPayloadSize(payload) : -1;
        const roles = payload.map(p => p.role);
        logAi('context_size', {
          tokensEst: size,
          charsApprox: size > 0 ? size * 4 : -1,
          roles,
          systems: roles.filter(r => r === 'system').length,
          users: roles.filter(r => r === 'user').length,
          assistants: roles.filter(r => r === 'assistant').length,
        });
      } catch {}

      logAi('request', {
        threadId: activeThread?.id || activeThreadIdForInsert,
        model: activeModelKey,
        payload,
      });

      setStreaming(true);
      const deviceId = await ensureDeviceId();
      const controller = new AbortController(); abortRef.current = controller;

      streamChat({
        model: activeModelKey,
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
          logAi('response', {
            threadId: activeThread?.id || activeThreadIdForInsert,
            messageId: assistantId,
            content: full,
          });
          if (isPrivate) updateLastAssistantContentPrivate(() => full);
          else updateLastAssistantContent(activeThread.id, () => full);
          setStreaming(false);
          abortRef.current = null;
          setStreamingMsgId(null);
          clearStream(assistantId);
          if (!isPrivate) forceSaveThread(activeThread.id);
          setWebSearchNext(false);
        },
        onError: (err) => {
          logAi('response_error', {
            threadId: activeThread?.id || activeThreadIdForInsert,
            messageId: assistantId,
            error: err,
          });
          const wasBackgrounded = appStateRef.current !== 'active';
          const isOSTermination = err.code === 0 || err.code === 'NETWORK';
          const partial = getStream(assistantId);

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
            setError(pretty.message);
          }
        },
      });
    } catch (err) {
      logAi('request_failed', {
        threadId: activeThread?.id || activeThreadIdForInsert,
        error: err,
      });
      if (assistantAdded && assistantId) {
        if (isPrivate) {
          updateLastAssistantContentPrivate(() => t('chat.sendFailed') || 'Failed to send.');
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
      setError(pretty.message || t('chat.sendFailed') || 'Failed to send.');
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
  function onRetryFromHere(message) { setInput(message?.content || ''); }

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

  return (
    <View style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.flex1}>
          {offline && (
            <View style={styles.offlineBanner}>
              <Text style={styles.offlineText}>{t('chat.offlineBanner')}</Text>
            </View>
          )}

          {!!error && (
            <View style={styles.error}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {isChatEmpty ? (
            <Reanimated.View style={[styles.flex1, animatedContentStyle]}>
              {isAssistantThread ? (
                <AssistantHeader thread={activeThread} showOnlyWhenEmpty />
              ) : (
                <View style={[styles.emptyState, isPrivate && styles.emptyStatePrivate]}>
                  {isPrivate ? (
                    <>
                      <View style={styles.emptyStateIcon}><Text style={styles.emptyStateIconText}>💬</Text></View>
                      <Text style={styles.emptyStateTitle}>{t('chat.privateTitle')}</Text>
                      <Text style={styles.emptyStateSubtitle}>{t('chat.privateSubtitle')}</Text>
                    </>
                  ) : (
                    <CreativeStudioBanner onPress={handleCreateImagesPress} paused={showVoiceOverlay || isRecording} />
                  )}
                </View>
              )}
            </Reanimated.View>
          ) : (
            <Reanimated.View style={[styles.flex1, animatedContentStyle]}>
              <MessageList
                ref={messageListRef}
                messages={messagesNoSystem}
                streaming={streaming}
                streamingMessageId={streamingMsgId}
                onRetryFromHere={onRetryFromHere}
                threadKey={activeThread.id}
              />
            </Reanimated.View>
          )}

          <Reanimated.View style={animatedFooterStyle}>
            {showQuickSuggestions && (
              <SuggestionCards onSuggestionPress={handleQuickSuggestionPress} />
            )}
            <TestInput
              value={input}
              onChange={setInput}
              onSend={onSend}
              onStop={onStop}
              onCreateImagesPress={handleCreateImagesPress}
              onOpenCameraPress={onOpenCameraPress}
              onSearchPress={() => setWebSearchNext(v => !v)}
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
          </Reanimated.View>
        </View>
      </TouchableWithoutFeedback>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  flex1: { flex: 1 },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingHint: { color: colors.textSecondary },
  offlineBanner: { margin: 16, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.warning, backgroundColor: colors.warning + '20' },
  offlineText: { color: colors.warning, fontSize: 12 },
  error: { backgroundColor: colors.error + '20', padding: 10, borderRadius: 10, margin: 13, borderLeftWidth: 3, borderLeftColor: colors.error },
  errorText: { color: colors.error, fontSize: 14, fontWeight: '500' },
  emptyState: { flex: 1, alignItems: 'stretch', justifyContent: 'flex-start', paddingHorizontal: 16, paddingTop: 32, paddingBottom: 40, gap: 24 },
  emptyStatePrivate: { alignItems: 'center', justifyContent: 'center', paddingTop: 0, paddingBottom: 40, gap: 12 },
  emptyStateIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 19 },
  emptyStateIconText: { fontSize: 26 },
  emptyStateTitle: { fontSize: 21, fontWeight: '700', color: colors.text, marginBottom: 6, textAlign: 'center' },
  emptyStateSubtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
