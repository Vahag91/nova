// app/src/screens/Chat.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, AppState, TouchableOpacity } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useThreadsStore } from '../state/useThreadsStore';
import { useSettingsStore } from '../state/useSettingsStore';
import { newUserMessage, newAssistantMessage } from '../state/types';
import { streamChat } from '../api/streamChat';
import { ensureDeviceId } from '../lib/deviceId';
import { mapProxyError } from '../lib/errors';
import MessageList from '../components/chat/MessageList';
import Composer from '../components/chat/Composer';
import { colors } from '../styles/colors';

export default function Chat() {
  // normal store
  const threads = useThreadsStore(s => s.threads);
  const activeThreadId = useThreadsStore(s => s.activeThreadId);
  const createThread = useThreadsStore(s => s.createThread);
  const setActiveThread = useThreadsStore(s => s.setActiveThread);
  const addMessage = useThreadsStore(s => s.addMessage);
  const updateLastAssistantContent = useThreadsStore(s => s.updateLastAssistantContent);

  // private store
  const isPrivate = useThreadsStore(s => s.privateActive);
  const privateThread = useThreadsStore(s => s.privateThread);
  const startPrivate = useThreadsStore(s => s.startPrivate);
  const endPrivate = useThreadsStore(s => s.endPrivate);
  const addPrivateMessage = useThreadsStore(s => s.addPrivateMessage);
  const updateLastAssistantContentPrivate = useThreadsStore(s => s.updateLastAssistantContentPrivate);

  // settings
  const model = useSettingsStore(s => s.model);
  const models = useSettingsStore(s => s.models);
  const getEffectiveTemp = useSettingsStore(s => s.getEffectiveTemp);
  const temperature = getEffectiveTemp(model);

  // ensure at least one normal thread
  useEffect(() => {
    if (!isPrivate && !threads.length) {
      const t = createThread({ title: 'New chat', model });
      setActiveThread(t.id);
    }
  }, [threads.length, isPrivate]);

  const normalActive = useMemo(
    () => threads.find(t => t.id === activeThreadId) || null,
    [threads, activeThreadId]
  );

  // pick active thread based on mode
  const activeThread = isPrivate ? privateThread : normalActive;

  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [offline, setOffline] = useState(false);
  const abortRef = useRef(null);

  // network
  useEffect(() => {
    const sub = NetInfo.addEventListener(s =>
      setOffline(!(s.isConnected && s.isInternetReachable)));
    return () => sub && sub();
  }, []);

  // abort on background
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      if (s !== 'active' && abortRef.current) {
        abortRef.current.abort();
        setStreaming(false);
      }
    });
    return () => sub.remove();
  }, []);

  // cleanup private on unmount
  useEffect(() => {
    return () => { if (useThreadsStore.getState().privateActive) endPrivate(); };
  }, []);

  async function onSend() {
    setError('');
    const text = input.trim();
    if (!text || !activeThread) return;

    const MAX_CHARS = 16000;
    if (text.length > MAX_CHARS) { setError(`Message too long (${text.length}). Limit is ${MAX_CHARS}.`); return; }

    const u = newUserMessage(text);
    const a = newAssistantMessage();

    // Update UI state first
    if (isPrivate) {
      addPrivateMessage(u);
      addPrivateMessage(a);
    } else {
      addMessage(activeThread.id, u);
      addMessage(activeThread.id, a);
    }

    // Build payload for API (include the assistant message for proper context)
    const baseMessages = [...(activeThread?.messages || []), u, a];

    setInput('');
    setStreaming(true);

    const deviceId = await ensureDeviceId();
    const controller = new AbortController();
    abortRef.current = controller;

    streamChat({
      model,
      messages: baseMessages.filter(m => m.type === 'text'),
      deviceId,
      temperature,
      signal: controller.signal,
      secretMode: isPrivate,
      onToken: (chunk) => {
        if (typeof chunk !== 'string') return;
        if (isPrivate) {
          updateLastAssistantContentPrivate(prev => prev + chunk);
        } else {
          updateLastAssistantContent(activeThread.id, prev => prev + chunk);
        }
      },
      onDone: () => { setStreaming(false); abortRef.current = null; },
      onError: (err) => {
        setStreaming(false); abortRef.current = null;
        if (err?.code === 'RATE_LIMIT' && typeof err?.retryAfter === 'number') {
          setError(`Rate limited. Try again in ~${Math.ceil(err.retryAfter)}s.`);
        } else {
          const pretty = mapProxyError(err);
          setError(pretty.message);
        }
      },
    });
  }

  function onStop() {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; setStreaming(false); }
  }

  function onRetry() {
    if (!activeThread) return;
    const lastUser = [...(activeThread.messages || [])].reverse().find(m => m.role === 'user');
    if (!lastUser) return;
    setInput(lastUser.content);
  }

  function onRetryFromHere(message) { setInput(message.content || ''); }


  if (!activeThread) {
    return <View style={styles.container}><Text>Loading…</Text></View>;
  }

  const modelDisplayName = models?.[model]?.display?.name || model;
  const currentTemp = getEffectiveTemp(model);

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.header}>AI Chat</Text>
        <View style={styles.modelPill}>
          <Text style={styles.modelPillText}>{modelDisplayName}</Text>
        </View>
      </View>

      <View style={styles.headerSubtext}>
        <Text style={styles.headerSubtextText}>
          Model: {model} · Temp: {currentTemp.toFixed(2)}
        </Text>
      </View>

      {isPrivate && (
        <View style={styles.privateBanner}>
          <Text style={styles.privateBannerText}>Private chat • not in History • removed on exit</Text>
        </View>
      )}

      {offline && (
        <View style={{margin:16,padding:10,borderRadius:8,backgroundColor: colors.warning + '20',borderWidth:1,borderColor: colors.warning}}>
          <Text style={{color: colors.warning,fontSize:12}}>You're offline. Messages can't be sent.</Text>
        </View>
      )}

      {!!error && (
        <View style={styles.error}>
          <Text style={{color: colors.error, fontSize: 14, fontWeight: '500'}}>{error}</Text>
        </View>
      )}

      {/* Optional preset banner */}
      {(() => {
        const systemMsg = (activeThread.messages || []).find(m => m.role === 'system');
        return systemMsg && (
          <View style={{marginHorizontal:16, marginTop:8, marginBottom:4, padding:8, borderRadius:10, backgroundColor: colors.primary + '20', borderWidth:1, borderColor: colors.primary}}>
            <Text style={{fontSize:12, color: colors.primary, fontWeight:'700'}}>
              Preset: {activeThread.title || 'Assistant'}
            </Text>
            {!!activeThread.model && (
              <Text style={{fontSize:12, color: colors.primary, marginTop:2}}>
                Model: {activeThread.model}
              </Text>
            )}
          </View>
        );
      })()}

      <MessageList
        messages={(activeThread.messages || []).filter(m => m.role !== 'system')}
        streaming={streaming}
        onRetryFromHere={onRetryFromHere}
      />

      <Composer
        value={input}
        onChange={setInput}
        onSend={onSend}
        onStop={onStop}
        onRetry={onRetry}
        streaming={streaming}
        offline={offline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor: colors.background },
  headerContainer:{ 
    flexDirection:'row', 
    alignItems:'center', 
    justifyContent:'space-between',
    paddingHorizontal:16, 
    paddingTop:16, 
    paddingBottom:8, 
    backgroundColor: colors.headerBackground,
    borderBottomWidth:1, 
    borderBottomColor: colors.headerBorder 
  },
  header:{ fontSize:24, fontWeight:'700', color: colors.text },
  modelPill:{ 
    backgroundColor: colors.surface, 
    paddingHorizontal:8, 
    paddingVertical:4, 
    borderRadius:12, 
    borderWidth:1, 
    borderColor: colors.border 
  },
  modelPillText:{ fontSize:12, fontWeight:'600', color: colors.textSecondary },
  privBtn:{ 
    backgroundColor: colors.surface, 
    paddingHorizontal:10, 
    paddingVertical:6, 
    borderRadius:12, 
    borderWidth:1, 
    borderColor: colors.border 
  },
  privBtnText:{ fontSize:12, fontWeight:'600', color: colors.textSecondary },
  headerSubtext:{ 
    paddingHorizontal:16, 
    paddingBottom:8, 
    backgroundColor: colors.headerBackground, 
    borderBottomWidth:1, 
    borderBottomColor: colors.headerBorder 
  },
  headerSubtextText:{ fontSize:12, color: colors.textMuted, fontWeight:'500' },
  privateBanner:{ 
    marginHorizontal:16, 
    marginTop:8, 
    padding:8, 
    borderRadius:8, 
    backgroundColor: colors.privateBackground, 
    borderWidth:1, 
    borderColor: colors.privateBorder 
  },
  privateBannerText:{ fontSize:12, color: colors.privateText },
  error:{ 
    backgroundColor: colors.error + '20', 
    padding:12, 
    borderRadius:12, 
    margin:16, 
    borderLeftWidth:4, 
    borderLeftColor: colors.error 
  },
});
