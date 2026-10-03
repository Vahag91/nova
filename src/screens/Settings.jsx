import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  Alert,
  ActivityIndicator,
  I18nManager,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import Icon from '../components/ui/Icon';
import { colors } from '../styles/colors';
import { SubscriptionContext } from '../context/SubscriptionContext';
import { useAndroidNavigationMenu } from '../navigation/AndroidNavigationMenuContext';
import { useThreadsStore } from '../state/useThreadsStore';
import { useSettingsStore } from '../state/useSettingsStore';
import HeroBanner from '../components/settings/HeroBanner';
import RateUsService from '../services/RateUsService';
import { perfLog } from '../lib/perfTrace';
import { resolvePremiumStatus } from '../lib/resolvePremiumStatus';

const LINKS = {
  privacy: 'https://aicloudsolutions.app/privacy/chatcloud',
  terms: 'https://aicloudsolutions.app/terms',
  support: 'https://aicloudsolutions.app/contact',
  subscriptions: 'https://play.google.com/store/account/subscriptions',
};

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function SettingRow({ icon, danger, title, subtitle, onPress, disabled, isLast, trailing }) {
  return (
    <>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.row,
          pressed && styles.rowPressed,
          disabled && styles.rowDisabled,
        ]}
      >
        <View style={styles.rowIcon}>
          <Icon name={icon} size={20} color={danger ? colors.error : colors.text} />
        </View>
        <View style={styles.rowTextWrap}>
          <Text style={styles.rowTitle}>{title}</Text>
          {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
        </View>
        {trailing || (
          <Icon
            name="chevron-right"
            size={18}
            color={colors.textMuted}
            strokeWidth={2}
            style={I18nManager.isRTL ? styles.rowChevronRtl : null}
          />
        )}
      </Pressable>
      {!isLast && <View style={styles.rowDivider} />}
    </>
  );
}

export default function Settings() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const isFocused = useIsFocused();
  const { reportScreenReady } = useAndroidNavigationMenu();
  const clearThreads = useThreadsStore(s => s.reset);
  const subscription = useContext(SubscriptionContext);
  const restorePurchases = subscription?.restorePurchases;

  const [restoring, setRestoring] = useState(false);
  const [hasPremiumAccess, setHasPremiumAccess] = useState(
    () => !!subscription?.isPremium,
  );
  const [premiumStatusResolved, setPremiumStatusResolved] = useState(
    () => !!subscription?.isPremium || !subscription?.paymentsEnabled,
  );
  const rootLayoutLoggedRef = useRef(false);
  const rootLayoutSeenRef = useRef(false);
  const screenReadyReportedRef = useRef(false);
  const contentSizeLoggedRef = useRef(false);

  useEffect(() => {
    perfLog('settings.screen.mounted');
    return () => {
      perfLog('settings.screen.unmounted');
    };
  }, []);

  useEffect(() => {
    perfLog('settings.screen.focus', {
      isFocused,
    });
    if (isFocused) {
      rootLayoutLoggedRef.current = false;
      contentSizeLoggedRef.current = false;
      screenReadyReportedRef.current = false;
      if (rootLayoutSeenRef.current) {
        requestAnimationFrame(() => {
          if (!screenReadyReportedRef.current) {
            reportScreenReady('Settings');
            screenReadyReportedRef.current = true;
          }
        });
      }
    }
  }, [isFocused, reportScreenReady]);

  useEffect(() => {
    let cancelled = false;
    const cachedPremium = !!subscription?.isPremium;
    const paymentsEnabled = !!subscription?.paymentsEnabled;

    setHasPremiumAccess(cachedPremium);
    setPremiumStatusResolved(cachedPremium || !paymentsEnabled);

    if (!isFocused) {
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      const resolvedPremium = await resolvePremiumStatus(subscription);
      if (cancelled) {
        return;
      }

      setHasPremiumAccess(resolvedPremium);
      setPremiumStatusResolved(true);
    })().catch(() => {
      if (!cancelled) {
        setPremiumStatusResolved(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    isFocused,
    subscription,
    subscription?.isPremium,
    subscription?.paymentsEnabled,
  ]);

  const openUrlSafe = useCallback(async (url, fallbackMessage) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert(
        t('settings.alerts.linkUnavailableTitle'),
        fallbackMessage || t('settings.alerts.linkUnavailableMessage'),
      );
    }
  }, [t]);

  const handleUpgrade = useCallback(async () => {
    if (await resolvePremiumStatus(subscription)) return;
    navigation.navigate('PaywallScreen', { returnTo: 'Settings' });
  }, [navigation, subscription]);

  const handleRestore = useCallback(async () => {
    if (!restorePurchases) return;
    setRestoring(true);
    try {
      const info = await restorePurchases();
      const restored =
        Object.keys(info?.entitlements?.active || {}).length > 0 ||
        (await resolvePremiumStatus(subscription));

      setHasPremiumAccess(restored);
      setPremiumStatusResolved(true);

      if (restored) {
        Alert.alert(
          t('settings.alerts.restoreSuccessTitle'),
          t('settings.alerts.restoreSuccessMessage'),
        );
      } else {
        Alert.alert(
          t('settings.alerts.restoreEmptyTitle', {
            defaultValue: 'No purchases found',
          }),
          t('settings.alerts.restoreEmptyMessage', {
            defaultValue: 'We could not find an active purchase to restore for this account.',
          }),
        );
      }
    } catch {
      Alert.alert(
        t('settings.alerts.restoreErrorTitle'),
        t('settings.alerts.restoreErrorMessage'),
      );
    } finally {
      setRestoring(false);
    }
  }, [restorePurchases, subscription, t]);

  const handleClearData = useCallback(() => {
    Alert.alert(
      t('settings.alerts.resetConfirmTitle'),
      t('settings.alerts.resetConfirmMessage'),
      [
        { text: t('settings.alerts.resetConfirmCancel'), style: 'cancel' },
        {
          text: t('settings.alerts.resetConfirmCta'),
          style: 'destructive',
          onPress: async () => {
            try {
              await clearThreads?.();
              await useSettingsStore.getState().reset();
            } catch (error) {
              // Reset error handled silently
            }
          },
        },
      ],
    );
  }, [clearThreads, t]);

  const handleRateUs = useCallback(async () => {
    try {
      await RateUsService.showRatePrompt();
    } catch (error) {
      Alert.alert(
        t('settings.alerts.linkUnavailableTitle'),
        t('settings.rows.rate.error'),
      );
    }
  }, [t]);

  const premiumItems = useMemo(
    () => {
      const items = [];
      
      // Only show "Get Premium" if user is not premium
      if (premiumStatusResolved && !hasPremiumAccess) {
        items.push({
          key: 'premium',
          title: t('settings.rows.getPremium.title'),
          subtitle: t('settings.rows.getPremium.subtitle'),
          icon: 'crown',
          onPress: handleUpgrade,
        });
      }
      
      // Always show restore option
      items.push({
        key: 'restore',
        title: t('settings.rows.restore.title'),
        subtitle: t('settings.rows.restore.subtitle'),
        icon: 'restore',
        onPress: handleRestore,
        trailing: restoring ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : undefined,
        disabled: restoring,
      });
      
      return items;
    },
    [
      handleUpgrade,
      handleRestore,
      hasPremiumAccess,
      premiumStatusResolved,
      restoring,
      t,
    ],
  );

  const supportItems = useMemo(
    () => [
      {
        key: 'rate',
        title: t('settings.rows.rate.title'),
        icon: 'star',
        onPress: handleRateUs,
      },
      {
        key: 'support',
        title: t('settings.rows.support.title'),
        subtitle: t('settings.rows.support.subtitle'),
        icon: 'support',
        onPress: () => openUrlSafe(LINKS.support, t('settings.rows.support.error')),
      },
      {
        key: 'privacy',
        title: t('settings.rows.privacy.title'),
        icon: 'shield',
        onPress: () => openUrlSafe(LINKS.privacy, t('settings.rows.privacy.error')),
      },
      {
        key: 'terms',
        title: t('settings.rows.terms.title'),
        icon: 'terms',
        onPress: () => openUrlSafe(LINKS.terms, t('settings.rows.terms.error')),
      },
    ],
    [handleRateUs, openUrlSafe, t],
  );

  const dataItems = useMemo(
    () => [
      {
        key: 'history',
        title: t('settings.rows.history.title'),
        subtitle: t('settings.rows.history.subtitle'),
        icon: 'history',
        onPress: () => navigation.navigate('History'),
      },
      {
        key: 'reset',
        title: t('settings.rows.reset.title'),
        subtitle: t('settings.rows.reset.subtitle'),
        icon: 'trash',
        danger: true,
        onPress: handleClearData,
      },
    ],
    [handleClearData, navigation, t],
  );

  useEffect(() => {
    perfLog('settings.sections.snapshot', {
      premiumItems: premiumItems.length,
      dataItems: dataItems.length,
      supportItems: supportItems.length,
      isPremium: hasPremiumAccess,
      premiumStatusResolved,
      restoring,
    });
  }, [
    dataItems.length,
    hasPremiumAccess,
    premiumItems.length,
    premiumStatusResolved,
    restoring,
    supportItems.length,
  ]);

  const wrapSettingPress = useCallback((key, onPress) => () => {
    perfLog('settings.row.press', {
      key,
    });
    onPress?.();
  }, []);

  const renderSectionRows = (items) =>
    items.map((item, index) => (
      <SettingRow
        key={item.key}
        icon={item.icon}
        danger={item.danger}
        title={item.title}
        subtitle={item.subtitle}
        onPress={wrapSettingPress(item.key, item.onPress)}
        disabled={item.disabled}
        trailing={item.trailing}
        isLast={index === items.length - 1}
      />
    ));

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 24) }]}
        showsVerticalScrollIndicator={false}
        onLayout={() => {
          if (rootLayoutLoggedRef.current) return;
          rootLayoutLoggedRef.current = true;
          rootLayoutSeenRef.current = true;
          perfLog('settings.root.layout');
          if (isFocused && !screenReadyReportedRef.current) {
            reportScreenReady('Settings');
            screenReadyReportedRef.current = true;
          }
        }}
        onContentSizeChange={(_, height) => {
          if (contentSizeLoggedRef.current) return;
          contentSizeLoggedRef.current = true;
          perfLog('settings.content_size', {
            height,
            premiumItems: premiumItems.length,
            dataItems: dataItems.length,
            supportItems: supportItems.length,
          });
        }}
      >
        {premiumStatusResolved && !hasPremiumAccess ? (
          <HeroBanner onPress={handleUpgrade} />
        ) : null}

        <Section title={t('settings.sections.premium')}>{renderSectionRows(premiumItems)}</Section>

        <Section title={t('settings.sections.data')}>{renderSectionRows(dataItems)}</Section>

        <Section title={t('settings.sections.support')}>{renderSectionRows(supportItems)}</Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const PAGE_BACKGROUND = colors.background;
const ROW_ICON = 40;
const ROW_GAP = 14;
const ROW_PADDING = 12;
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: PAGE_BACKGROUND,
  },
  container: {
    flex: 1,
    backgroundColor: PAGE_BACKGROUND,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 24,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    paddingStart: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    overflow: 'hidden',
  },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ROW_GAP,
    paddingHorizontal: ROW_PADDING,
    paddingVertical: 12,
  },
  rowPressed: {
    backgroundColor: colors.surfaceElevated,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  rowIcon: {
    width: ROW_ICON,
    height: ROW_ICON,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceInset,
  },
  rowTextWrap: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
  },
  rowSubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 19,
  },
  rowChevronRtl: {
    transform: [{ scaleX: -1 }],
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginStart: ROW_PADDING + ROW_ICON + ROW_GAP,
  },
});
