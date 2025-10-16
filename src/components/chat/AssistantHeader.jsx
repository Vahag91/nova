import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import SvgIcon from '../SvgIcon';
import { colors } from '../../styles/colors';
import { PRESETS } from '../../data/presets';

export default function AssistantHeader({ thread, showOnlyWhenEmpty = false }) {
  const fallbackCopy = {
    title: 'Assistant unavailable',
    description: 'We couldn’t load this assistant. Please try again.',
  };

  const iconGradients = [
    { from: '#6366F1', to: '#7C3AED' }, // indigo → purple
    { from: '#0EA5E9', to: '#06B6D4' }, // sky → cyan
    { from: '#10B981', to: '#16A34A' }, // emerald → green
    { from: '#F43F5E', to: '#DB2777' }, // rose → pink
    { from: '#F59E0B', to: '#EA580C' }, // amber → orange
  ];

  const defaultGradient = iconGradients[0];

  // Check if this thread has a system message (assistant thread)
  const systemMsg = thread?.messages?.find(m => m.role === 'system');
  if (!systemMsg) return null;

  // Find matching preset by system prompt
  const preset = PRESETS.find(p => p.system === systemMsg.content);
  if (!preset) {
    return (
      <View style={styles.wrapper}>
        <View style={styles.iconWrap}>
          <Svg width={80} height={80} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="assist_header_fallback" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={defaultGradient.from} />
                <Stop offset="1" stopColor={defaultGradient.to} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={80} height={80} rx={20} fill="url(#assist_header_fallback)" />
          </Svg>
          <View style={styles.iconContent}>
            <Text style={styles.iconEmoji}>🤖</Text>
          </View>
        </View>
        <Text style={styles.title}>{fallbackCopy.title}</Text>
        <Text style={styles.description}>{fallbackCopy.description}</Text>
      </View>
    );
  }

  // Count user/assistant messages (exclude system messages)
  const hasMessages = thread?.messages?.filter(m => m.role !== 'system').length > 0;
  
  // If showOnlyWhenEmpty is true, hide after first message
  if (showOnlyWhenEmpty && hasMessages) return null;

  // Use the same gradient system as Assistants screen
  // Find the preset index to get the same gradient
  const presetIndex = PRESETS.findIndex(p => p.id === preset.id);
  const gradient =
    iconGradients[(presetIndex >= 0 ? presetIndex : 0) % iconGradients.length] || defaultGradient;
  const gradientId = `assist_header_${preset.id}`;

  const titleText = preset.name || fallbackCopy.title;
  const descriptionText = preset.description || fallbackCopy.description;
  const iconEmoji = preset.emoji || '🤖';
  const iconName = preset.icon;

  return (
    <View style={styles.wrapper}>
      {/* Icon with gradient - exact same as Assistants screen */}
      <View style={styles.iconWrap}>
        <Svg width={80} height={80} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={gradient.from} />
              <Stop offset="1" stopColor={gradient.to} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={80} height={80} rx={20} fill={`url(#${gradientId})`} />
        </Svg>
        <View style={styles.iconContent}>
          {iconName ? (
            <SvgIcon name={iconName} size={32} color="#FFFFFF" />
          ) : (
            <Text style={styles.iconEmoji}>{iconEmoji}</Text>
          )}
        </View>
      </View>
      
      {/* Title */}
      <Text style={styles.title}>{titleText}</Text>
      
      {/* Description */}
      <Text style={styles.description}>{descriptionText}</Text>
      
      {/* Status indicator */}
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, { backgroundColor: gradient.from }]} />
        <Text style={styles.statusText}>Ready to assist</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
    shadowColor: 'rgba(99,102,241,0.6)',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  iconContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconEmoji: {
    fontSize: 32,
    color: '#FFFFFF',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: 'Lato-Bold',
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    fontFamily: 'Lato-Regular',
    paddingHorizontal: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontFamily: 'Lato-Regular',
    fontWeight: '500',
  },
});
