import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../context/ThemeContext';
import { getColors, hexToRgba } from '../styles/colors';
import { getFontFamily } from '../styles/fonts';

export const AIModelCard = ({ model, onPress }) => {
  const { isDarkMode } = useTheme();
  const colors = getColors(isDarkMode);
  const [pressed, setPressed] = useState(false);

  const isQuick = model.id === 'quick-converse';
  const cardBg = isDarkMode ? colors.tertiary + 'CC' : colors.secondary;
  const chevronTint = isQuick ? '#9CA3AF' : colors.textSecondary;

  return (
    <Pressable
      onPress={() => onPress(model)}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
         style={[
           styles.card,
           {
             backgroundColor: cardBg,
             borderColor: pressed
               ? (isQuick ? hexToRgba(colors.gray[500], 0.3) : hexToRgba(model.color, 0.3))
               : 'transparent',
           },
         ]}
    >
      {/* Icon badge with light gradient tint */}
      <LinearGradient
        colors={[
          (isQuick ? '#4d4d5a' : model.color) + '33',
          (isQuick ? colors.tertiary : colors.tertiary),
        ]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.iconWrap}
      >
        <Icon
          name={model.icon}
          size={32}
          color={isQuick ? '#9CA3AF' : model.color}
        />
      </LinearGradient>

      <View style={styles.texts}>
        <Text style={[styles.name, { color: colors.textPrimary }]}>{model.name}</Text>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>{model.description}</Text>
      </View>

      <Icon name="chevron-right" size={24} color={isQuick ? '#9CA3AF' : chevronTint} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 16,
  },
  texts: { flex: 1 },
  name: { fontSize: 16, fontFamily: getFontFamily('bold'), marginBottom: 4 },
  desc: { fontSize: 14, fontFamily: getFontFamily('regular') },
});
