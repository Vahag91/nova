import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActionSheetIOS } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import Haptic from 'react-native-haptic-feedback';
import MarkdownContent from './MarkdownContent';
import { colors } from '../../styles/colors';

export default function MessageBubble({
  message,
  isUser,
  isFirstInGroup,
  isLastInGroup,
  showMeta = false,       // timestamp + model
  onRetryFromHere,        // for user messages
}) {
  const radius = 18;
  const cornerStyle = isUser
    ? {
        borderTopLeftRadius: radius,
        borderTopRightRadius: isFirstInGroup ? radius : 6,
        borderBottomRightRadius: radius,
        borderBottomLeftRadius: isLastInGroup ? radius : 6,
      }
    : {
        borderTopRightRadius: radius,
        borderTopLeftRadius: isFirstInGroup ? radius : 6,
        borderBottomLeftRadius: radius,
        borderBottomRightRadius: isLastInGroup ? radius : 6,
      };

  const onLongPress = () => {
    Haptic.trigger('selection');
    const options = isUser
      ? ['Copy', 'Retry from here', 'Cancel']
      : ['Copy', 'Cancel'];
    const cancelButtonIndex = options.length - 1;

    ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex }, (idx) => {
      const choice = options[idx];
      if (choice === 'Copy') {
        Clipboard.setString(message.content || '');
        Haptic.trigger('notificationSuccess');
      } else if (choice === 'Retry from here' && onRetryFromHere) {
        onRetryFromHere(message);
      }
    });
  };

  return (
    <View style={[styles.wrap, isUser ? styles.right : styles.left]}>
      <TouchableOpacity activeOpacity={0.9} onLongPress={onLongPress}>
        <View style={[styles.bubble, isUser ? styles.user : styles.assistant, cornerStyle]}>
          {/* role tag small & subtle */}
          <Text style={[styles.role, isUser && styles.roleUser]}>{isUser ? 'You' : 'AI Assistant'}</Text>

          <MarkdownContent text={message.content} isUser={isUser} />

          {showMeta && (
            <View style={styles.metaRow}>
              {!!message.meta?.model && <Text style={styles.metaTag}>{message.meta.model}</Text>}
              <Text style={styles.metaTime}>{new Date(message.createdAt).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:{ paddingHorizontal:16, marginVertical:3 },
  left:{ alignItems:'flex-start', marginRight:60 },
  right:{ alignItems:'flex-end', marginLeft:60 },
  bubble:{
    maxWidth:'100%',
    padding:14,
    borderWidth:1, borderColor: colors.border,
    shadowColor:'#000', shadowOpacity:0.1, shadowRadius:3, shadowOffset:{width:0,height:1},
  },
  user:{ backgroundColor: colors.userBubble, borderColor: colors.userBubble },
  assistant:{ backgroundColor: colors.assistantBubble },
  role:{ fontSize:11, color: colors.textMuted, marginBottom:6, textTransform:'uppercase', fontWeight:'600' },
  roleUser:{ color: colors.userText + '80' },
  metaRow:{ marginTop:8, flexDirection:'row', gap:10, alignItems:'center' },
  metaTag:{ fontSize:11, color: colors.textMuted },
  metaTime:{ fontSize:11, color: colors.textMuted },
});
