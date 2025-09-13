import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatHeader } from '../components/chat/ChatHeader';
import { MessageBubble } from '../components/chat/MessageBubble';
import { DividerChip } from '../components/chat/DividerChip';
import { Composer } from '../components/chat/Composer';

import { useTheme } from '../context/ThemeContext';
import { getColors, getGradients } from '../styles/colors';
import { getFontFamily } from '../styles/fonts';

const SAMPLE = [
  {
    id: 'u1',
    role: 'user',
    text: 'What are the best places to visit in Japan for a 10-day trip?',
    time: '10:42 AM',
  },
  {
    id: 'a1',
    role: 'assistant',
    text:
      "For a 10-day trip to Japan, I'd recommend a classic route focusing on Tokyo, Kyoto, and a day trip. Here's a possible itinerary:\n\n• Tokyo (4 days): Explore Shinjuku, Shibuya, Harajuku, and Akihabara.\n• Kyoto (4 days): Visit Fushimi Inari, Kinkaku-ji, Arashiyama Bamboo Grove, and Gion.\n• Day Trip (1 day): Choose between Nara to see the deer or Hakone for views of Mt. Fuji.\n\nThis gives you a great mix of modern city life and traditional culture.",
    time: '10:43 AM',
  },
  {
    id: 'u2',
    role: 'user',
    text: 'Sounds great! What about food recommendations?',
    time: '10:45 AM',
  },
  { id: 'd1', type: 'divider', text: 'Secret Chat Started' },
  {
    id: 'a2',
    role: 'assistant',
    encrypted: true,
    text:
      'Of course! For an authentic experience: try sushi at Tsukiji Outer Market in Tokyo, ramen in Ichiran (a popular chain), and kaiseki (traditional multi-course meal) in Kyoto.',
    time: '10:46 AM',
  },
];

export const ConversationScreen = ({
  onMenuPress,
  onShieldPress,
  modelName = 'GPT-4',
}) => {
  const { isDarkMode } = useTheme();
  const colors = getColors(isDarkMode);
  const gradients = getGradients(isDarkMode);
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState(SAMPLE);
  const listRef = useRef(null);

  const bgGradient = gradients.background || [colors.gradientStart, colors.gradientEnd];

  const data = useMemo(() => messages, [messages]);

  const handleSend = (text) => {
    if (!text?.trim()) return;
    const now = new Date();
    const t = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [
      ...prev,
      { id: String(Math.random()), role: 'user', text, time: t },
    ]);
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  };

  const renderItem = ({ item }) => {
    if (item.type === 'divider') {
      return <DividerChip text={item.text} />;
    }
    return (
      <MessageBubble
        role={item.role}
        text={item.text}
        time={item.time}
        encrypted={item.encrypted}
      />
    );
  };

  return (
    <LinearGradient colors={bgGradient} style={styles.container}>
      <ChatHeader
        title="AI Assistant"
        subtitle={`Using ${modelName}`}
        onMenuPress={onMenuPress}
        onShieldPress={onShieldPress}
      />

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.select({ ios: 12, android: 0 })}
      >
        <FlatList
          ref={listRef}
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{
            paddingTop: 12,
            paddingHorizontal: 16,
            paddingBottom: 100 + insets.bottom,
          }}
          showsVerticalScrollIndicator={false}
        />

        <Composer
          onSend={handleSend}
          bottomInset={insets.bottom}
          gradient={[colors.primary, colors.accent]}
          inputBg={isDarkMode ? colors.secondary : colors.tertiary}
          barBorderColor={isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
        />
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  kav: { flex: 1 },
});
