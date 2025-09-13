import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Header } from '../components/Header.jsx';
import { GlassBottomNav } from '../components/GlassBottomNav.jsx';
import { AIModelCard } from '../components/AIModelCard.jsx';
import { GradientText } from '../components/GradientText.jsx';
import { AI_MODELS } from '../data/models';
import { useTheme } from '../context/ThemeContext';
import { getColors, getGradients, hexToRgba } from '../styles/colors';
import { getFontFamily } from '../styles/fonts';

// Using the hexToRgba utility from colors.js

export const HomeScreen = ({ onModelSelect, onSettingsPress, onTabPress, activeTab }) => {
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useTheme();
  const colors = getColors(isDarkMode);
  const gradients = getGradients(isDarkMode);


  // Use either gradients.background (array) OR colors.gradientStart/End
  const bgGradient = gradients.background || [colors.gradientStart, colors.gradientEnd];

  const models = Array.isArray(AI_MODELS) ? AI_MODELS : [];

  return (
    <LinearGradient colors={bgGradient} style={styles.container}>
      <Header title="Chat" onSettingsPress={onSettingsPress} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome */}
        <View style={styles.welcome}>
          <View style={styles.badgeWrap}>
            <View
              style={[
                styles.glow,
                {
                  backgroundColor: hexToRgba(colors.primary, 0.2),
                  shadowColor: colors.primary,
                },
              ]}
            />
            <View style={[styles.badge, { backgroundColor: colors.tertiary }]}>
              <Icon name="auto_awesome" size={48} color={colors.primary} />
            </View>
          </View>

          <GradientText colors={[colors.primary, colors.accent]} style={styles.h1}>
            Welcome to Pokely
          </GradientText>

          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            Explore the power of AI with our diverse range of models, each designed to enhance your chatting experience.
          </Text>
        </View>

        {/* Models */}
        <View style={styles.modelsSection}>
          <Text style={[styles.h3, { color: colors.textPrimary }]}>Choose your AI model</Text>
          <View style={styles.modelsList}>
            {models.map(m => (
              <AIModelCard key={m.id} model={m} onPress={onModelSelect} />
            ))}
          </View>
        </View>
      </ScrollView>

      <GlassBottomNav activeTab={activeTab} onTabPress={onTabPress} />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16 },
  welcome: { alignItems: 'center', paddingTop: 32, paddingBottom: 24 },
  badgeWrap: { position: 'relative', marginBottom: 16 },
  glow: {
    position: 'absolute',
    top: -10, left: -10, right: -10, bottom: -10,
    borderRadius: 999,
    opacity: 0.5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  badge: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  h1: {
    fontSize: 34, fontFamily: getFontFamily('bold'), textAlign: 'center',
    letterSpacing: -0.5, marginBottom: 10,
  },
  sub: { fontSize: 16, fontFamily: getFontFamily('regular'), textAlign: 'center', lineHeight: 24, maxWidth: 320 },
  modelsSection: { paddingTop: 16 },
  h3: { fontSize: 20, fontFamily: getFontFamily('bold'), marginBottom: 16 },
  modelsList: { gap: 12 }, // if your RN version doesn't support gap, replace with a manual spacer
});


