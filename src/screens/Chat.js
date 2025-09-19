// app/src/screens/Chat.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, AppState, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useThreadsStore } from '../state/useThreadsStore';
import { useSettingsStore } from '../state/useSettingsStore';
import { newUserMessage, newAssistantMessage } from '../state/types';
import { streamChat } from '../api/streamChat';
import { generateImage } from '../api/generateImage';
import { ensureDeviceId } from '../lib/deviceId';
import { mapProxyError } from '../lib/errors';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import MessageList from '../components/chat/MessageList';
import Composer from '../components/chat/Composer';
import { colors } from '../styles/colors';


export default function Chat({ navigation }) {
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

    // Build payload for API (limit to last 20 messages to avoid payload too large)
    const recentMessages = (activeThread?.messages || []).slice(-20);
    const baseMessages = [...recentMessages, u, a];
    
    // Debug: Log payload size and check for large messages
    const payloadSize = JSON.stringify(baseMessages).length;
    const largeMessages = baseMessages.filter(m => m.content && m.content.length > 1000);
    console.log('Payload size:', payloadSize, 'bytes, Messages:', baseMessages.length);
    if (largeMessages.length > 0) {
      console.log('Large messages found:', largeMessages.map(m => ({ id: m.id, size: m.content.length })));
    }

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

  async function onCreateImagesPress() {
    const text = (input || '').trim();
    if (!text) return;
    setError('');
    setStreaming(true);

    const deviceId = await ensureDeviceId();
    const u = newUserMessage(text);
    const a = newAssistantMessage(); // will hold the image markdown
    if (isPrivate) { 
      addPrivateMessage(u); 
      addPrivateMessage(a); 
    } else { 
      addMessage(activeThread.id, u); 
      addMessage(activeThread.id, a); 
    }

    const controller = new AbortController();
    abortRef.current = controller;

    generateImage({
      prompt: text,
      deviceId,
      size: '1024x1024',
      signal: controller.signal,
      onImage: (url) => {
        // simple: embed markdown so your Markdown renderer shows it nicely
        const md = `![generated image](${url})`;
        if (isPrivate) updateLastAssistantContentPrivate(() => md);
        else updateLastAssistantContent(activeThread.id, () => md);
      },
      onDone: () => { 
        setStreaming(false); 
        abortRef.current = null; 
        setInput(''); 
      },
      onError: (err) => {
        setStreaming(false); 
        abortRef.current = null;
        setError('Image generation failed');
        console.log(err);
      },
    });
  }

  async function onOpenCameraPress() {
    // 1) acquire image (picker/camera) => get base64 or upload to URL
    const options = {
      mediaType: 'photo',
      includeBase64: true,
      maxHeight: 2000,
      maxWidth: 2000,
    };

    launchImageLibrary(options, (response) => {
      if (response.didCancel || response.error) {
        return;
      }

      const asset = response.assets?.[0];
      if (!asset) return;

      const base64 = asset.base64;
      const url = `data:${asset.type};base64,${base64}`;
      const text = input.trim();

      // 2) Display: show the user's message with the image markdown
      const displayMd = `${url ? `![photo](${url})\n\n` : ''}${text}`;
      const u = newUserMessage(displayMd);
      const a = newAssistantMessage();

      if (isPrivate) { 
        addPrivateMessage(u); 
        addPrivateMessage(a); 
      } else { 
        addMessage(activeThread.id, u); 
        addMessage(activeThread.id, a); 
      }

      // 3) Build a model-ready message with parts
      const mUser = {
        role: 'user',
        content: [
          ...(text ? [{ type: 'text', text }] : []),
          ...(url ? [{ type: 'image_url', image_url: { url } }] : []),
        ],
      };

      const recent = (activeThread?.messages || []).slice(-20)
        // rebuild role/content for the rest of the history as plain text
        .map(m => ({ role: m.role, content: m.content || '' }));

      setInput('');
      setStreaming(true);

      const deviceId = ensureDeviceId();
      const controller = new AbortController();
      abortRef.current = controller;

      streamChat({
        model: 'gpt-4o', // Use vision-capable model
        messages: [...recent, mUser],   // <— include the parts message here
        deviceId,
        temperature,
        signal: controller.signal,
        secretMode: isPrivate,
        onToken: (chunk) => {
          if (typeof chunk !== 'string') return;
          if (isPrivate) updateLastAssistantContentPrivate(prev => prev + chunk);
          else updateLastAssistantContent(activeThread.id, prev => prev + chunk);
        },
        onDone: () => { setStreaming(false); abortRef.current = null; },
        onError: (err) => { setStreaming(false); abortRef.current = null; setError(mapProxyError(err).message); },
      });
    });
  }

  function onStop() {
    console.log('Stop button pressed, abortRef.current:', abortRef.current);
    if (abortRef.current) { 
      abortRef.current.abort(); 
      abortRef.current = null; 
      setStreaming(false);
      console.log('Streaming stopped');
    } else {
      console.log('No abort controller found');
    }
  }

  function onRetry() {
    if (!activeThread) return;
    const lastUser = [...(activeThread.messages || [])].reverse().find(m => m.role === 'user');
    if (!lastUser) return;
    setInput(lastUser.content);
  }

  function onRetryFromHere(message) { setInput(message.content || ''); }

  function onInsertImagesMarkdown(md) {
    console.log('💬 [CHAT] onInsertImagesMarkdown called with markdown:', md);
    console.log('💬 [CHAT] Current state:', { isPrivate, activeThreadId: activeThread?.id });
    
    const a = newAssistantMessage(md);
    console.log('💬 [CHAT] Created assistant message:', a);
    
    if (isPrivate) {
      console.log('💬 [CHAT] Adding to private messages');
      addPrivateMessage(a);
    } else if (activeThread?.id) {
      console.log('💬 [CHAT] Adding to thread:', activeThread.id);
      addMessage(activeThread.id, a);
    } else {
      console.log('💬 [CHAT] No valid target for message insertion');
    }
  }

  if (!activeThread) {
    return <View style={styles.container}><Text>Loading…</Text></View>;
  }

  const modelDisplayName = models?.[model]?.display?.name || model;
  const currentTemp = getEffectiveTemp(model);

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={{ flex: 1 }}>
      {isPrivate && (
        <View style={styles.privateBanner}>
          <Text style={styles.privateBannerText}>Private chat • not in History • removed on exit</Text>
        </View>
      )}

      {/* File Upload Banner */}
      {/* <View style={styles.fileUploadBanner}>
        <View style={styles.fileUploadContent}>
          <View style={styles.fileUploadLeft}>
            <Text style={styles.fileUploadIcon}>📎</Text>
            <View>
              <Text style={styles.fileUploadTitle}>Upload and analyze</Text>
              <Text style={styles.fileUploadSubtitle}>Files</Text>
            </View>
            <Text style={styles.fileUploadFolderIcon}>📁</Text>
          </View>
          <TouchableOpacity style={styles.fileUploadButton}>
            <Text style={styles.fileUploadButtonText}>Try →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.fileUploadClose}>
            <Text style={styles.fileUploadCloseText}>×</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.fileUploadDots}>
          <View style={styles.fileUploadDot} />
          <View style={styles.fileUploadDot} />
          <View style={styles.fileUploadDot} />
          <View style={styles.fileUploadDot} />
          <View style={styles.fileUploadDot} />
        </View>
      </View> */}

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

      {/* Empty State */}
      {(!activeThread?.messages || activeThread.messages.length === 0) && (
        <View style={styles.emptyState}>
          <View style={styles.emptyStateIcon}>
            <Text style={styles.emptyStateIconText}>💬</Text>
          </View>
          <Text style={styles.emptyStateTitle}>
            {isPrivate ? 'Private Chat' : 'AI Chat'}
          </Text>
          <Text style={styles.emptyStateSubtitle}>
            {isPrivate 
              ? 'This chat will not appear in your chat history'
              : 'Start a conversation with AI'
            }
          </Text>
        </View>
      )}

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
        onCreateImagesPress={() => {
          console.log('💬 [CHAT] onCreateImagesPress called');
          console.log('💬 [CHAT] Navigating to ImagesStudio with:', { 
            seedPrompt: input,
            hasOnInsertToChat: !!onInsertImagesMarkdown 
          });
          navigation.navigate('ImagesStudio', { 
            seedPrompt: input,
            onInsertToChat: onInsertImagesMarkdown 
          });
        }}
        onOpenCameraPress={onOpenCameraPress}
        streaming={streaming}
        offline={offline}
      />
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor: colors.background },
  privateBanner:{ 
    marginHorizontal:13, 
    marginTop:6, 
    padding:6, 
    borderRadius:6, 
    backgroundColor: colors.privateBackground, 
    borderWidth:1, 
    borderColor: colors.privateBorder 
  },
  privateBannerText:{ fontSize:11, color: colors.privateText },
  error:{ 
    backgroundColor: colors.error + '20', 
    padding:10, 
    borderRadius:10, 
    margin:13, 
    borderLeftWidth:3, 
    borderLeftColor: colors.error 
  },
  fileUploadBanner: {
    marginHorizontal: 13,
    marginTop: 6,
    backgroundColor: '#10B981',
    borderRadius: 10,
    padding: 13,
    position: 'relative',
  },
  fileUploadContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fileUploadLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fileUploadIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  fileUploadTitle: {
    fontSize: 12,
    color: '#065F46',
    fontWeight: '500',
  },
  fileUploadSubtitle: {
    fontSize: 15,
    color: '#065F46',
    fontWeight: '700',
  },
  fileUploadFolderIcon: {
    fontSize: 16,
    marginLeft: 6,
  },
  fileUploadButton: {
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  fileUploadButtonText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '600',
  },
  fileUploadClose: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileUploadCloseText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: 'bold',
  },
  fileUploadDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 6,
    gap: 3,
  },
  fileUploadDot: {
    width: 5,
    height: 5,
    borderRadius: 2,
    backgroundColor: colors.surface + '60',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
    paddingVertical: 51,
  },
  emptyStateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 19,
  },
  emptyStateIconText: {
    fontSize: 26,
  },
  emptyStateTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
