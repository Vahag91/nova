import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import OneTimeOfferModal from '../components/OneTimeOfferModal';
import { ONE_TIME_OFFER_PAYWALL_ENABLED } from '../constants/featureFlags';

export default function OneTimeOfferScreen() {
  const navigation = useNavigation();
  const [visible, setVisible] = useState(ONE_TIME_OFFER_PAYWALL_ENABLED);

  useEffect(() => {
    if (ONE_TIME_OFFER_PAYWALL_ENABLED) return;
    const timer = setTimeout(() => {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('Chat');
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      if (!ONE_TIME_OFFER_PAYWALL_ENABLED) return;
      setVisible(true);
    }, [])
  );

  const handleClose = useCallback(() => {
    setVisible(false);
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  const handlePurchaseComplete = useCallback(() => {
    // Purchase completed, modal will close automatically
  }, []);

  if (!ONE_TIME_OFFER_PAYWALL_ENABLED) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <OneTimeOfferModal
        visible={visible}
        onClose={handleClose}
        onPurchaseComplete={handlePurchaseComplete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
