import React, { useCallback } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import StartupLoadingScreen from './StartupLoadingScreen';
import SvgIcon from '../components/SvgIcon';
import { ROOT_DRAWER_ROUTE } from '../navigation/rootNavigation';

// Preview of the app launch screen (the branded loading screen shown first on
// startup) so its UI can be inspected on demand from the sidebar.
export default function LaunchScreenPreview() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const exitPreview = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate(ROOT_DRAWER_ROUTE, { screen: 'Chat' });
  }, [navigation]);

  return (
    <View style={styles.container}>
      <StartupLoadingScreen />

      <Pressable
        onPress={exitPreview}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Close launch screen preview"
        style={[styles.closeButton, { top: insets.top + 12 }]}
      >
        <SvgIcon name="back-bold" size={22} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A10',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,10,16,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    zIndex: 20,
  },
});
