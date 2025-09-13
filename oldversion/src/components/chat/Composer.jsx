import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import { getColors } from '../../styles/colors';
import { getFontFamily } from '../../styles/fonts';

export const Composer = ({
  onSend,
  bottomInset = 0,
  gradient = ['#7950F2', '#EC4899'],
  inputBg = '#1A1F2E',
  barBorderColor = 'rgba(255,255,255,0.08)',
}) => {
  const { isDarkMode } = useTheme();
  const colors = getColors(isDarkMode);
  const [text, setText] = useState('');

  const handleSend = () => {
    if (text.trim()) {
      onSend(text.trim());
      setText('');
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: bottomInset + 16 }]}>
      <View style={[styles.bar, { backgroundColor: inputBg, borderColor: barBorderColor }]}>
        <TouchableOpacity style={styles.plusBtn}>
          <Icon name="add" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        <TextInput
          style={[styles.input, { color: colors.textPrimary, fontFamily: getFontFamily('regular') }]}
          placeholder="Type a message..."
          placeholderTextColor={colors.textSecondary}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />

        <TouchableOpacity
          style={styles.sendBtn}
          onPress={handleSend}
          disabled={!text.trim()}
        >
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sendGradient}
          >
            <Icon name="send" size={18} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1,
    minHeight: 48,
  },
  plusBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
    maxHeight: 100,
    paddingVertical: 4,
  },
  sendBtn: {
    marginLeft: 8,
  },
  sendGradient: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
