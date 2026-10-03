import React, { memo, useMemo } from 'react';
import { View, Text } from 'react-native';
import Markdown from 'react-native-markdown-display';
import Animated, { FadeIn, Easing } from 'react-native-reanimated';

import { assistantStyles, userStyles, baseStyles } from './markdown/markdownStyles';
import CodeBlock from './markdown/CodeBlock';
import { MarkdownBlockquote } from './markdown/MarkdownBlockquote';
import { MarkdownLink } from './markdown/MarkdownLink';
import TableWrapper, { TableRow, TableCell } from './markdown/MarkdownTable';
import { MarkdownImage } from './markdown/MarkdownImage';
import { MarkdownList, MarkdownListItem } from './markdown/MarkdownList';

function preprocess(md) {
  let s = String(md || '');

  s = s.replace(/```[\w-]*\s*\n([\s\S]*?)\n\s*```/g, (match, content) => {
    if (content.includes('|') && content.includes('---')) {
      return '\n' + content + '\n';
    }
    return match;
  });

  s = s.replace(/^\+[-=+]+\+([-=+]+\+)*[-=+]*$/gm, '');

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

  const finalLines = [];
  for (let i = 0; i < stitchedLines.length; i++) {
    const line = stitchedLines[i];
    finalLines.push(line);
    if (line.trim().startsWith('|')) {
      const nextLine = (stitchedLines[i + 1] || '').trim();
      if (!line.includes('---') && !nextLine.includes('---') && !nextLine.startsWith('| -')) {
        const prevLine = (stitchedLines[i - 1] || '').trim();
        if (!prevLine.startsWith('|')) {
          const cols = line.split('|').length - 2;
          if (cols > 0) finalLines.push('|' + ' --- |'.repeat(cols));
        }
      }
    }
  }
  s = finalLines.join('\n');

  s = s.replace(/(^|\n)\s*(\d+)\s+\*\*([^*]+)\*\*/g, (_, a, n, t) => `${a}${n}. **${t}**`);

  s = s.replace(
    /(^|[\s(])((https?:\/\/)[^\s<>]+)(?=$|[\s)>])/g,
    (match, prefix, url, _scheme, offset, full) => {
      // Leave URLs inside markdown link targets alone: [label](https://example.com)
      if (prefix === '(' && full[offset - 1] === ']') {
        return match;
      }
      return `${prefix}<${url}>`;
    },
  );

  return s;
}

function MarkdownContentImpl({
  text,
  isUser,
  animateOnMount = false,
  selectable = false,
}) {
  const cleaned = useMemo(() => preprocess(text), [text]);
  const styles = isUser ? userStyles : assistantStyles;
  const selectableTextProps = useMemo(
    () =>
      selectable
        ? {
            selectable: true,
            selectionColor: '#F05A28',
            suppressHighlighting: true,
          }
        : null,
    [selectable],
  );

  const rules = useMemo(
    () => ({
      text: node => (
        <Text key={node.key} style={styles.body}>
          {node.content}
        </Text>
      ),
      fence: node => {
        const lang = ((node.info || '').trim().split(/\s+/)[0] || '').toLowerCase();
        const content = node.content.replace(/\n$/, '');
        return <CodeBlock key={node.key} language={lang} content={content} />;
      },
      code_block: node => {
        const content = node.content.replace(/\n$/, '');
        return <CodeBlock key={node.key} language="text" content={content} />;
      },
      code_inline: node => (
        <Text key={node.key} style={styles.code_inline} {...(selectableTextProps || {})}>
          {node.content}
        </Text>
      ),
      blockquote: (node, children) => (
        <MarkdownBlockquote key={node.key} node={node}>
          {children}
        </MarkdownBlockquote>
      ),
      table: (node, children) => (
        <TableWrapper key={node.key} node={node}>
          {children}
        </TableWrapper>
      ),
      tr: (node, children, parent) => (
        <TableRow key={node.key} node={node} parent={parent}>
          {children}
        </TableRow>
      ),
      th: (node, children) => (
        <TableCell key={node.key} isHeader>
          {children}
        </TableCell>
      ),
      td: (node, children) => (
        <TableCell key={node.key} isHeader={false}>
          {children}
        </TableCell>
      ),
      thead: (node, children) => <View key={node.key}>{children}</View>,
      tbody: (node, children) => <View key={node.key}>{children}</View>,
      bullet_list: (node, children) => (
        <MarkdownList key={node.key} isUser={isUser}>
          {children}
        </MarkdownList>
      ),
      ordered_list: (node, children) => (
        <MarkdownList key={node.key} isUser={isUser}>
          {children}
        </MarkdownList>
      ),
      list_item: (node, children, parent) => {
        const parentName = parent?.[0]?.name;
        const type = parentName === 'ordered_list' ? 'ol' : 'ul';
        return (
          <MarkdownListItem key={node.key} isUser={isUser} index={node.index} type={type}>
            {children}
          </MarkdownListItem>
        );
      },
      link: (node, children) => (
        <MarkdownLink key={node.key} node={node} isUser={isUser}>
          {children}
        </MarkdownLink>
      ),
      image: node => {
        const uri = node?.attributes?.src;
        return uri ? <MarkdownImage key={node.key} uri={uri} alt={node?.attributes?.alt} /> : null;
      },
      paragraph: (node, children) => (
        <View key={node.key} style={[styles.paragraph, isUser && node.index > 0 && { marginTop: 8 }]}>
          <Text style={styles.body} {...(selectableTextProps || {})}>
            {children}
          </Text>
        </View>
      ),
      textgroup: (node, children) => (
        <Text key={node.key} style={styles.body} {...(selectableTextProps || {})}>
          {children}
        </Text>
      ),
      heading1: (node, children) => (
        <View key={node.key} style={{ marginTop: 24, marginBottom: 12 }}>
          <Text style={styles.heading1} {...(selectableTextProps || {})}>
            {children}
          </Text>
          <View style={{ height: 1, backgroundColor: '#333', marginTop: 8, width: '100%' }} />
        </View>
      ),
      heading2: (node, children) => (
        <Text key={node.key} style={styles.heading2} {...(selectableTextProps || {})}>
          {children}
        </Text>
      ),
      heading3: (node, children) => (
        <Text key={node.key} style={styles.heading3} {...(selectableTextProps || {})}>
          {children}
        </Text>
      ),
      heading4: (node, children) => (
        <Text key={node.key} style={styles.heading4} {...(selectableTextProps || {})}>
          {children}
        </Text>
      ),
      heading5: (node, children) => (
        <Text key={node.key} style={styles.heading5} {...(selectableTextProps || {})}>
          {children}
        </Text>
      ),
      heading6: (node, children) => (
        <Text key={node.key} style={styles.heading6} {...(selectableTextProps || {})}>
          {children}
        </Text>
      ),
      hr: node => <View key={node.key} style={baseStyles.hr} />,
    }),
    [isUser, selectableTextProps, styles],
  );

  const container = animateOnMount
    ? { entering: FadeIn.duration(180).easing(Easing.out(Easing.cubic)) }
    : null;

  return (
    <Animated.View {...(container || {})} style={{ width: '100%' }}>
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
    prev.selectable === next.selectable &&
    prev.selectionResetToken === next.selectionResetToken
  );
});

export default MarkdownContent;
