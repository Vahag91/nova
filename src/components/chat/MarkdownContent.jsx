import React, { useMemo, memo, useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  Linking,
  Image,
  Dimensions,
  InteractionManager,
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
  
  // First, remove all ASCII table separator lines completely
  s = s.replace(/^\+[-+]+\+([-+]+\+)*[-+]*$/gm, '');
  
  // Convert ASCII art tables to markdown tables
  const lines = s.split('\n');
  const processedLines = [];
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i];
    
    // Check for table pattern (consecutive | lines)
    if (line.includes('|') && !line.match(/^\s*\|[-:]+\|/)) {
      const potentialTable = [line];
      let k = i + 1;
      
      // Collect consecutive table rows
      while (k < lines.length && k < i + 50) {
        const nextLine = lines[k];
        
        // Stop if we hit a markdown table separator (already converted)
        if (nextLine.match(/^\s*\|[-:]+\|/)) {
          break;
        }
        
        // Stop if we hit an ASCII separator (should be removed but check anyway)
        if (nextLine.match(/^\+[-+]+\+([-+]+\+)*[-+]*$/)) {
          k++;
          break;
        }
        
        // Collect rows with | that look like table rows
        if (nextLine.includes('|')) {
          potentialTable.push(nextLine);
          k++;
        } else {
          break;
        }
      }
      
      // Process table if we have multiple rows
      if (potentialTable.length >= 2) {
        // Filter out rows that are just dashes or separators
        const validRows = potentialTable.filter(row => {
          const cells = row.split('|').map(c => c.trim()).filter(c => c);
          // Remove rows that are all dashes, empty, or just separators
          if (cells.length === 0) return false;
          const allDashes = cells.every(c => /^[-]+$/.test(c) || c === '-');
          return !allDashes && cells.some(c => c.length > 0 && c !== '-');
        });
        
        if (validRows.length >= 2) {
          const firstColCount = (validRows[0].match(/\|/g) || []).length;
          const allSameCols = validRows.every(l => {
            const colCount = (l.match(/\|/g) || []).length;
            return colCount === firstColCount && colCount > 1;
          });
          
          if (allSameCols && firstColCount > 1) {
            // Convert to markdown table with proper formatting
            const headerRow = validRows[0].trim();
            const headerCells = headerRow.split('|').map(c => c.trim()).filter(c => c);
            if (headerCells.length > 0) {
              // Format header with proper spacing: | Header 1 | Header 2 |
              const formattedHeader = '| ' + headerCells.map(c => c.trim()).join(' | ') + ' |';
              // Format separator: | --- | --- | --- | (standard markdown table separator)
              // Must have at least 3 dashes per cell, with spaces around pipes
              const separator = '| ' + headerCells.map(() => '---').join(' | ') + ' |';
              // Format data rows with proper spacing
              const dataRows = validRows.slice(1).map(row => {
                const cells = row.split('|').map(c => c.trim()).filter(c => c);
                if (cells.length === headerCells.length) {
                  return '| ' + cells.join(' | ') + ' |';
                }
                return row.trim();
              });
              // Ensure table is isolated with blank lines for proper parsing
              // But header and separator must be consecutive (no blank line between them)
              if (processedLines.length > 0 && processedLines[processedLines.length - 1].trim() !== '') {
                processedLines.push('');
              }
              processedLines.push(formattedHeader);
              processedLines.push(separator); // Must be immediately after header
              if (dataRows.length > 0) {
                processedLines.push(...dataRows);
              }
              processedLines.push('');
              i = k;
              continue;
            }
          }
        }
      }
    }
    
    // Skip ASCII separator lines (should already be removed, but double-check)
    if (!line.match(/^\+[-+]+\+([-+]+\+)*[-+]*$/)) {
      processedLines.push(line);
    }
    i++;
  }
  
  s = processedLines.join('\n');
  
  // Clean up any remaining ASCII artifacts
  s = s.replace(/\n\+[-+]+\+([-+]+\+)*[-+]*\n/g, '\n');
  s = s.replace(/^\+[-+]+\+([-+]+\+)*[-+]*\n/gm, '');
  
  // Remove empty rows in tables (rows with only dashes or empty cells)
  // Process line by line to remove dash-only rows, but keep markdown table separators
  const finalLines = s.split('\n');
  const cleanedLines = [];
  for (let idx = 0; idx < finalLines.length; idx++) {
    const currentLine = finalLines[idx];
    
    // Check if this is a markdown table separator (|---|---|) - keep it
    if (currentLine.match(/^\s*\|[-:]+\|/)) {
      cleanedLines.push(currentLine);
      continue;
    }
    
    // Check if this is a table row
    if (currentLine.includes('|')) {
      const cells = currentLine.split('|').map(c => c.trim()).filter(c => c);
      // Skip rows that are all dashes or empty (but not markdown separators)
      if (cells.length > 0) {
        const allDashes = cells.every(c => /^[-]+$/.test(c) || c === '-' || c === '');
        if (!allDashes) {
          cleanedLines.push(currentLine);
        }
        // If all dashes but it's a valid separator pattern, keep it
        else if (cells.length > 1 && cells.every(c => /^[-:]+$/.test(c))) {
          cleanedLines.push(currentLine);
        }
      } else {
        cleanedLines.push(currentLine);
      }
    } else {
      cleanedLines.push(currentLine);
    }
  }
  s = cleanedLines.join('\n');
  
  // Fix list formatting - ensure proper spacing
  s = s.replace(/(^|\n)\s*(\d+)\s+\*\*([^*]+)\*\*/g, (_, a, n, t) => `${a}${n}. **${t}**`);
  // Add blank line before lists if missing
  s = s.replace(/([^\n])\n([*-] |\d+\.)/g, (_m, a, b) => `${a}\n\n${b}`);
  // Fix checkbox syntax
  s = s.replace(/\n([-*] )\[x\]\s/gi, '\n$1☑︎ ');
  s = s.replace(/\n([-*] )\[ \]\s/g,  '\n$1☐ ');
  // Ensure lists have proper spacing after
  s = s.replace(/(\n[*-] .+|\n\d+\. .+)(\n[^\n*-0-9])/g, (match, listItem, next) => {
    // If next line doesn't start with list marker, add blank line
    if (!next.match(/^\n[*-] |^\n\d+\. /)) {
      return listItem + '\n' + next;
    }
    return match;
  });
  
  // Final check: Ensure table headers are immediately followed by separator
  // Fix any cases where header and separator got separated
  s = s.replace(/(\|[^\n]+\|)\n+\s*(\|[-\s:]+\|)/g, (match, header, separator) => {
    // If there are blank lines between header and separator, remove them
    return header + '\n' + separator;
  });
  
  return s;
}

/** Copyable code block with horizontal scroll */
function CodeBlock({ language, content }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  
  const copy = () => {
    Clipboard.setString(content || '');
    Haptic.trigger('notificationSuccess');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const langDisplay = (language || 'code').toUpperCase();
  return (
    <View style={codeStyles.wrap}>
      <View style={codeStyles.header}>
        <Text style={codeStyles.lang}>{langDisplay}</Text>
        <Pressable onPress={copy} hitSlop={8} accessibilityLabel={t('chat.copyCode')}>
          <Text style={codeStyles.copy}>{copied ? t('chat.copied', { defaultValue: 'Copied' }) : t('chat.copyCode')}</Text>
        </Pressable>
      </View>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={true}
        bounces={false}
        contentContainerStyle={codeStyles.scroller}
      >
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
  const prevStreamingRef = React.useRef(streaming);
  
  // Defer expensive markdown render when streaming completes
  const [deferredText, setDeferredText] = useState(text);
  const [isDeferring, setIsDeferring] = useState(false);
  const prevTextRefForDefer = React.useRef(text);
  
  useEffect(() => {
    // Skip if we're already deferring - don't interfere with ongoing deferral
    if (isDeferring) {
      return;
    }
    
    const wasStreaming = prevStreamingRef.current;
    const isNowStreaming = streaming;
    const textChanged = text !== prevTextRefForDefer.current;
    const textLengthIncrease = text.length - prevTextRefForDefer.current.length;
    
    // If streaming just completed AND text increased significantly, defer the expensive render
    // Lower threshold (30 chars) to catch more cases where final text is much larger
    if (wasStreaming && !isNowStreaming && textChanged && textLengthIncrease > 30) {
      // Set deferring flag but DON'T update deferredText yet - keep showing old text
      setIsDeferring(true);
      // Capture the text value at defer time to avoid race conditions
      const textToDefer = text;
      // Use InteractionManager to defer until interactions are complete
      const handle = InteractionManager.runAfterInteractions(() => {
        // Now update deferredText with the captured text - this will trigger the expensive render
        setDeferredText(textToDefer);
        setIsDeferring(false);
      });
      // Update refs to track the new text, but don't update deferredText state yet
      prevTextRefForDefer.current = text;
      prevStreamingRef.current = streaming;
      return () => handle.cancel();
    } else {
      // During streaming or if not streaming, update immediately
      setDeferredText(text);
      prevTextRefForDefer.current = text;
      prevStreamingRef.current = streaming;
    }
  }, [text, streaming]);
  
  // Use deferred text for markdown rendering to avoid blocking UI
  const cleaned = useMemo(() => preprocess(deferredText), [deferredText]);

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
    table: (node, children) => {
      // The markdown parser should provide children as thead/tbody/tr elements
      // Ensure all children are wrapped in the table structure
      return (
        <ScrollView 
          key={node.key} 
          horizontal 
          showsHorizontalScrollIndicator={true}
          bounces={false}
          style={base.tableScroll}
          contentContainerStyle={base.tableScrollContent}
        >
          <View style={base.table}>{children}</View>
        </ScrollView>
      );
    },
    thead: (node, children) => (
      <View key={node.key} style={base.thead}>
        {children}
      </View>
    ),
    tbody: (node, children) => (
      <View key={node.key} style={base.tbody}>
        {children}
      </View>
    ),
    tr: (node, children, parent) => {
      // Check if parent is thead to apply header styling
      const isHeaderRow = parent?.tagName === 'thead';
      
      // Also check if this is the first tr child of table (some parsers don't create thead)
      const tableParent = parent?.parent;
      const isFirstRowInTable = tableParent?.tagName === 'table' && 
                                parent?.tagName === 'tr' &&
                                tableParent?.children &&
                                tableParent.children[0]?.key === parent?.key;
      
      return (
        <View key={node.key} style={[base.tr, (isHeaderRow || isFirstRowInTable) && base.trHeader]}>
          {children}
        </View>
      );
    },
    th: (node, children) => {
      // Ensure text is properly rendered with styles
      const content = typeof children === 'string' ? children : children;
      return (
        <View key={node.key} style={base.th}>
          {typeof content === 'string' ? (
            <Text style={base.thText}>{content}</Text>
          ) : (
            content
          )}
        </View>
      );
    },
    td: (node, children, parent) => {
      // Check if parent tr is inside thead - if so, render as th
      const trParent = parent?.parent;
      const isInThead = trParent?.tagName === 'thead';
      
      // Also check if this is the first tr in a table (some parsers don't create thead)
      const tableParent = trParent?.parent;
      const isFirstRowInTable = tableParent?.tagName === 'table' && 
                                 trParent?.tagName === 'tr' &&
                                 tableParent?.children?.[0]?.key === trParent?.key;
      
      if (isInThead || isFirstRowInTable) {
        // Render as header cell
        const content = typeof children === 'string' ? children : children;
        return (
          <View key={node.key} style={base.th}>
            {typeof content === 'string' ? (
              <Text style={base.thText}>{content}</Text>
            ) : (
              content
            )}
          </View>
        );
      }
      
      // Regular data cell
      const content = typeof children === 'string' ? children : children;
      return (
        <View key={node.key} style={base.td}>
          {typeof content === 'string' ? (
            <Text style={base.tdText}>{content}</Text>
          ) : (
            content
          )}
        </View>
      );
    },
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
    hr: (node) => (
      <View key={node.key} style={base.hr} />
    ),
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
  (prev, next) => {
    // If streaming state changed, always re-render
    if (prev.streaming !== next.streaming) {
      return false; // Re-render
    }
    
    // During streaming, only re-render if text changed significantly (30+ chars or structure changed)
    if (next.streaming && prev.streaming) {
      const prevText = prev.text || '';
      const nextText = next.text || '';
      const lengthDiff = Math.abs(nextText.length - prevText.length);
      
      // Skip if only small changes (< 30 chars) and same structure
      if (lengthDiff < 30 && prevText.substring(0, Math.min(prevText.length, 100)) === nextText.substring(0, Math.min(nextText.length, 100))) {
        return true; // Skip re-render
      }
    }
    
    // Standard comparison for non-streaming or significant changes
    return (
      prev.text === next.text &&
      prev.isUser === next.isUser &&
      prev.animateOnMount === next.animateOnMount
    );
  }
);
export default MarkdownContent;

/* ---------- Enhanced Beautiful Markdown Theme ---------- */
const base = {
  body: { fontSize: 16, lineHeight: 26, color: colors.text, letterSpacing: 0.2 },
  text: { color: colors.text, fontSize: 16, lineHeight: 26, letterSpacing: 0.2 },
  paragraph: { marginBottom: 12, fontSize: 16, lineHeight: 26, letterSpacing: 0.2 },
  
  // Enhanced headings with better spacing and hierarchy
  heading1: { 
    fontSize: 24, 
    fontWeight: '800', 
    marginTop: 24, 
    marginBottom: 16, 
    color: colors.text,
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  heading2: { 
    fontSize: 20, 
    fontWeight: '700', 
    marginTop: 20, 
    marginBottom: 12, 
    color: colors.text,
    letterSpacing: -0.3,
    lineHeight: 28,
  },
  heading3: { 
    fontSize: 18, 
    fontWeight: '600', 
    marginTop: 16, 
    marginBottom: 10, 
    color: colors.text,
    letterSpacing: -0.2,
    lineHeight: 26,
  },
  strong: { fontWeight: '700', color: colors.text },
  em: { fontStyle: 'italic', color: colors.text },

  // Enhanced inline code with better contrast
  code_inline: {
    backgroundColor: colors.surfaceElevated + 'DD',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    fontFamily: 'Menlo',
    fontSize: 14,
    borderWidth: 0.5,
    borderColor: colors.border + '80',
  },
  code_block: { backgroundColor: 'transparent' },
  fence: { backgroundColor: 'transparent' },

  // Enhanced links with hover-like styling
  link: { 
    color: colors.primary, 
    textDecorationLine: 'underline',
    fontWeight: '500',
  },

  // Enhanced lists with better spacing and indentation
  list_item: { 
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    marginBottom: 6,
    paddingLeft: 4,
  },
  bullet_list: { 
    marginVertical: 12,
    paddingLeft: 4,
  },
  ordered_list: { 
    marginVertical: 12,
    paddingLeft: 4,
  },
  bullet_list_icon: { 
    width: 24, 
    textAlign: 'right', 
    marginRight: 10, 
    marginTop: 3, 
    fontSize: 16, 
    color: colors.primary,
    fontWeight: '600',
  },
  ordered_list_icon: { 
    width: 24, 
    textAlign: 'right', 
    marginRight: 10, 
    marginTop: 2, 
    fontSize: 15, 
    color: colors.primary, 
    fontWeight: '700' 
  },

  // Enhanced blockquotes with better visual prominence
  blockquote: { 
    borderLeftWidth: 4, 
    borderLeftColor: colors.primary + 'CC', 
    paddingLeft: 16, 
    paddingRight: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: colors.surfaceElevated + '80', 
    borderRadius: 8, 
    marginVertical: 12,
    marginLeft: 4,
  },
  blockquoteWarn: { 
    borderLeftColor: colors.error + 'DD', 
    backgroundColor: colors.error + '15',
  },
  blockquoteTip: { 
    borderLeftColor: colors.success + 'DD', 
    backgroundColor: colors.success + '15',
  },

  // Enhanced tables with better styling
  tableScroll: { 
    marginVertical: 12,
  },
  tableScrollContent: {
    flexGrow: 0, // Allow content to be wider than container for scrolling
  },
  table: { 
    borderWidth: 1, 
    borderColor: colors.border, 
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.surface + '80',
  },
  tr: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border + '60',
    minHeight: 44,
  },
  trHeader: {
    backgroundColor: colors.surfaceElevated + 'CC',
  },
  thead: { 
    backgroundColor: 'transparent',
  },
  tbody: { 
    backgroundColor: 'transparent',
  },
  th: { 
    flex: 1,
    padding: 14, 
    borderRightWidth: 0.5, 
    borderRightColor: colors.border + '80',
    backgroundColor: colors.surfaceElevated + 'CC',
    justifyContent: 'center',
    alignItems: 'flex-start',
    minWidth: 80,
  },
  thText: {
    fontWeight: '700', 
    fontSize: 14,
    color: colors.text,
  },
  td: { 
    flex: 1,
    padding: 12, 
    borderRightWidth: 0.5, 
    borderRightColor: colors.border + '60',
    justifyContent: 'center',
    alignItems: 'flex-start',
    minWidth: 80,
  },
  tdText: {
    fontSize: 14,
    color: colors.text,
  },

  // Horizontal rule for visual separation
  hr: {
    backgroundColor: colors.border,
    height: 1,
    marginVertical: 20,
    marginHorizontal: 0,
  },
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
  liRow: { 
    flexDirection: 'row', 
    gap: 10, 
    flexWrap: 'wrap', 
    alignItems: 'flex-start',
    minHeight: 24,
  },
  checkbox: { 
    width: 18, 
    height: 18, 
    borderRadius: 4, 
    borderWidth: 1.5, 
    borderColor: colors.primary + 'AA', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginTop: 3, 
    marginRight: 8,
    backgroundColor: colors.surfaceElevated + '40',
  },
  checkboxInner: { 
    width: 10, 
    height: 10, 
    borderRadius: 2, 
    backgroundColor: 'transparent' 
  },
  checkboxChecked: { 
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chip: { 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 999, 
    backgroundColor: colors.surfaceElevated + 'CC', 
    borderWidth: 1, 
    borderColor: colors.border + '80', 
    alignSelf: 'baseline', 
    marginLeft: 8,
  },
  chipText: { 
    fontSize: 12, 
    color: colors.primary, 
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

const codeStyles = StyleSheet.create({
  wrap: { 
    alignSelf: 'stretch', 
    width: '100%', 
    backgroundColor: colors.surfaceElevated + 'EE', 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: colors.border + 'AA', 
    overflow: 'hidden',
    marginVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 14, 
    paddingVertical: 10, 
    borderBottomWidth: 1, 
    borderBottomColor: colors.border + '80',
    backgroundColor: colors.surfaceElevated + 'AA',
  },
  lang: { 
    fontSize: 12, 
    color: colors.primary, 
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  copy: { 
    fontSize: 13, 
    color: colors.primary,
    fontWeight: '600',
  },
  scroller: { 
    paddingHorizontal: 16, 
    paddingVertical: 14,
    backgroundColor: colors.surfaceElevated + 'FF',
    flexGrow: 0, // Allow content to be wider than container for scrolling
  },
  text: { 
    fontFamily: 'Menlo', 
    fontSize: 13.5, 
    color: colors.text,
    lineHeight: 20,
    letterSpacing: 0.3,
  },
});
