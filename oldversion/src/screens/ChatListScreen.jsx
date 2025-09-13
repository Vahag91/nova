import React, { useMemo } from 'react';
import { View, SectionList, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassHeader } from '../components/GlassHeader.jsx';
import { GlassBottomNav } from '../components/GlassBottomNav.jsx';
import { ActionTileRow } from '../components/ActionTileRow.jsx';
import { SectionHeading } from '../components/SectionHeading.jsx';
import { ChatListItem } from '../components/ChatListItem.jsx';

import { useTheme } from '../context/ThemeContext';
import { getColors, getGradients } from '../styles/colors';

const DATA = [
  {
    title: 'Today',
    data: [
      {
        id: 's1',
        title: 'Project Phoenix Details',
        subtitle: 'End-to-end encrypted',
        time: '11:11 AM',
        icon: { name: 'encrypted', tint: 'secret' },
        badge: { name: 'lock', tint: 'secret' },
        encrypted: true,
      },
      {
        id: 't1',
        title: 'Trip to Japan',
        subtitle: 'What are the best places to visit in...',
        time: '10:42 AM',
        icon: { name: 'travel-explore', tint: 'indigo' },
      },
      {
        id: 'r1',
        title: 'Recipe Ideas',
        subtitle: 'I need a recipe for a vegan pasta dish...',
        time: '9:21 AM',
        icon: { name: 'restaurant-menu', tint: 'emerald' },
      },
    ],
  },
  {
    title: 'Yesterday',
    data: [
      {
        id: 'w1',
        title: 'Workout Plan',
        subtitle: 'Create a 30-day workout plan for...',
        time: '5:15 PM',
        icon: { name: 'fitness-center', tint: 'sky' },
      },
      {
        id: 'b1',
        title: 'Book Recommendations',
        subtitle: 'Can you recommend some sci-fi books?',
        time: '11:30 AM',
        icon: { name: 'auto-stories', tint: 'amber' },
      },
    ],
  },
];

export const ChatListScreen = ({ onNewChat, onSecretChat, onOpenChat, onTabPress, activeTab = 'chat' }) => {
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useTheme();
  const colors = getColors(isDarkMode);
  const gradients = getGradients(isDarkMode);

  const bgGradient = gradients.background || [colors.gradientStart, colors.gradientEnd];
  const sections = useMemo(() => DATA, []);

  return (
    <LinearGradient colors={bgGradient} style={styles.container}>
      <GlassHeader
        title="Chat"
        rightButton={{ icon: 'add', onPress: onNewChat }}
      />

      <View style={styles.contentPad}>
        <ActionTileRow onLeftPress={onNewChat} onRightPress={onSecretChat} />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80, paddingHorizontal: 16 }}
        ListHeaderComponent={<View style={{ height: 4 }} />}
        renderSectionHeader={({ section: { title } }) => <SectionHeading title={title} />}
        renderItem={({ item }) => (
          <ChatListItem item={item} onPress={() => onOpenChat?.(item)} />
        )}
      />

      <GlassBottomNav activeTab={activeTab} onTabPress={onTabPress} />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, position: 'relative' },
  contentPad: { paddingHorizontal: 16, paddingTop: 12, marginBottom: 4 },
});
