import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ActionTile } from './ActionTile';

export const ActionTileRow = ({ onLeftPress, onRightPress }) => {
  return (
    <View style={styles.row}>
      <ActionTile title="New Chat" icon="add" tint="primary" onPress={onLeftPress} />
      <ActionTile title="Secret Chat" icon="shield" tint="accent" glow onPress={onRightPress} />
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
});
