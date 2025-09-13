import React from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { colors } from '../../styles/colors';

export default function Composer({
  value,
  onChange,
  onSend,
  onStop,
  onRetry,
  streaming,
  offline = false,
  placeholder = "Type your message...",
}) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <View style={styles.container}>
        <View style={styles.inputRow}>
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder={placeholder}
            style={styles.input}
            editable={!streaming && !offline}
            multiline
            placeholderTextColor={colors.placeholder}
            maxLength={4000}
          />
          {!streaming ? (
            <TouchableOpacity
              style={[styles.sendButton, (!value.trim() || offline) && styles.sendButtonDisabled]}
              onPress={onSend}
              disabled={!value.trim() || offline}
            >
              <Text style={styles.sendButtonText}>{offline ? 'Offline' : 'Send'}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.stopButton} onPress={onStop}>
              <Text style={styles.stopButtonText}>Stop</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {!streaming && onRetry && (
          <TouchableOpacity onPress={onRetry} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry last message</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: colors.inputBackground,
    color: colors.inputText,
  },
  sendButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 22,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: colors.buttonText,
    fontWeight: '600',
    fontSize: 16,
  },
  stopButton: {
    backgroundColor: colors.error,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 22,
    shadowColor: colors.error,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  stopButtonText: {
    color: colors.buttonText,
    fontWeight: '600',
    fontSize: 16,
  },
  retryButton: {
    alignSelf: 'center',
    marginTop: 12,
    padding: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
});
