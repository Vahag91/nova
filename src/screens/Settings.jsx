import React, { useCallback, useContext, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import SvgIcon from '../components/SvgIcon';
import { SubscriptionContext } from '../context/SubscriptionContext';
import { useThreadsStore } from '../state/useThreadsStore';
import { useSettingsStore } from '../state/useSettingsStore';
import HeroBanner from '../components/settings/HeroBanner';
import RateUsService from '../services/RateUsService';

const LINKS = {
  privacy: 'https://aicloudsolutions.app/privacy',
  terms: 'https://aicloudsolutions.app/terms',
  support: 'https://aicloudsolutions.app/contact',
};

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function SettingRow({ icon, iconBg, title, subtitle, onPress, disabled, isLast, trailing }) {
  return (
    <>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.row,
          pressed && styles.rowPressed,
          disabled && styles.rowDisabled,
        ]}
      >
        <View style={styles.rowLeft}>
          <View style={styles.rowIcon}>{icon}</View>
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowTitle}>{title}</Text>
            {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
          </View>
        </View>
        {trailing || (
          <SvgIcon
            name="chevron-left"
            size={16}
            color="rgba(255,255,255,0.45)"
            style={styles.rowChevron}
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
  const clearThreads = useThreadsStore(s => s.reset);
  const subscription = useContext(SubscriptionContext);
  const isPremium = !!subscription?.isPremium;
  const restorePurchases = subscription?.restorePurchases;

  const [restoring, setRestoring] = useState(false);

  const openUrlSafe = useCallback(async (url, fallbackMessage) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) throw new Error('unsupported');
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert(
        t('settings.alerts.linkUnavailableTitle'),
        fallbackMessage || t('settings.alerts.linkUnavailableMessage'),
      );
    }
  }, [t]);

  const handleUpgrade = useCallback(() => {
    if (isPremium) return;
    navigation.navigate('PaywallScreen', { returnTo: 'Settings' });
  }, [isPremium, navigation]);

  const handleRestore = useCallback(async () => {
    if (!restorePurchases) return;
    setRestoring(true);
    try {
      await restorePurchases();
      Alert.alert(
        t('settings.alerts.restoreSuccessTitle'),
        t('settings.alerts.restoreSuccessMessage'),
      );
    } catch (error) {
      Alert.alert(
        t('settings.alerts.restoreErrorTitle'),
        error?.message || t('settings.alerts.restoreErrorMessage'),
      );
    } finally {
      setRestoring(false);
    }
  }, [restorePurchases, t]);

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
      if (!isPremium) {
        items.push({
          key: 'premium',
          title: t('settings.rows.getPremium.title'),
          subtitle: t('settings.rows.getPremium.subtitle'),
          icon: <SvgIcon name="stars" size={22} color="#FCD34D" />,
          iconBg: '#2B1A3D',
          onPress: handleUpgrade,
        });
      }
      
      // Always show restore option
      items.push({
        key: 'restore',
        title: t('settings.rows.restore.title'),
        subtitle: t('settings.rows.restore.subtitle'),
        icon: <SvgIcon name="repeat" size={22} color="#60A5FA" />,
        iconBg: '#16263D',
        onPress: handleRestore,
        trailing: restoring ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : undefined,
        disabled: restoring,
      });
      
      return items;
    },
    [handleUpgrade, handleRestore, isPremium, restoring, t],
  );

  const supportItems = useMemo(
    () => [
      {
        key: 'rate',
        title: t('settings.rows.rate.title'),
        icon: <SvgIcon name="diamond" size={20} color="#FB923C" />,
        iconBg: '#321F14',
        onPress: handleRateUs,
      },
      {
        key: 'support',
        title: t('settings.rows.support.title'),
        subtitle: t('settings.rows.support.subtitle'),
        icon: <SvgIcon name="assistants" size={20} color="#34D399" />,
        iconBg: '#0F2E24',
        onPress: () => openUrlSafe(LINKS.support, t('settings.rows.support.error')),
      },
      {
        key: 'privacy',
        title: t('settings.rows.privacy.title'),
        icon: <SvgIcon name="lock" size={20} color="#93C5FD" />,
        iconBg: '#162742',
        onPress: () => openUrlSafe(LINKS.privacy, t('settings.rows.privacy.error')),
      },
      {
        key: 'terms',
        title: t('settings.rows.terms.title'),
        icon: <SvgIcon name="globe-grid" size={20} color="#C4B5FD" />,
        iconBg: '#261A35',
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
        icon: <SvgIcon name="tasks" size={20} color="#5EEAD4" />,
        iconBg: '#0F2F32',
        onPress: () => navigation.navigate('History'),
      },
      {
        key: 'reset',
        title: t('settings.rows.reset.title'),
        subtitle: t('settings.rows.reset.subtitle'),
        icon: <SvgIcon name="trash" size={20} color="#FB7185" />,
        iconBg: '#381621',
        onPress: handleClearData,
      },
    ],
    [handleClearData, navigation, t],
  );

  const renderSectionRows = (items) =>
    items.map((item, index) => (
      <SettingRow
        key={item.key}
        icon={item.icon}
        iconBg={item.iconBg}
        title={item.title}
        subtitle={item.subtitle}
        onPress={item.onPress}
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
      >
        {!isPremium ? (
          <HeroBanner onPress={handleUpgrade} />
        ) : null}

        <Section title={t('settings.sections.premium')}>{renderSectionRows(premiumItems)}</Section>

        <Section title={t('settings.sections.data')}>{renderSectionRows(dataItems)}</Section>

        <Section title={t('settings.sections.support')}>{renderSectionRows(supportItems)}</Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const PAGE_BACKGROUND = '#000000'; // match Chat screen background
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
    paddingTop: 48,
    gap: 32,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    paddingLeft: 4,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingVertical: 12,
  },
  rowPressed: {
    opacity: 0.6,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  rowIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextWrap: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: '#F5F7FF',
    fontSize: 16,
    fontWeight: '700',
  },
  rowSubtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
  },
  rowChevron: {
    transform: [{ rotate: '180deg' }],
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginLeft: 60,
    marginRight: 12,
  },
  versionLabel: {
    textAlign: 'center',
    color: 'rgba(148,163,184,0.7)',
    fontSize: 13,
    marginTop: 12,
    marginBottom: 12,
  },
});
