import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

export default function TypingDots({ color = '#3b82f6' }) {
  const a = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const seq = (v, delay) => Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 300, delay, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.3, duration: 300, useNativeDriver: true }),
      ])
    ).start();
    seq(a[0], 0); seq(a[1], 150); seq(a[2], 300);
    return () => a.forEach(v => v.stopAnimation && v.stopAnimation());
  }, []);

  return (
    <View style={styles.row}>
      {a.map((v, i) => (
        <Animated.View key={i} style={[styles.dot, { opacity: v, backgroundColor: color }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row:{ flexDirection:'row', alignItems:'center', gap:6 },
  dot:{ width:6, height:6, borderRadius:3 },
});
