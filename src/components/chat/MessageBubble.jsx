import React, { useMemo, memo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActionSheetIOS, Platform, Alert, Share, Keyboard, Image, Dimensions } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import Haptic from 'react-native-haptic-feedback';
import MarkdownContent from './MarkdownContent';
import SvgIcon from '../SvgIcon';
import StreamingText from './StreamingText';
import { colors } from '../../styles/colors';
import { useTranslation } from 'react-i18next';

// --- image helpers (stable, no global regex side-effects) ---
const IMG_TAG_RE = /!\[[^\]]*\]\(([^)]+)\)/;        // non-global: safe for .test()

function extractImageUrisAll(md = '') {
  const out = [];
  const re = /!\[[^\]]*\]\(([^)]+)\)/g;             // local /g instance: safe per-call
  let m;
  while ((m = re.exec(md))) out.push(m[1]);
  return out;
}

function stripImageMd(md = '') {
  return md.replace(/!\[[^\]]*\]\(([^)]+)\)/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

function isImagesOnly(md = '') {
  if (!md || typeof md !== 'string') return false;
  const hasImg = IMG_TAG_RE.test(md);
  if (!hasImg) return false;
  const leftover = stripImageMd(md).replace(/```[\s\S]*?```/g, '').trim();
  return leftover.length === 0;
}

// helper component (place above MessageBubble)
function FitImage({ uri, style }) {
  const screenW = Dimensions.get('window').width;
  const H_PAD = 32;
  const MAX_W = 100;
  const width = Math.min(screenW - H_PAD * 2, MAX_W);
  const [ratio, setRatio] = useState(16 / 9);

  return (
    <Image
      source={{ uri }}
      resizeMode="contain"
      onLoad={(e) => {
        const s = e?.nativeEvent?.source;
        if (s?.width && s?.height) {
          const r = s.width / s.height;
          if (isFinite(r) && r > 0) setRatio(r);
        }
      }}
      style={[{ width, aspectRatio: ratio, alignSelf: 'center', borderRadius: 10 }, style]}
      fadeDuration={200}
    />
  );
}

const G = 8; // grid gap

function PureImagesBlock({ uris, alignRight }) {
  const screenW = Dimensions.get('window').width;
  const H_PAD = 32;        // visual padding from screen sides
  const MAX_W = 380;       // cap
  const containerW = Math.min(screenW - H_PAD * 2, MAX_W);

  if (!uris.length) return null;

  // Single image → big square-ish
  if (uris.length === 1) {
    return (
      <View style={{ maxWidth: containerW, alignSelf: alignRight ? 'flex-end' : 'flex-start' }}>
        <Image
          source={{ uri: uris[0] }}
          style={{ width: containerW, aspectRatio: 1, borderRadius: 12 }}
          resizeMode="cover"
        />
      </View>
    );
  }

  // 2+ images → simple 2-column grid
  const colW = Math.floor((containerW - G) / 2);

  return (
    <View
      style={[
        styles.gridWrap,
        { width: containerW, alignSelf: alignRight ? 'flex-end' : 'flex-start' }
      ]}
    >
      {uris.map((u, i) => (
        <Image
          key={`${u}-${i}`}
          source={{ uri: u }}
          style={{ width: colW, height: colW, borderRadius: 10, marginRight: (i % 2 === 0) ? G : 0, marginBottom: G }}
          resizeMode="cover"
        />
      ))}
    </View>
  );
}

const MessageBubble = memo(function MessageBubble({
  message,
  isUser,
  isFirstInGroup,
  isLastInGroup,
  showMeta = false,
  onRetryFromHere,
  streaming = false,
  streamingMessageId,
}) {
  const { t } = useTranslation();
  const radius = 18;
  const copyLabel = t('chat.actions.copy', { defaultValue: 'Copy' });
  const shareLabel = t('chat.actions.share', { defaultValue: 'Share' });
  const regenerateLabel = t('chat.actions.regenerate', { defaultValue: 'Regenerate' });
  const retryLabel = t('chat.actions.retryFromHere', { defaultValue: 'Retry from here' });
  const cancelLabel = t('chat.actions.cancel', { defaultValue: 'Cancel' });
  const messageActionTitle = t('chat.messageActionTitle', { defaultValue: 'Message' });
  const sendingLabel = t('chat.status.sending', { defaultValue: 'Sending…' });
  const failedLabel = t('chat.status.failed', { defaultValue: 'Failed' });
  const sentLabel = t('chat.status.sent', { defaultValue: 'Sent' });

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
    try { await Share.share({ message: message.content || '' }); } catch {}
  };

  const onRegenerate = () => {
    if (onRetryFromHere) onRetryFromHere(message);
  };

  const showSheet = () => {
    const baseUser = [copyLabel, retryLabel, cancelLabel];
    const baseAi = [copyLabel, shareLabel, regenerateLabel, cancelLabel];
    const options = isUser ? baseUser : baseAi;
    const cancelButtonIndex = options.length - 1;

    if (Platform.OS === 'ios') {
      Haptic.trigger('selection');
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex }, (idx) => {
        const choice = options[idx];
        if (choice === copyLabel) onCopy();
        else if (choice === shareLabel) onShare();
        else if (choice === regenerateLabel) onRegenerate();
        else if (choice === retryLabel) onRegenerate();
      });
    } else {
      Alert.alert(messageActionTitle, undefined, [
        { text: copyLabel, onPress: onCopy },
        !isUser && { text: shareLabel, onPress: onShare },
        { text: isUser ? retryLabel : regenerateLabel, onPress: onRegenerate },
        { text: cancelLabel, style: 'cancel' },
      ].filter(Boolean));
    }
  };

  const status = message?.meta?.status; // 'pending' | 'sent' | 'failed'
  const model = message?.meta?.model;
  const isPureImages = isImagesOnly(message.content);
  const imageUris = isPureImages ? extractImageUrisAll(message.content) : [];

  return (
    <View style={[
      styles.wrap,
      isUser ? styles.right : styles.left,
      isFirstInGroup && styles.firstInGroup
    ]}>
      <View style={styles.messageContainer}>
        {isUser ? (
          // --- NEW mixed handling: images (any count) + optional text ---
          (() => {
            const content = message.content || '';
            const uris = extractImageUrisAll(content);
            const leftover = stripImageMd(content);

            // Pure image(s) → no bubble, just images
            if (uris.length && isImagesOnly(content)) {
              return (
                <View style={{ gap: 8, alignItems: 'flex-end' }}>
                  {uris.map((u, i) => (
                    <View key={`${u}-${i}`} style={{ alignSelf: 'flex-end' }}>
                      <FitImage uri={u} />
                    </View>
                  ))}
                </View>
              );
            }

            // Mixed (images + text) → images first, then normal bubble with remaining text
            if (uris.length && leftover) {
              return (
                <View style={{ gap: 8, alignItems: 'flex-end' }}>
                  {uris.map((u, i) => (
                    <View key={`${u}-${i}`} style={{ alignSelf: 'flex-end' }}>
                      <FitImage uri={u} />
                    </View>
                  ))}
                  <TouchableOpacity
                    activeOpacity={0.92}
                    onPress={Keyboard.dismiss}
                    onLongPress={showSheet}
                    delayLongPress={180}
                  >
                    <View style={[styles.bubble, styles.user, cornerStyle]}>
                      <MarkdownContent text={leftover} isUser={isUser} />
                      {showMeta && (
                        <View style={styles.metaRow}>
                          {!!model && <View style={styles.modelTag}><Text style={styles.modelText}>{model}</Text></View>}
                          {!!status && <Text style={styles.metaTime}>{status === 'pending' ? sendingLabel : status === 'failed' ? failedLabel : sentLabel}</Text>}
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
              );
            }

            // Text-only → your existing bubble
            return (
              <TouchableOpacity activeOpacity={0.92} onPress={Keyboard.dismiss} onLongPress={showSheet} delayLongPress={180}>
                <View style={[styles.bubble, styles.user, cornerStyle]}>
                  <MarkdownContent text={content} isUser={isUser} />
                  {showMeta && (
                    <View style={styles.metaRow}>
                      {!!model && <View style={styles.modelTag}><Text style={styles.modelText}>{model}</Text></View>}
                      {!!status && <Text style={styles.metaTime}>{status === 'pending' ? sendingLabel : status === 'failed' ? failedLabel : sentLabel}</Text>}
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })()
        ) : (
          // ASSISTANT SIDE (unified)
          (() => {
            const isStreamingThis = streamingMessageId === message.id;
            return (
              <TouchableOpacity activeOpacity={0.92} onPress={Keyboard.dismiss} onLongPress={showSheet} delayLongPress={180}>
                <View
                  style={[
                    styles.assistantTextContainer,
                    isStreamingThis && styles.assistantTight
                  ]}
                  accessibilityLiveRegion="polite"
                >
                  <StreamingText
                    messageId={message.id}
                    base={message.content}
                    streaming={isStreamingThis}
                    activityText={message?.meta?.activity}
                  />
                  {showMeta && (
                    <View style={styles.metaRow}>
                      {!!model && (
                        <View style={styles.modelTag}><Text style={styles.modelText}>{model}</Text></View>
                      )}
                      {!!status && (
                        <Text style={styles.metaTime}>
                          {status === 'pending' ? sendingLabel : status === 'failed' ? failedLabel : sentLabel}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })()
        )}
      </View>

      {/* Quick actions (visible under AI bubbles) */}
      {!isUser && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
            onPress={onCopy}
            accessibilityLabel={t('chat.copyMessage')}
            accessibilityHint={t('chat.copyMessageHint')}
          >
            <SvgIcon name="copy" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
            onPress={onShare}
            accessibilityLabel={t('chat.shareMessage')}
            accessibilityHint={t('chat.shareMessageHint')}
          >
            <SvgIcon name="share" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
            onPress={onRegenerate}
            accessibilityLabel={t('chat.regenerateResponse')}
            accessibilityHint={t('chat.regenerateResponseHint')}
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
            <Text style={styles.retryText}>{t('chat.regenerateResponse')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    marginVertical: 2,
  },
  left: { alignItems: 'flex-start' },
  right: { alignItems: 'flex-end' },
  firstInGroup: { marginTop: 16 },

  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    maxWidth: '100%',
  },

  // text bubble
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
    borderColor: colors.userBubble,
  },

  // assistant text container (no background)
  assistantTextContainer: {
    maxWidth: '100%',
    padding: 0,
  },
  assistantTight: {
    paddingHorizontal: 0,
    marginHorizontal: 0,
  },

  // pure images grid
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  metaRow: {
    marginTop: 6,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  modelTag: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  modelText: { fontSize: 10, color: colors.textSecondary },
  metaTime: { fontSize: 10, color: colors.textMuted },

  actionRow: { flexDirection: 'row', gap: 12, marginTop: 6 },
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

  failedRow: { marginTop: 6, alignSelf: 'flex-end' },
  retryChip: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
  },
  retryText: { fontSize: 12, color: colors.text },
});

export default MessageBubble;
