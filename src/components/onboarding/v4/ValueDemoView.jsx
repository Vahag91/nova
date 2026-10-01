/** Step 1 - shows what the workspace does before asking for anything. */
import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { AppearIn } from './primitives';
import { FONT } from './theme';

function FeatureIcon({ name, color }) {
  const common = {
    fill: 'none',
    stroke: color,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.8,
  };

  return (
    <View style={[styles.cardIcon, { backgroundColor: `${color}1A` }]}>
      <Svg width={16} height={16} viewBox="0 0 24 24">
        {name === 'doc' ? (
          <>
            <Path {...common} d="M6.5 3.5h7l4 4v13h-11z" />
            <Path {...common} d="M13.5 3.5v4h4M9 12h6M9 15.5h6" />
          </>
        ) : name === 'reply' ? (
          <>
            <Path {...common} d="M4 5.5h16v10H9.5L5.5 19v-3.5H4z" />
            <Path {...common} d="M8 9.5h8M8 12.5h5" />
          </>
        ) : (
          <>
            <Circle {...common} cx="12" cy="12" r="8.5" />
            <Path {...common} d="M3.8 12h16.4M12 3.5c2.2 2.3 3.3 5.1 3.3 8.5S14.2 18.2 12 20.5M12 3.5C9.8 5.8 8.7 8.6 8.7 12s1.1 6.2 3.3 8.5" />
          </>
        )}
      </Svg>
    </View>
  );
}

function DemoCard({ card, theme, align, image }) {
  const accent = theme.demoAccent?.[card.id] || theme.accent;

  return (
    <View style={[styles.cardWrap, align === 'right' && styles.cardWrapRight]}>
      <View style={styles.cardHeader}>
        <FeatureIcon name={card.id} color={accent} />
        <Text style={[styles.cardTitle, { color: accent }]}>
          {card.title}
        </Text>
      </View>
      {image ? (
        <Image
          fadeDuration={0}
          resizeMethod="resize"
          source={image}
          style={styles.createdImage}
        />
      ) : card.detail ? (
        <View
          style={[
            styles.cardDetailWrap,
            { backgroundColor: theme.cardSolid, borderColor: theme.cardStroke },
          ]}
        >
          <Text style={[styles.cardDetail, { color: theme.secondaryText }]}>
            {card.detail}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default function ValueDemoView({ content, theme }) {
  const c = content.valueDemo;
  const typing = useRef(new Animated.Value(0)).current;
  const brandStart = c.title.indexOf('Cloud AI');
  const titleBeforeBrand = brandStart >= 0 ? c.title.slice(0, brandStart) : c.title;
  const titleAfterBrand = brandStart >= 0 ? c.title.slice(brandStart + 8) : '';

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(typing, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(typing, {
          toValue: 0.35,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [typing]);

  return (
    <View style={styles.screen}>
      <View style={styles.visualStage}>
        <AppearIn delay={20} style={styles.headingBlock}>
          <Text style={styles.heroTitle}>
            {titleBeforeBrand.trim()}
          </Text>
          <Text style={styles.heroTitle}>
            {brandStart >= 0 ? (
              <Text style={{ color: theme.accent }}>Cloud AI</Text>
            ) : null}{' '}
            {titleAfterBrand.trim()}
          </Text>
        </AppearIn>

        <View style={styles.demoContent}>
          <View style={styles.topVisualRow}>
            <AppearIn delay={40} style={styles.documentCard}>
              <DemoCard card={c.cards[0]} theme={theme} align="left" />
            </AppearIn>

            <AppearIn delay={120} style={styles.imageCard}>
              <DemoCard card={c.cards[1]} theme={theme} align="right" />
            </AppearIn>
          </View>

          <AppearIn delay={200} style={styles.fullWidth}>
            <View
              style={[
                styles.workspaceCard,
                {
                  backgroundColor: theme.cardSolid,
                  borderColor: theme.cardStroke,
                  shadowOpacity: theme.shadowOpacity,
                },
              ]}
            >
              <Text style={[styles.workspaceLabel, { color: theme.accent }]}>
                {c.workspaceLabel}
              </Text>
              <Text style={[styles.microLabel, { color: theme.mutedText }]}>
                {c.userPromptLabel}
              </Text>
              <View
                style={[styles.bubble, { backgroundColor: theme.bubbleFill }]}
              >
                <Text style={[styles.bubbleText, { color: theme.primaryText }]}>
                  {c.prompt}
                </Text>
              </View>
              <Text
                style={[
                  styles.microLabel,
                  styles.microLabelSpaced,
                  { color: theme.mutedText },
                ]}
              >
                {c.aiTypingLabel}
              </Text>
              <Animated.View
                style={[
                  styles.bubble,
                  { backgroundColor: theme.bubbleFill, opacity: typing },
                ]}
              >
                <Text style={[styles.bubbleText, { color: theme.primaryText }]}>
                  {c.response}
                </Text>
              </Animated.View>
            </View>
          </AppearIn>

          <AppearIn delay={280} style={styles.fullWidth}>
            <DemoCard card={c.cards[2]} theme={theme} align="left" />
          </AppearIn>
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  visualStage: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 4,
  },
  topVisualRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    height: 158,
  },
  documentCard: { flex: 1, paddingTop: 26, paddingRight: 8 },
  imageCard: { width: 132 },
  fullWidth: { width: '100%' },
  headingBlock: {
    width: '100%',
    marginTop: 38,
    alignItems: 'center',
  },
  demoContent: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
  },

  cardWrap: { marginVertical: 6 },
  cardWrapRight: { alignItems: 'flex-end' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  cardIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 15, fontFamily: FONT.bold, marginLeft: 6 },
  cardDetailWrap: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 9,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  cardDetail: { fontSize: 13, lineHeight: 18, fontFamily: FONT.regular },
  createdImage: {
    width: 130,
    height: 132,
    borderRadius: 16,
    marginTop: 2,
  },

  workspaceCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 13,
    marginTop: -4,
    shadowColor: '#000',
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  workspaceLabel: {
    fontSize: 11,
    fontFamily: FONT.bold,
    letterSpacing: 1.2,
    marginBottom: 9,
  },
  microLabel: {
    fontSize: 9,
    fontFamily: FONT.bold,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  microLabelSpaced: { marginTop: 9 },
  bubble: { borderRadius: 13, paddingHorizontal: 12, paddingVertical: 9 },
  bubbleText: { fontSize: 13, lineHeight: 18, fontFamily: FONT.regular },

  heroTitle: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 32,
    fontFamily: FONT.bold,
    letterSpacing: -0.4,
    lineHeight: 39,
  },
});
