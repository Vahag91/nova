import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import { getColors } from '../../styles/colors';
import { getFontFamily } from '../../styles/fonts';

export const MessageBubble = ({ role, text, time, encrypted = false }) => {
  const { isDarkMode } = useTheme();
  const colors = getColors(isDarkMode);

  const isUser = role === 'user';

  if (isUser) {
    return (
      <View style={styles.userContainer}>
        <LinearGradient
          colors={[colors.primary, colors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.userBubble}
        >
          <View style={styles.userTextContainer}>

          <Text style={[styles.userText, { fontFamily: getFontFamily('regular') }]}>
            {text}
          </Text>
          </View>
        </LinearGradient>
        <Text style={[styles.time, { color: colors.textSecondary, fontFamily: getFontFamily('regular') }]}>
          {time}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.assistantContainer}>
      <View
        style={[
          styles.assistantBubble,
          {
            backgroundColor: isDarkMode ? colors.tertiary : colors.secondary,
            borderColor: encrypted ? colors.primary : 'transparent',
            borderWidth: encrypted ? 1 : 0,
            borderStyle: encrypted ? 'dashed' : 'solid',
          },
        ]}
      >
        {encrypted && (
          <View style={styles.encryptedHeader}>
            <Icon name="lock" size={14} color={colors.primary} />
            <Text style={[styles.encryptedText, { color: colors.primary, fontFamily: getFontFamily('regular') }]}>
              Encrypted
            </Text>
          </View>
        )}
        <Text style={[styles.assistantText, { color: colors.textPrimary, fontFamily: getFontFamily('regular') }]}>
          {text}
        </Text>
      </View>
      <Text style={[styles.time, { color: colors.textSecondary, fontFamily: getFontFamily('regular') }]}>
        {time}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  userContainer: {
    alignItems: 'flex-end',
    marginVertical: 4,
    marginLeft: 20,
  },
  userBubble: {
    paddingHorizontal: 16,
    // paddingVertical: 12,
    borderRadius: 20,
    borderBottomRightRadius: 6,
    maxWidth: '96%',
  },
  userTextContainer: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  userText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 26,
    maxWidth: '100%',
  },
  assistantContainer: {
    alignItems: 'flex-start',
    marginVertical: 4,
    marginRight: 60,
  },
  assistantBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  assistantText: {
    fontSize: 16,
    lineHeight: 22,
  },
  encryptedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  encryptedText: {
    fontSize: 12,
    fontWeight: '600',
  },
  time: {
    fontSize: 11,
    marginTop: 4,
    marginHorizontal: 8,
  },
});
