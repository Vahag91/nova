import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import SvgIcon from '../SvgIcon';

export const SeeRewardsButton = ({ onPress }) => {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.wrapper,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.card}>

        <View style={styles.left}>
          <View style={styles.iconContainer}>
            <SvgIcon name="coin" size={22} color="#80D8FF" />
          </View>

          <View>
            <Text style={styles.title}>Rewards</Text>
            <Text style={styles.subtitle}>Daily bonuses & perks</Text>
          </View>
        </View>

      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 20,
  },

  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },

  card: {
    backgroundColor: '#0D0F15',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(115,188,255,0.18)',

    flexDirection: 'row',
    alignItems: 'center',

    // 🔥 Softer, minimal neon shadow
    shadowColor: '#3BA7FF',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },

  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(80,140,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(120,200,255,0.25)',
  },

  title: {
    color: '#E3F6FF',
    fontSize: 16,
    fontWeight: '700',
  },

  subtitle: {
    color: '#9BC7E8',
    fontSize: 13,
    marginTop: 2,
  },
});