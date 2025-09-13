import React from 'react';
import { StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { colors } from '../../styles/colors';

export default function MarkdownContent({ text, isUser }) {
  return (
    <Markdown
      style={isUser ? userStyles : assistantStyles}
      // Safe defaults; RNMD sanitizes by default
      onLinkPress={(url) => { /* you can add Linking.openURL(url) */ }}
    >
      {text || ''}
    </Markdown>
  );
}

const base = {
  body: { fontSize:16, lineHeight:22 },
  text: { color: colors.text },
  code_inline: {
    backgroundColor: colors.surfaceElevated, borderRadius:6, paddingHorizontal:6, paddingVertical:2, fontFamily:'Menlo',
  },
  code_block: {
    backgroundColor: colors.surfaceElevated, color: colors.text, borderRadius:10, padding:12, fontFamily:'Menlo',
  },
  fence: {
    backgroundColor: colors.surfaceElevated, color: colors.text, borderRadius:10, padding:12, fontFamily:'Menlo',
  },
  link: { color: colors.primary },
  list_item: { flexDirection:'row' },
};

const assistantStyles = StyleSheet.create({
  ...base,
  text: { ...base.text, color: colors.assistantText },
});

const userStyles = StyleSheet.create({
  ...base,
  text: { ...base.text, color: colors.userText },
  link: { color: colors.userText },
  code_inline: { ...base.code_inline, backgroundColor: colors.primaryDark, color: colors.userText },
  code_block: { ...base.code_block, backgroundColor: colors.primaryDark },
  fence: { ...base.fence, backgroundColor: colors.primaryDark },
});
