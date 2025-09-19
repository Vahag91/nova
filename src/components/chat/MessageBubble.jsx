import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActionSheetIOS, Platform, Alert, Share, Keyboard } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import Haptic from 'react-native-haptic-feedback';
import MarkdownContent from './MarkdownContent';
import TypingDots from './TypingDots';
import SvgIcon from '../SvgIcon';
import { colors } from '../../styles/colors';

export default function MessageBubble({
  message,
  isUser,
  isFirstInGroup,
  isLastInGroup,
  showMeta = false,
  onRetryFromHere,
  streaming = false,
}) {
  const radius = 18;

  const cornerStyle = useMemo(() => (
    isUser
      ? {
          borderTopLeftRadius: radius,
          borderTopRightRadius: isFirstInGroup ? radius : 8,
          borderBottomRightRadius: radius,
          borderBottomLeftRadius: isLastInGroup ? radius : 8,
        }
      : {
          borderTopRightRadius: radius,
          borderTopLeftRadius: isFirstInGroup ? radius : 8,
          borderBottomLeftRadius: radius,
          borderBottomRightRadius: isLastInGroup ? radius : 8,
        }
  ), [isUser, isFirstInGroup, isLastInGroup]);

  const onCopy = () => {
    Clipboard.setString(message.content || '');
    Haptic.trigger('notificationSuccess');
  };

  const onShare = async () => {
    try {
      await Share.share({ message: message.content || '' });
    } catch {}
  };

  const onRegenerate = () => {
    if (!onRetryFromHere) return;
    onRetryFromHere(message);
  };

  const showSheet = () => {
    const baseUser = ['Copy', 'Retry from here', 'Cancel'];
    const baseAi = ['Copy', 'Share', 'Regenerate', 'Cancel'];
    const options = isUser ? baseUser : baseAi;
    const cancelButtonIndex = options.length - 1;

    if (Platform.OS === 'ios') {
      Haptic.trigger('selection');
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex }, (idx) => {
        const choice = options[idx];
        if (choice === 'Copy') onCopy();
        else if (choice === 'Share') onShare();
        else if (choice === 'Regenerate') onRegenerate();
        else if (choice === 'Retry from here') onRegenerate();
      });
    } else {
      Alert.alert('Message', undefined, [
        { text: 'Copy', onPress: onCopy },
        !isUser && { text: 'Share', onPress: onShare },
        { text: isUser ? 'Retry from here' : 'Regenerate', onPress: onRegenerate },
        { text: 'Cancel', style: 'cancel' },
      ].filter(Boolean));
    }
  };

  const status = message?.meta?.status; // 'pending' | 'sent' | 'failed'
  const model = message?.meta?.model;

  return (
    <View style={[
      styles.wrap, 
      isUser ? styles.right : styles.left,
      isFirstInGroup && styles.firstInGroup
    ]}>
      <View style={styles.messageContainer}>

        {isUser ? (
          <TouchableOpacity activeOpacity={0.92} onPress={Keyboard.dismiss} onLongPress={showSheet} delayLongPress={180}>
            <View style={[styles.bubble, styles.user, cornerStyle]}>
              <MarkdownContent text={message.content} isUser={isUser} />

              {showMeta && (
                <View style={styles.metaRow}>
                  {!!model && (
                    <View style={styles.modelTag}><Text style={styles.modelText}>{model}</Text></View>
                  )}
                  {!!status && (
                    <Text style={styles.metaTime}>
                      {status === 'pending' ? 'Sending…' : status === 'failed' ? 'Failed' : 'Sent'}
                    </Text>
                  )}
                </View>
              )}
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity activeOpacity={0.92} onPress={Keyboard.dismiss} onLongPress={showSheet} delayLongPress={180}>
            <View style={styles.assistantTextContainer}>
              {streaming && (!message.content || message.content.trim() === '') ? (
                <TypingDots color={colors.textSecondary} />
              ) : (
                <MarkdownContent text={message.content} isUser={isUser} />
              )}

              {showMeta && (
                <View style={styles.metaRow}>
                  {!!model && (
                    <View style={styles.modelTag}><Text style={styles.modelText}>{model}</Text></View>
                  )}
                  {!!status && (
                    <Text style={styles.metaTime}>
                      {status === 'pending' ? 'Sending…' : status === 'failed' ? 'Failed' : 'Sent'}
                    </Text>
                  )}
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Quick actions (visible under AI bubbles) */}
      {!isUser && (
        <View style={styles.actionRow}>
          <TouchableOpacity 
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.actionButtonPressed
            ]} 
            onPress={onCopy}
            accessibilityLabel="Copy message"
            accessibilityHint="Copy this message to clipboard"
          >
            <SvgIcon name="copy" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.actionButtonPressed
            ]} 
            onPress={onShare}
            accessibilityLabel="Share message"
            accessibilityHint="Share this message"
          >
            <SvgIcon name="share" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.actionButtonPressed
            ]} 
            onPress={onRegenerate}
            accessibilityLabel="Regenerate response"
            accessibilityHint="Generate a new response"
          >
            <SvgIcon name="repeat" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Retry chip for failed user messages */}
      {isUser && message?.meta?.status === 'failed' && (
        <View style={styles.failedRow}>
          <TouchableOpacity style={styles.retryChip} onPress={onRegenerate}>
            <SvgIcon name="repeat" size={16} color={colors.textSecondary} />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { 
    paddingHorizontal: 16, 
    marginVertical: 2,
  },
  left: { 
    alignItems: 'flex-start', 
    // marginRight: 60,
  },
  right: { 
    alignItems: 'flex-end', 
    // marginLeft: 60,
  },
  firstInGroup: {
    marginTop: 16,
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    maxWidth: '100%',
  },
  bubble: {
    maxWidth: '100%',
    paddingHorizontal: 12,
    borderWidth: 1, 
    borderColor: colors.border,
    shadowColor: '#000', 
    shadowOpacity: 0.08, 
    shadowRadius: 2, 
    shadowOffset: { width: 0, height: 1 },
    flexShrink: 1,
  },
  user: { 
    backgroundColor: colors.userBubble, 
    borderColor: colors.userBubble 
  },
  assistant: { 
    backgroundColor: colors.assistantBubble 
  },
  assistantTextContainer: {
    maxWidth: '100%',
    padding: 2,
    // No background, no border, no shadow for assistant messages
  },
  metaRow: { 
    marginTop: 6, 
    flexDirection: 'row', 
    gap: 8, 
    alignItems: 'center', 
    flexWrap: 'wrap' 
  },
  modelTag: { 
    backgroundColor: colors.surfaceElevated, 
    borderColor: colors.border, 
    borderWidth: 1, 
    paddingHorizontal: 6, 
    paddingVertical: 2, 
    borderRadius: 6 
  },
  modelText: { 
    fontSize: 10, 
    color: colors.textSecondary 
  },
  metaTime: { 
    fontSize: 10, 
    color: colors.textMuted 
  },
  actionRow: { 
    flexDirection: 'row', 
    gap: 12,
  },
  actionButton: { 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    backgroundColor: colors.surfaceElevated, 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 36,
    minHeight: 36,
  },
  actionButtonPressed: {
    backgroundColor: colors.border,
    transform: [{ scale: 0.95 }],
  },
  failedRow: { 
    marginTop: 6, 
    alignSelf: 'flex-end' 
  },
  retryChip: { 
    backgroundColor: colors.surfaceElevated, 
    borderColor: colors.border, 
    borderWidth: 1, 
    paddingHorizontal: 8, 
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4, 
    borderRadius: 999 
  },
  retryText: { 
    fontSize: 12, 
    color: colors.text 
  },
});
