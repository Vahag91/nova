import React, { useMemo, memo } from 'react';
import { View, Text, Platform } from 'react-native';
import Markdown from 'react-native-markdown-display';
import Animated, { FadeIn, Easing } from 'react-native-reanimated';

// 1. STYLES
import { assistantStyles, userStyles, baseStyles } from './markdown/markdownStyles';

// 2. COMPONENTS
import CodeBlock from './markdown/CodeBlock';
import { MarkdownBlockquote } from './markdown/MarkdownBlockquote';
import { MarkdownLink } from './markdown/MarkdownLink';
import TableWrapper, { TableRow, TableCell } from './markdown/MarkdownTable';
import { MarkdownImage } from './markdown/MarkdownImage';
import { MarkdownList, MarkdownListItem } from './markdown/MarkdownList';
import ChatText from './ChatText';

// 3. PREPROCESSOR
function preprocess(md) {
  let s = String(md || '');

  // A. UNWRAP TABLES FROM CODE BLOCKS
  s = s.replace(/```[\w-]*\s*\n([\s\S]*?)\n\s*```/g, (match, content) => {
    if (content.includes('|') && content.includes('---')) {
      return '\n' + content + '\n'; 
    }
    return match;
  });

  // B. REMOVE ASCII BORDERS
  s = s.replace(/^\+[-=+]+\+([-=+]+\+)*[-=+]*$/gm, '');

  // C. MAGNETIC STITCHING
  const lines = s.split('\n');
  const stitchedLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    if (line.trim().startsWith('|')) {
      stitchedLines.push(line);
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === '') j++;
      if (j < lines.length && lines[j].trim().startsWith('|')) i = j - 1;
    } else {
      stitchedLines.push(line);
    }
  }

  // D. SEPARATOR INJECTION
  const finalLines = [];
  for (let i = 0; i < stitchedLines.length; i++) {
    const line = stitchedLines[i];
    finalLines.push(line);
    if (line.trim().startsWith('|')) {
      const nextLine = (stitchedLines[i+1] || '').trim();
      if (!line.includes('---') && !nextLine.includes('---') && !nextLine.startsWith('| -')) {
        const prevLine = (stitchedLines[i-1] || '').trim();
        if (!prevLine.startsWith('|')) {
          const cols = line.split('|').length - 2;
          if (cols > 0) finalLines.push('|' + ' --- |'.repeat(cols));
        }
      }
    }
  }
  s = finalLines.join('\n');

  // E. FIX NUMBERED LISTS
  s = s.replace(/(^|\n)\s*(\d+)\s+\*\*([^*]+)\*\*/g, (_, a, n, t) => `${a}${n}. **${t}**`);
  
  // F. AUTOLINK
  s = s.replace(/(^|[\s(])((https?:\/\/)[^\s<>]+)(?=$|[\s)>])/g, (_, prefix, url) => {
    return `${prefix}<${url}>`;
  });

  return s;
}

function MarkdownContentImpl({ text, isUser, animateOnMount = false, selectionResetToken = 0 }) {
  const cleaned = useMemo(() => preprocess(text), [text]);
  const styles = isUser ? userStyles : assistantStyles;
  const useUiTextView = Platform.OS === 'ios' && !isUser;
  const keySalt = selectionResetToken || 0;

  const renderSelectableRuns = useMemo(() => {
    if (!useUiTextView) return null;

    const isNonTextNode = (child) =>
      React.isValidElement(child) && child.type === MarkdownImage;

    return (children, keyBase) => {
      const arr = React.Children.toArray(children);
      const out = [];
      let run = [];
      let k = 0;

      const flush = () => {
        if (!run.length) return;
        out.push(
          <ChatText
            key={`${keyBase}-sel-${k++}-${keySalt}`}
            selectable
            uiTextView
            style={styles.body}
          >
            {run}
          </ChatText>,
        );
        run = [];
      };

      for (const child of arr) {
        if (isNonTextNode(child)) {
          flush();
          out.push(React.cloneElement(child, { key: `${keyBase}-nt-${k++}` }));
          continue;
        }
        run.push(child);
      }

      flush();
      return out;
    };
  }, [styles.body, useUiTextView, keySalt]);

  const rules = useMemo(() => ({
    // --- CUSTOM COMPONENTS (Things that need special logic) ---

    // iOS assistant: render all text nodes as UITextView children so selection works per-block.
    ...(useUiTextView
      ? {
          text: (node, children, parent, styles, inheritedStyles = {}) => (
            <ChatText key={`${node.key}-${keySalt}`} style={[inheritedStyles, styles.text]}>
              {node.content}
            </ChatText>
          ),
          strong: (node, children, parent, styles) => (
            <ChatText key={`${node.key}-${keySalt}`} style={styles.strong}>
              {children}
            </ChatText>
          ),
          em: (node, children, parent, styles) => (
            <ChatText key={`${node.key}-${keySalt}`} style={styles.em}>
              {children}
            </ChatText>
          ),
          s: (node, children, parent, styles) => (
            <ChatText key={`${node.key}-${keySalt}`} style={styles.s}>
              {children}
            </ChatText>
          ),
          hardbreak: (node, children, parent, styles) => (
            <ChatText key={`${node.key}-${keySalt}`} style={styles.hardbreak}>
              {'\n'}
            </ChatText>
          ),
          softbreak: (node, children, parent, styles) => (
            <ChatText key={`${node.key}-${keySalt}`} style={styles.softbreak}>
              {'\n'}
            </ChatText>
          ),
        }
      : null),

    // 1. CODE BLOCKS
    fence: (node) => {
      const lang = ((node.info || '').trim().split(/\s+/)[0] || '').toLowerCase();
      const content = node.content.replace(/\n$/, '');
      return <CodeBlock key={node.key} language={lang} content={content} />;
    },
    code_block: (node) => {
      const content = node.content.replace(/\n$/, '');
      return <CodeBlock key={node.key} language="text" content={content} />;
    },
    // Keep this one because we want a specific look for inline code
    code_inline: (node) =>
      useUiTextView ? (
        <ChatText key={node.key} style={styles.code_inline}>
          {node.content}
        </ChatText>
      ) : (
        <Text key={node.key} style={styles.code_inline}>
          {node.content}
        </Text>
      ),

    // 2. ALERTS (Blockquote)
    blockquote: (node, children) => (
      <MarkdownBlockquote key={node.key} node={node}>{children}</MarkdownBlockquote>
    ),

    // 3. TABLES
    table: (node, children) => (
      <TableWrapper key={node.key} node={node}>{children}</TableWrapper>
    ),
    tr: (node, children, parent) => <TableRow key={node.key} node={node} parent={parent}>{children}</TableRow>,
    th: (node, children) => <TableCell key={node.key} isHeader>{children}</TableCell>,
    td: (node, children) => <TableCell key={node.key} isHeader={false}>{children}</TableCell>,
    thead: (node, children) => <View key={node.key}>{children}</View>,
    tbody: (node, children) => <View key={node.key}>{children}</View>,

    // 4. LISTS (Delegated to MarkdownList)
    bullet_list: (node, children) => <MarkdownList key={node.key} isUser={isUser}>{children}</MarkdownList>,
    ordered_list: (node, children) => <MarkdownList key={node.key} isUser={isUser}>{children}</MarkdownList>,
    list_item: (node, children, parent) => {
      const parentName = parent?.[0]?.name; 
      const type = parentName === 'ordered_list' ? 'ol' : 'ul';
      return <MarkdownListItem key={node.key} isUser={isUser} index={node.index} type={type}>{children}</MarkdownListItem>;
    },

    // 5. LINKS & IMAGES
    link: (node, children) => (
      <MarkdownLink key={node.key} node={node} isUser={isUser}>{children}</MarkdownLink>
    ),
    image: (node) => {
      const uri = node?.attributes?.src;
      return uri ? <MarkdownImage key={node.key} uri={uri} alt={node?.attributes?.alt} /> : null;
    },
    // 🟢 1. PARAGRAPH: Enforce the "Premium" Body Style
    // This ensures LineHeight: 28, FontSize: 16, and proper spacing.
    paragraph: (node, children) =>
      useUiTextView ? (
        <View key={node.key} style={styles.paragraph}>
          {renderSelectableRuns ? renderSelectableRuns(children, `p-${node.key}-${keySalt}`) : null}
        </View>
      ) : (
        <View key={node.key} style={styles.paragraph}>
          <Text style={styles.body}>{children}</Text>
        </View>
      ),

    // 🟢 2. TEXTGROUP: Catches "Loose" Text (Conversation)
    // Often, simple replies like "Hello!" are not wrapped in paragraphs.
    // This forces them to look just as good.
    textgroup: (node, children) =>
      useUiTextView ? (
        <ChatText key={`${node.key}-${keySalt}`} selectable uiTextView style={styles.body}>
          {children}
        </ChatText>
      ) : (
        <Text key={node.key} style={styles.body}>
          {children}
        </Text>
      ),
    // 6. CUSTOM TYPOGRAPHY
    // We ONLY define this because we want the extra separator line.
    // We let the library handle heading2, heading3, paragraph, text, strong, em automatically.
    heading1: (node, children) => (
      <View key={node.key} style={{ marginTop: 24, marginBottom: 12 }}>
        {useUiTextView ? (
          <ChatText key={`${node.key}-h1-${keySalt}`} selectable uiTextView style={styles.heading1}>
            {children}
          </ChatText>
        ) : (
          <Text style={styles.heading1}>{children}</Text>
        )}
        <View style={{ height: 1, backgroundColor: '#333', marginTop: 8, width: '100%' }} />
      </View>
    ),

    hr: (node) => <View key={node.key} style={baseStyles.hr} />,
  }), [isUser, renderSelectableRuns, styles, useUiTextView, keySalt]);

  const container = animateOnMount
    ? { entering: FadeIn.duration(180).easing(Easing.out(Easing.cubic)) }
    : null;

  return (
    <Animated.View {...(container || {})} style={{ width: '100%' }}>
      {/* 
        We pass 'styles' here. The library AUTOMATICALLY applies:
        styles.paragraph -> to paragraphs
        styles.text -> to text
        styles.heading2 -> to ## headers
        styles.strong -> to **bold**
      */}
      <Markdown rules={rules} style={styles}>
        {cleaned}
      </Markdown>
    </Animated.View>
  );
}

const MarkdownContent = memo(MarkdownContentImpl, (prev, next) => {
  return (
    prev.text === next.text &&
    prev.isUser === next.isUser &&
    prev.selectionResetToken === next.selectionResetToken
  );
});

export default MarkdownContent;
