import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { useTranslation } from 'react-i18next';

export default function OfflineBanner() {
  const { t } = useTranslation();
  const { isConnected, isInternetReachable } = useNetInfo();
  const offline = isConnected === false || isInternetReachable === false;

  if (!offline) return null;

  return (
    <View pointerEvents="none" style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.text}>{t('app.offlineBanner')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 9999,
  },
  inner: {
    backgroundColor: '#F59E0B',
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { color: '#111827', fontWeight: '700' },
});
