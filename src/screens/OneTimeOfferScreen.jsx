import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import OneTimeOfferModal from '../components/OneTimeOfferModal';

export default function OneTimeOfferScreen() {
  const navigation = useNavigation();
  const [visible, setVisible] = useState(true);

  useFocusEffect(
    useCallback(() => {
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

