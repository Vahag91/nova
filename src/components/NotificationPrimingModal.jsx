import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import SvgIcon from './SvgIcon';
import { colors } from '../styles/colors';

/**
 * Android only lets an app show the system notification prompt once - a denial
 * is permanent and can only be undone from Settings. So we explain the value
 * first and only trigger the real prompt when the user opts in here.
 */
export default function NotificationPrimingModal({ visible, onEnable, onSkip }) {
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onSkip}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <SvgIcon name="coin" size={30} color={colors.primary} />
          </View>

          <Text style={styles.title}>
            {t('notifications.priming.title', {
              defaultValue: 'Never miss your daily coins',
            })}
          </Text>

          <Text style={styles.body}>
            {t('notifications.priming.body', {
              defaultValue:
                'We send one reminder a day so your streak stays alive and your coins keep growing. No spam, and you can turn it off any time.',
            })}
          </Text>

          <Pressable
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            onPress={onEnable}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>
              {t('notifications.priming.enable', {
                defaultValue: 'Turn on reminders',
              })}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            onPress={onSkip}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryText}>
              {t('notifications.priming.skip', { defaultValue: 'Not now' })}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    marginBottom: 18,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  primary: {
    width: '100%',
    borderRadius: 14,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondary: {
    width: '100%',
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  secondaryText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  pressed: {
    opacity: Platform.OS === 'ios' ? 0.8 : 0.9,
  },
});
