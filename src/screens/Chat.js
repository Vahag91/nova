// app/src/screens/Chat.jsx
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
import { colors } from '../styles/colors';
import { appendStream, getStream, clearStream } from '../lib/streamingBuffer';
import { ensureSummaryIfNeeded } from '../lib/summaryBuilder';
import { buildPayload } from '../lib/payloadBuilder';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { useTranslation } from 'react-i18next';

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
  const model = useSettingsStore(s => s.model);
  const getEffectiveTemp = useSettingsStore(s => s.getEffectiveTemp);
  const temperature = getEffectiveTemp(model);
console.log('model', model);
  // Local
  const messageListRef = useRef(null);
  const didInitialScrollRef = useRef(false);

  const normalActive = useMemo(() =>
    threads.find(t => t.id === activeThreadId) || null,
    [threads, activeThreadId]
  );
  const activeThread = isPrivate ? privateThread : normalActive;

  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [error, setError] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [offline, setOffline] = useState(false);
  const [streamingMsgId, setStreamingMsgId] = useState(null);
  const [forceCollapseInput, setForceCollapseInput] = useState(false);
  const [showVoiceOverlay, setShowVoiceOverlay] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const abortRef = useRef(null);

  const messagesNoSystem = useMemo(
    () => (activeThread?.messages || []).filter(m => m.role !== 'system'),
    [activeThread?.messages]
  );

  // Voice: manual stop => send once

  const onFinalText = useCallback((text) => {
    const t = (text || '').trim();
    if (!t) return;
    setVoiceText(t);
  }, []);

  const onPartialText = useCallback((text) => {
    setVoiceText(text || '');
  }, []);
  
  const onErrorText = useCallback((msg) => {
    setError(msg);
  }, []);
  
  const { isRecording, start: startVoice, stop: stopVoice } = useVoiceInput({
    onPartialText,
    onFinalText,
    onErrorText,
    // locale: 'en-US'
  });

  // Hydrate & ensure thread
  useEffect(() => { if (!hydrated) hydrate(); }, [hydrated, hydrate]);
  useEffect(() => {
    if (hydrated && !isPrivate && !threads.length) {
      const th = createThread({ title: t('history.newChat'), model });
      setActiveThread(th.id);
    }
  }, [hydrated, threads.length, isPrivate, createThread, setActiveThread, model]);

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
  const nudgeToBottom = useCallback(() => requestAnimationFrame(() => messageListRef.current?.scrollToBottom(true)), []);

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

  // Network
  useEffect(() => {
    const sub = NetInfo.addEventListener(s =>
      setOffline(!(s.isConnected && s.isInternetReachable))
    );
    return () => sub && sub();
  }, []);

  // App background: stop stream + voice
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      if (s !== 'active' && abortRef.current) {
        abortRef.current.abort(); abortRef.current = null; setStreaming(false);
      }
      if (s !== 'active' && isRecording) {
        stopVoice();
      }
    });
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
      const t = setTimeout(() => setForceCollapseInput(false), 200);
      return () => clearTimeout(t);
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
  const onOpenCameraPress = useCallback(() => {
    launchImageLibrary(
      { mediaType: 'photo', includeBase64: true, selectionLimit: 2, maxWidth: 500, maxHeight: 500, quality: 0.52 },
      (response) => {
        if (response?.didCancel) return;
        if (response?.errorCode || response?.errorMessage) {
          Alert.alert(t('chat.imagePickerErrorTitle'), response?.errorMessage || response?.errorCode);
          return;
        }
        addPickedAssets(response?.assets || []);
      }
    );
  }, []);
  const onRemoveAttachment = useCallback((att) => {
    setAttachments(prev => prev.filter(a => a.id !== att.id));
  }, []);

  // ==== Send flow ====
  async function onSend(overrideText) {
    setError('');
    const textRaw = typeof overrideText === 'string' ? overrideText : input;
    const text = (textRaw || '').trim();
    const hasText = !!text;
    const hasImages = attachments.length > 0;
    if (!hasText && !hasImages) return;
    if (!activeThread) return;

    const MAX_CHARS = 16000;
    if (text.length > MAX_CHARS) {
      setError(t('chat.messageTooLong', { length: text.length, limit: MAX_CHARS }));
      return;
    }

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

    const a = newAssistantMessage(); const assistantId = a.id;

    if (isPrivate) { addPrivateMessage(u); addPrivateMessage(a); }
    else { addMessage(activeThread.id, u); addMessage(activeThread.id, a); }
    setStreamingMsgId(assistantId);
    requestAnimationFrame(() => messageListRef.current?.scrollToBottom(true));

    // reset composer
    setInput(''); setAttachments([]); setForceCollapseInput(true);

    const threadForContext = { ...activeThread, messages: [ ...(activeThread.messages || []), mUser ] };
    await ensureSummaryIfNeeded(threadForContext, isPrivate ? undefined : setThreadSummary);
    const payload = buildPayload({ thread: threadForContext, newMsg: mUser, tokenCap: 6000 });
    const modelForThisSend = model;

    setStreaming(true);
    const deviceId = await ensureDeviceId();
    const controller = new AbortController(); abortRef.current = controller;

    streamChat({
      model: modelForThisSend,
      messages: payload,
      deviceId,
      temperature,
      signal: controller.signal,
      onToken: (chunk) => { if (typeof chunk === 'string') appendStream(assistantId, chunk); },
      onDone: () => {
        setStreaming(false); abortRef.current = null;
        const full = getStream(assistantId);
        if (isPrivate) updateLastAssistantContentPrivate(() => full);
        else updateLastAssistantContent(activeThread.id, () => full);
        clearStream(assistantId); setStreamingMsgId(null);
        if (!isPrivate) forceSaveThread(activeThread.id);
      },
      onError: (err) => {
        setStreaming(false); abortRef.current = null;
        clearStream(assistantId); setStreamingMsgId(null);
        const pretty = mapProxyError(err); setError(pretty.message);
      },
    });
  }

  function onStop() {
    if (abortRef.current) {
      abortRef.current.abort(); abortRef.current = null; setStreaming(false);
      if (streamingMsgId) clearStream(streamingMsgId); setStreamingMsgId(null);
    }
    if (isRecording) {
      stopVoice();
    }
  }
  function onRetryFromHere(message) { setInput(message?.content || ''); }
  function onInsertImagesMarkdown(md) {
    const a = newAssistantMessage(md);
    if (isPrivate) addPrivateMessage(a);
    else if (activeThread?.id) addMessage(activeThread.id, a);
    requestAnimationFrame(() => messageListRef.current?.scrollToBottom(true));
  }

  if (!activeThread) return <View style={styles.container}><Text>{t('chat.loading')}</Text></View>;
  if (!hydrated) {
    return (
      <View style={styles.container}>
        <View style={styles.header}><Text style={styles.headerTitle}>{t('chat.loading')}</Text></View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: colors.textSecondary }}>{t('chat.loadingChat')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={{ flex: 1 }}>
          {offline && (
            <View style={{margin:16,padding:10,borderRadius:8,backgroundColor: colors.warning + '20',borderWidth:1,borderColor: colors.warning}}>
              <Text style={{color: colors.warning,fontSize:12}}>{t('chat.offlineBanner')}</Text>
            </View>
          )}

          {!!error && (
            <View style={styles.error}>
              <Text style={{color: colors.error, fontSize: 14, fontWeight: '500'}}>{error}</Text>
            </View>
          )}

          {(!activeThread?.messages || activeThread.messages.length === 0) ? (
            <Reanimated.View style={[{ flex: 1 }, animatedContentStyle]}>
              <View style={styles.emptyState}>
                <View style={styles.emptyStateIcon}><Text style={styles.emptyStateIconText}>💬</Text></View>
                <Text style={styles.emptyStateTitle}>{isPrivate ? t('chat.privateTitle') : t('chat.emptyTitle')}</Text>
                <Text style={styles.emptyStateSubtitle}>{isPrivate ? t('chat.privateSubtitle') : t('chat.emptySubtitle')}</Text>
                {!isPrivate && <SuggestionCards onSuggestionPress={(s) => setInput(s.title)} />}
              </View>
            </Reanimated.View>
          ) : (
            <Reanimated.View style={[{ flex: 1 }, animatedContentStyle]}>
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
            <TestInput
              value={input}
              onChange={setInput}
              onSend={onSend}
              onStop={onStop}
              onCreateImagesPress={() => { setInsertToChatCallback(onInsertImagesMarkdown); navigation.navigate('ImagesStudio', { seedPrompt: input }); }}
              onOpenCameraPress={onOpenCameraPress}
              onClipboardPress={() => {}}
              onMicPress={() => {
                if (isRecording) {
                  stopVoice();
                  setShowVoiceOverlay(false);
                } else {
                  setInput('');
                  startVoice();
                  setShowVoiceOverlay(true);
                  setVoiceText('');
                }
              }}
              streaming={streaming}
              offline={offline}
              maxLength={16000}
              attachments={attachments}
              onRemoveAttachment={onRemoveAttachment}
              forceCollapsed={forceCollapseInput || isRecording}
              isRecording={isRecording}
            />
            <VoiceOverlay
              visible={showVoiceOverlay}
              isRecording={isRecording}
              transcript={voiceText}
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
  container:{ flex:1, backgroundColor: '#000000' },
  error:{ backgroundColor: colors.error + '20', padding:10, borderRadius:10, margin:13, borderLeftWidth:3, borderLeftColor: colors.error },
  emptyState:{ flex:1, alignItems:'center', justifyContent:'center', paddingHorizontal:16, paddingVertical:40 },
  emptyStateIcon:{ width:64, height:64, borderRadius:32, backgroundColor: colors.surface, alignItems:'center', justifyContent:'center', marginBottom:19 },
  emptyStateIconText:{ fontSize:26 },
  emptyStateTitle:{ fontSize:21, fontWeight:'700', color: colors.text, marginBottom:6, textAlign:'center' },
  emptyStateSubtitle:{ fontSize:14, color: colors.textSecondary, textAlign:'center', lineHeight:20 },
});
