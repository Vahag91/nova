/** Step 2 - up to three goals, used to frame the rest of the flow. */
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  I18nManager,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { CircleIconButton } from './primitives';
import { FONT, GOAL_ACCENT } from './theme';

/**
 * One goal card. Selection runs its own spring so the tick and lift respond to
 * the tap immediately, independently of the list's entrance stagger.
 */
function GoalRow({ goal, image, selected, theme, onToggle }) {
  const accent = GOAL_ACCENT[goal.accent];
  const press = useRef(new Animated.Value(1)).current;
  const tick = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const previousSelected = useRef(selected);

  useEffect(() => {
    if (previousSelected.current === selected) return undefined;
    previousSelected.current = selected;
    const animation = Animated.spring(tick, {
      toValue: selected ? 1 : 0,
      useNativeDriver: true,
      speed: 18,
      bounciness: selected ? 10 : 0,
    });
    animation.start();
    return () => animation.stop();
  }, [selected, tick]);

  const springPress = to =>
    Animated.spring(press, {
      toValue: to,
      useNativeDriver: true,
      speed: 28,
      bounciness: 6,
    }).start();

  return (
    <Animated.View style={{ transform: [{ scale: press }] }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        onPress={() => onToggle(goal.id)}
        onPressIn={() => springPress(0.985)}
        onPressOut={() => springPress(1)}
        style={[
          styles.goalRow,
          selected && styles.goalRowSelected,
          {
            backgroundColor: theme.cardSolid,
            borderColor: selected ? accent : theme.cardStroke,
            shadowOpacity: theme.shadowOpacity * 0.8,
          },
        ]}
      >
        {image ? (
          <Image
            fadeDuration={0}
            resizeMethod="resize"
            source={image}
            style={styles.goalImage}
          />
        ) : (
          <View
            style={[
              styles.goalImage,
              styles.goalImageFallback,
              { backgroundColor: `${accent}22` },
            ]}
          >
            <Text style={styles.goalEmoji}>{goal.emoji}</Text>
          </View>
        )}

        <View style={styles.goalCopy}>
          <Text
            style={[
              styles.goalTitle,
              { color: selected ? accent : theme.primaryText },
            ]}
          >
            {goal.title}
          </Text>
          <Text style={[styles.goalSubtitle, { color: theme.secondaryText }]}>
            {goal.subtitle}
          </Text>
        </View>

        <View
          style={[
            styles.radio,
            { borderColor: selected ? accent : theme.progressInactive },
            selected && { backgroundColor: accent, borderColor: accent },
          ]}
        >
          <Animated.Text
            style={[
              styles.radioTick,
              { opacity: tick, transform: [{ scale: tick }] },
            ]}
          >
            ✓
          </Animated.Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function GoalSelectionView({
  content,
  goalImages,
  onBack,
  onToggle,
  selected,
  theme,
}) {
  const c = content.goals;

  return (
    <View style={styles.screen}>
      <View style={styles.topRow}>
        {onBack ? (
          <CircleIconButton
            label={I18nManager.isRTL ? '›' : '‹'}
            accessibilityLabel={content.common.back}
            onPress={onBack}
            theme={theme}
          />
        ) : (
          <View style={styles.topRowSpacer} />
        )}
      </View>

      <View style={styles.headingBlock}>
        <Text style={[styles.screenTitle, { color: theme.titleColor }]}>
          {c.title}
        </Text>
        <Text style={[styles.screenSubtitle, { color: theme.secondaryText }]}>
          {c.subtitle}
        </Text>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {c.items.map(goal => (
          <GoalRow
            key={goal.id}
            goal={goal}
            image={goalImages && goalImages[goal.id]}
            selected={selected.includes(goal.id)}
            theme={theme}
            onToggle={onToggle}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topRow: { paddingHorizontal: 20, marginBottom: 6 },
  topRowSpacer: { width: 38 },
  headingBlock: { paddingHorizontal: 24 },
  screenTitle: {
    fontSize: 29,
    fontFamily: FONT.bold,
    letterSpacing: -0.6,
    lineHeight: 34,
  },
  screenSubtitle: {
    fontSize: 15,
    fontFamily: FONT.regular,
    marginTop: 6,
    lineHeight: 19,
  },
  list: { flex: 1, marginTop: 12 },
  listContent: { paddingHorizontal: 20, paddingBottom: 8 },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 19,
    borderWidth: 1,
    padding: 9,
    marginBottom: 9,
    shadowColor: '#000',
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  goalRowSelected: { borderWidth: 2 },
  goalImage: { width: 56, height: 56, borderRadius: 13 },
  goalImageFallback: { alignItems: 'center', justifyContent: 'center' },
  goalEmoji: { fontSize: 26 },
  goalCopy: { flex: 1, marginLeft: 14 },
  goalTitle: { fontSize: 16, fontFamily: FONT.bold },
  goalSubtitle: { fontSize: 13, fontFamily: FONT.regular, marginTop: 2 },
  radio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioTick: { color: '#fff', fontSize: 14, fontFamily: FONT.bold },
});
