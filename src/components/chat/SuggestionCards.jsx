import { IMAGE_STUDIO_ENABLED } from '../../constants/featureFlags';
import { AccessibilityInfo, AppState, I18nManager, ScrollView, Text, StyleSheet } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';

import { useWorkspaceTranslation } from '../../i18n/useWorkspaceTranslation';
import { useSourceWorkspaceAvailability } from '../../state/useSourceWorkspaceAvailability';
import { graphite } from '../../styles/graphite';
import PressableScale from '../ui/PressableScale';

// Keep the row lightweight; scrolling runs in the native ScrollView.
const QUICK_ACTION_ICON_PATHS = Object.freeze({
  spark:
    'M12 2c.7 5.3 4.7 9.3 10 10-5.3.7-9.3 4.7-10 10-.7-5.3-4.7-9.3-10-10 5.3-.7 9.3-4.7 10-10Z',
});

const QuickActionIcon = memo(({ name, color }) => (
  <Svg width={15} height={15} viewBox="0 0 24 24" pointerEvents="none">
    <Path d={QUICK_ACTION_ICON_PATHS[name]} fill={color} />
  </Svg>
));

const SuggestionCards = ({
  onSuggestionPress,
  imagePickerActive = false,
}) => {
  const { t } = useTranslation();
  const { c } = useWorkspaceTranslation();
  const documentsEnabled = useSourceWorkspaceAvailability('document');
  const videosEnabled = useSourceWorkspaceAvailability('video');

  const items = useMemo(() => {
    const title = (key, fallback) => {
      const value = t(key, { defaultValue: fallback });
      return typeof value === 'string' ? value : fallback;
    };

    return [
      documentsEnabled && { id: 'documents', title: c('documents', 'Documents') },
      videosEnabled && { id: 'video-summaries', title: c('videos', 'Video summaries') },
      IMAGE_STUDIO_ENABLED && {
        id: 'create-images',
        title: title('chat.quickActions.createImages', 'Create Images'),
      },
      IMAGE_STUDIO_ENABLED && {
        id: 'edit-image',
        title: title('chat.quickActions.editImage', 'Edit Image'),
      },
      { id: 'open-camera', title: title('chat.camera', 'Camera') },
      { id: 'assistants', title: title('chat.quickActions.assistants', 'Assistants') },
    ].filter(Boolean);
  }, [c, documentsEnabled, t, videosEnabled]);

  const focused = useIsFocused();
  const scroll = useRef(null);
  const metrics = useRef({ width: 0, content: 0, x: 0, direction: 1, pauseUntil: 0 });
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [reduceMotion, setReduceMotion] = useState(true);
  const [screenReader, setScreenReader] = useState(true);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => mounted && setReduceMotion(value)).catch(() => {});
    AccessibilityInfo.isScreenReaderEnabled().then(value => mounted && setScreenReader(value)).catch(() => {});
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const reader = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    const app = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => { mounted = false; motion.remove(); reader.remove(); app.remove(); };
  }, []);
  useEffect(() => {
    if (!focused || !foreground || reduceMotion || screenReader || imagePickerActive || I18nManager.isRTL) return;
    const timer = setInterval(() => {
      const m = metrics.current;
      const end = Math.max(0, m.content - m.width);
      if (!end || Date.now() < m.pauseUntil) return;
      if (m.x >= end - 2) m.direction = -1;
      if (m.x <= 2) m.direction = 1;
      const x = Math.max(0, Math.min(end, m.x + m.direction * m.width * 0.65));
      scroll.current?.scrollTo({ x, animated: true });
    }, 4500);
    return () => clearInterval(timer);
  }, [focused, foreground, reduceMotion, screenReader, imagePickerActive]);
  const pauseRotation = () => { metrics.current.pauseUntil = Date.now() + 10000; };

  const handlePress = suggestion => {
    if (!suggestion) return;
    try {
      typeof onSuggestionPress === 'function' && onSuggestionPress(suggestion);
    } catch {}
  };

  return (
    <ScrollView
      ref={scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      onLayout={event => { metrics.current.width = event.nativeEvent.layout.width; }}
      onContentSizeChange={width => { metrics.current.content = width; }}
      onScroll={event => { metrics.current.x = event.nativeEvent.contentOffset.x; }}
      scrollEventThrottle={100}
      onTouchStart={pauseRotation}
      onScrollBeginDrag={pauseRotation}
      onScrollEndDrag={pauseRotation}
    >
      {items.map(suggestion => {
        const disabled = imagePickerActive && suggestion.id === 'open-camera';
        return (
          <PressableScale
            key={suggestion.id}
            style={[styles.chip, disabled && styles.chipDisabled]}
            onPress={() => handlePress(suggestion)}
            disabled={disabled}
            accessibilityRole="button"
          >
            <QuickActionIcon
              name={suggestion.icon || 'spark'}
              color={suggestion.icon ? graphite.text : graphite.accent}
            />
            <Text style={styles.chipLabel}>{suggestion.title}</Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: 3,
    gap: 8,
  },
  chip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingStart: 12,
    paddingEnd: 14,
    borderRadius: 22,
    backgroundColor: graphite.card,
  },
  chipLabel: {
    color: graphite.text,
    fontSize: 15,
    lineHeight: 20,
  },
  chipDisabled: {
    opacity: 0.5,
  },
});

export default memo(
  SuggestionCards,
  (prev, next) =>
    prev.imagePickerActive === next.imagePickerActive &&
    prev.onSuggestionPress === next.onSuggestionPress,
);
