import React, { useMemo, memo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  Linking,
  Image,
  Dimensions,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import Clipboard from '@react-native-clipboard/clipboard';
import Haptic from 'react-native-haptic-feedback';
import Animated, { Easing, FadeIn } from 'react-native-reanimated';
import { colors } from '../../styles/colors';
import { useTranslation } from 'react-i18next';

/** Normalize common model quirks so lists render cleanly */
function preprocess(md) {
  let s = String(md || '');
  s = s.replace(/(^|\n)\s*(\d+)\s+\*\*([^*]+)\*\*/g, (_, a, n, t) => `${a}${n}. **${t}**`);
  s = s.replace(/([^\n])\n([*-] |\d+\.)/g, (_m, a, b) => `${a}\n\n${b}`);
  s = s.replace(/\n([-*] )\[x\]\s/gi, '\n$1☑︎ ');
  s = s.replace(/\n([-*] )\[ \]\s/g,  '\n$1☐ ');
  return s;
}

/** Copyable code block with horizontal scroll */
function CodeBlock({ language, content }) {
  const { t } = useTranslation();
  const copy = () => { Clipboard.setString(content || ''); Haptic.trigger('notificationSuccess'); };
  return (
    <View style={codeStyles.wrap}>
      <View style={codeStyles.header}>
        <Text style={codeStyles.lang}>{language || 'code'}</Text>
        <Pressable onPress={copy} hitSlop={8} accessibilityLabel={t('chat.copyCode')}>
          <Text style={codeStyles.copy}>{t('chat.copyCode')}</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={codeStyles.scroller}>
        <Text style={codeStyles.text}>{content}</Text>
      </ScrollView>
    </View>
  );
}

/** Pure image inside markdown: consistent width & aspect */
const ImageRenderer = memo(function ImageRenderer({ uri, alt }) {
  const screenW = Dimensions.get('window').width; // match bubbles
  const H_PAD = 32;
  const IMAGE_MAX_W = 280;  // Reduced from 380 to 280
  const lockedWRef = React.useRef(Math.min(screenW - H_PAD * 2, IMAGE_MAX_W));
  const [ratio, setRatio] = React.useState(16 / 9);

  return (
    <Image
      source={{ uri }}
      accessibilityLabel={alt || 'image'}
      resizeMode="contain"
      onLoad={(e) => {
        const s = e?.nativeEvent?.source;
        if (s?.width && s?.height) {
          const r = s.width / s.height;
          if (isFinite(r) && r > 0) setRatio(r);
        }
      }}
      style={{
        width: lockedWRef.current,
        aspectRatio: ratio,
        alignSelf: 'center',
        borderRadius: 10,
      }}
      fadeDuration={200}
    />
  );
}, (prev, next) => prev.uri === next.uri);

function MarkdownContentImpl({ text, isUser, animateOnMount = false, streaming = false }) {
  const cleaned = useMemo(() => preprocess(text), [text]);

  const rules = useMemo(() => ({
    fence: (node) => {
      const lang = ((node.info || '').trim().split(/\s+/)[0] || '').toLowerCase();
      return <CodeBlock key={node.key} language={lang} content={node.content} />;
    },
    code_inline: (node) => (
      <Text key={node.key} style={isUser ? userStyles.code_inline : assistantStyles.code_inline}>
        {node.content}
      </Text>
    ),
    blockquote: (node, children) => {
      const first = String(node?.children?.[0]?.children?.[0]?.content || node?.children?.[0]?.content || '').toUpperCase();
      let tone = 'note';
      if (first.startsWith('[!WARNING]') || first.startsWith('⚠')) tone = 'warn';
      else if (first.startsWith('[!TIP]') || first.startsWith('💡')) tone = 'tip';
      const style = [base.blockquote, tone === 'warn' && base.blockquoteWarn, tone === 'tip' && base.blockquoteTip];
      return <View key={node.key} style={style}>{children}</View>;
    },
    table: (node, children) => (
      <ScrollView key={node.key} horizontal showsHorizontalScrollIndicator={false} style={base.tableScroll} contentContainerStyle={{ flexDirection: 'row' }}>
        <View style={base.table}>{children}</View>
      </ScrollView>
    ),
    link: (node, children) => {
      const url = node?.attributes?.href || '';
      const isWiki = /wikipedia\.org/i.test(url);
      const onPress = () => url && Linking.openURL(url).catch(() => {});
      if (!isWiki) {
        return (
          <Text key={node.key} style={isUser ? userStyles.link : assistantStyles.link} onPress={onPress}>
            {children}
          </Text>
        );
      }
      return (
        <Pressable key={node.key} onPress={onPress} style={mdStyles.chip} hitSlop={6}>
          <Text style={mdStyles.chipText}>Wikipedia</Text>
        </Pressable>
      );
    },
    image: (node) => {
      const uri = node?.attributes?.src;
      if (!uri) return null;
      return <ImageRenderer key={node.key} uri={uri} alt={node?.attributes?.alt || ''} />;
    },
    list_item: (node, children) => {
      const firstChild = node?.children?.[0];
      const raw = firstChild?.content || '';
      let checkbox = null;
      if (raw.startsWith('☑︎ ') || raw.startsWith('☐ ')) {
        const checked = raw.startsWith('☑︎ ');
        const rest = raw.slice(2);
        checkbox = (
          <View key={`${node.key}-box`} style={mdStyles.checkbox}>
            <View style={[mdStyles.checkboxInner, checked && mdStyles.checkboxChecked]} />
          </View>
        );
        if (firstChild) firstChild.content = rest;
      }
      return (
        <View key={node.key} style={mdStyles.liRow}>
          {checkbox}
          <View style={{ flex: 1 }}>{children}</View>
        </View>
      );
    },
  }), [isUser]);

  const container = animateOnMount
    ? { entering: FadeIn.duration(180).easing(Easing.out(Easing.cubic)) }
    : null;

  return (
    <Animated.View {...(container || {})}>
      <Markdown rules={rules} style={isUser ? userStyles : assistantStyles} onLinkPress={(url) => url && Linking.openURL(url).catch(() => {})}>
        {cleaned}
      </Markdown>
    </Animated.View>
  );
}

const MarkdownContent = memo(
  MarkdownContentImpl,
  (prev, next) =>
    prev.text === next.text &&
    prev.isUser === next.isUser &&
    prev.streaming === next.streaming &&
    prev.animateOnMount === next.animateOnMount
);
export default MarkdownContent;

/* ---------- Theme (unchanged) ---------- */
const base = {
  body: { fontSize: 16, lineHeight: 24, color: colors.text },
  text: { color: colors.text, fontSize: 16, lineHeight: 24 },
  paragraph: { marginBottom: 8, fontSize: 16, lineHeight: 24 },
  heading1: { fontSize: 22, fontWeight: '800', marginTop: 18, marginBottom: 12, color: colors.text },
  heading2: { fontSize: 20, fontWeight: '800', marginTop: 18, marginBottom: 12, color: colors.text },
  heading3: { fontSize: 18, fontWeight: '700', marginTop: 14, marginBottom: 10, color: colors.text },
  strong: { fontWeight: '700', color: colors.text },
  em: { fontStyle: 'italic', color: colors.text },

  code_inline: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontFamily: 'Menlo',
    fontSize: 14,
  },
  code_block: { backgroundColor: 'transparent' },
  fence: { backgroundColor: 'transparent' },

  link: { color: colors.primary, textDecorationLine: 'underline' },

  list_item: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  bullet_list: { marginVertical: 8 },
  ordered_list: { marginVertical: 8 },
  bullet_list_icon: { width: 22, textAlign: 'right', marginRight: 8, marginTop: 2, fontSize: 14, color: colors.textSecondary },
  ordered_list_icon: { width: 22, textAlign: 'right', marginRight: 8, marginTop: 1, fontSize: 14, color: colors.textSecondary, fontWeight: '700' },

  blockquote: { borderLeftWidth: 4, borderLeftColor: colors.border, paddingLeft: 12, backgroundColor: colors.surfaceElevated, paddingVertical: 8, paddingRight: 12, borderRadius: 6, marginVertical: 8 },
  blockquoteWarn: { borderLeftColor: colors.error + 'AA', backgroundColor: colors.error + '10' },
  blockquoteTip: { borderLeftColor: colors.primary, backgroundColor: colors.primary + '10' },

  tableScroll: { marginVertical: 8 },
  table: { borderWidth: 1, borderColor: colors.border, borderRadius: 8 },
  thead: { backgroundColor: colors.surfaceElevated },
  tbody: { backgroundColor: colors.surface },
  th: { padding: 12, borderWidth: 1, borderColor: colors.border, fontWeight: '600', fontSize: 14 },
  td: { padding: 12, borderWidth: 1, borderColor: colors.border, fontSize: 14 },
};

const assistantStyles = StyleSheet.create({
  ...base,
  text: { ...base.text, color: colors.assistantText },
});

const userStyles = StyleSheet.create({
  ...base,
  text: { ...base.text, color: colors.userText },
  paragraph: { ...base.paragraph, color: colors.userText },
  heading1: { ...base.heading1, color: colors.userText },
  heading2: { ...base.heading2, color: colors.userText },
  heading3: { ...base.heading3, color: colors.userText },
  strong: { ...base.strong, color: colors.userText },
  em: { ...base.em, color: colors.userText },
  link: { color: colors.userText },
  code_inline: { ...base.code_inline, backgroundColor: colors.primaryDark, color: colors.userText },
});

const mdStyles = StyleSheet.create({
  liRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' },
  checkbox: { width: 16, height: 16, borderRadius: 3, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 4, marginRight: 6 },
  checkboxInner: { width: 10, height: 10, borderRadius: 2, backgroundColor: 'transparent' },
  checkboxChecked: { backgroundColor: colors.primary },
  chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, alignSelf: 'baseline', marginLeft: 6 },
  chipText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
});

const codeStyles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', width: '100%', backgroundColor: colors.surfaceElevated, borderRadius: 10, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  lang: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  copy: { fontSize: 12, color: colors.text },
  scroller: { paddingHorizontal: 12, paddingVertical: 10 },
  text: { fontFamily: 'Menlo', fontSize: 13, color: colors.text },
});
