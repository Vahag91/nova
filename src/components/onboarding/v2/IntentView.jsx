import React, { useContext } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import SvgIcon from '../../SvgIcon';
import { SubscriptionContext } from '../../../context/SubscriptionContext';

// Real Image Studio output rather than stock art: the opener has to show what
// the product actually does, the way the funnels we benchmarked all do.
const TILES = [
  require('../../../../assets/images/createstudio/cyberpunk.webp'),
  require('../../../../assets/images/createstudio/3dillistration.webp'),
  require('../../../../assets/images/createstudio/anime.webp'),
  require('../../../../assets/images/createstudio/epic.webp'),
];

/**
 * Trial-first opener. Leads with "try it for free", proves the product with a
 * live chat exchange plus generated images, and states the price plainly.
 */
export default function IntentView({
  animationController,
  interactionEnabled = true,
  isAnimating = false,
  onCriticalImageReady,
  onNextClick,
}) {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const subscription = useContext(SubscriptionContext);
  const compact = height < 740;
  const copy = (key, defaultValue) =>
    t(`onboarding.v3.${key}`, { defaultValue });

  const translateY = animationController.current.interpolate({
    inputRange: [0, 0.2, 0.8],
    outputRange: [0, -height, -height],
  });

  // Only shown once RevenueCat has real prices - never invent a figure.
  const yearly = subscription?.offeredPackages?.yearly?.product;
  const priceLine = yearly?.priceString
    ? copy('trial.priceLine', 'Then {{price}} per year. Cancel anytime.').replace(
        '{{price}}',
        yearly.priceString,
      )
    : null;

  return (
    <Animated.View
      renderToHardwareTextureAndroid={isAnimating}
      style={[styles.root, { transform: [{ translateY }] }]}
    >
      <View style={[styles.head, { paddingTop: insets.top + 22 }]}>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          numberOfLines={3}
          style={[styles.title, compact && styles.titleCompact]}
        >
          {copy('trial.title', 'We want you to try Cloud AI for free.')}
        </Text>
      </View>

      <View style={styles.stage}>
        <View style={styles.bubbleAsk}>
          <Text style={styles.bubbleAskText}>
            {copy('trial.demoAsk', 'Turn my sketch into a cyberpunk poster')}
          </Text>
        </View>

        <View style={styles.grid}>
          {TILES.map((tile, index) => (
            <Image
              key={index}
              fadeDuration={0}
              onError={index === 0 ? onCriticalImageReady : undefined}
              onLoad={index === 0 ? onCriticalImageReady : undefined}
              resizeMode="cover"
              source={tile}
              style={[styles.tile, compact && styles.tileCompact]}
            />
          ))}
        </View>

        <View style={styles.bubbleReply}>
          <SvgIcon name="stars" size={15} color="#0A0C10" />
          <Text style={styles.bubbleReplyText}>
            {copy('trial.demoReply', 'Four styles, ready in seconds.')}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom + 14, 22) },
        ]}
      >
        <View style={styles.reassure}>
          <SvgIcon name="check" size={16} color="#F4F0E8" />
          <Text style={styles.reassureText}>
            {copy('trial.noPayment', 'No payment due now')}
          </Text>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.9}
          disabled={isAnimating || !interactionEnabled}
          onPress={onNextClick}
          style={[
            styles.cta,
            (isAnimating || !interactionEnabled) && styles.ctaDisabled,
          ]}
        >
          <Text style={styles.ctaText}>
            {copy('trial.cta', 'Try for $0.00')}
          </Text>
        </TouchableOpacity>

        {priceLine ? <Text style={styles.priceLine}>{priceLine}</Text> : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden', backgroundColor: '#05070A' },
  head: { paddingHorizontal: 26 },
  title: {
    color: '#FAF9F6',
    fontFamily: 'Lato-Bold',
    fontSize: 31,
    lineHeight: 37,
    letterSpacing: -1,
    textAlign: 'center',
  },
  titleCompact: { fontSize: 26, lineHeight: 31 },
  stage: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  bubbleAsk: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
    marginBottom: 12,
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 18,
    borderBottomRightRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  bubbleAskText: {
    color: '#EDEBE6',
    fontFamily: 'Lato-Regular',
    fontSize: 14,
    lineHeight: 19,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  tile: {
    width: '48.5%',
    height: 152,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  tileCompact: { height: 118 },
  bubbleReply: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    maxWidth: '82%',
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderBottomLeftRadius: 5,
    backgroundColor: '#F4F0E8',
  },
  bubbleReplyText: {
    color: '#0A0C10',
    fontFamily: 'Lato-Bold',
    fontSize: 14,
  },
  footer: { paddingHorizontal: 24 },
  reassure: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 13,
  },
  reassureText: {
    color: '#F4F0E8',
    fontFamily: 'Lato-Bold',
    fontSize: 14,
  },
  cta: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    backgroundColor: '#F4F0E8',
  },
  ctaDisabled: { opacity: 0.4 },
  ctaText: {
    color: '#090B0E',
    fontFamily: 'Lato-Bold',
    fontSize: 17,
  },
  priceLine: {
    marginTop: 11,
    color: '#7F8592',
    fontFamily: 'Lato-Regular',
    fontSize: 12,
    textAlign: 'center',
  },
});
