import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import Haptic from 'react-native-haptic-feedback';
import { useTranslation } from 'react-i18next';

// CONFIG: Compact but readable
const COL_WIDTH = 120; 
const MIN_ROW_HEIGHT = 40;

// --- 1. DATA EXTRACTOR ---
const extractTableData = (node) => {
  const headers = [];
  const rows = [];

  const traverse = (n, context = null) => {
    if (n.type === 'thead') context = 'head';
    if (n.type === 'tbody') context = 'body';
    
    if (n.type === 'tr') {
      const rowData = [];
      
      // Helper to extract text deeply
      const getText = (child) => {
        if (child.content) return child.content;
        if (child.children) return child.children.map(getText).join('');
        return '';
      };

      if (n.children) {
        n.children.forEach((cell) => {
           const text = getText(cell).trim();
           rowData.push(text);
        });
      }

      // --- FILTER: Remove Separator Rows (---) ---
      // Checks if the row contains only dashes, colons, or pipes
      const isSeparator = rowData.every(txt => {
        const t = txt.replace(/\s/g, ''); // Remove spaces
        return t === '' || /^[-:|]+$/.test(t);
      });

      if (!isSeparator && rowData.length > 0) {
        if (context === 'head') headers.push(rowData);
        else rows.push(rowData); 
      }
    }
    
    if (n.children) {
      n.children.forEach(c => traverse(c, context));
    }
  };

  traverse(node);
  
  // Fallback: If no THEAD was found, use the first row as header
  const finalHeaders = headers.length > 0 ? headers[0] : (rows.shift() || []);
  
  return { headers: finalHeaders, rows };
};

// --- 2. COMPONENT ---
export const MarkdownTable = ({ node }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const { headers, rows } = useMemo(() => extractTableData(node), [node]);

  if (!headers.length && !rows.length) return null;

  // Calculate Width
  const columnCount = Math.max(headers.length, rows[0]?.length || 0);
  const tableWidth = columnCount * COL_WIDTH;

  const handleCopy = () => {
    const headerStr = headers.join(' | ');
    const rowsStr = rows.map(r => r.join(' | ')).join('\n');
    Clipboard.setString(`${headerStr}\n${rowsStr}`);
    Haptic.trigger('notificationSuccess');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={styles.wrapper}>
      {/* HEADER BAR */}
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>{t('chat.markdown.table')}</Text>
        <Pressable onPress={handleCopy} hitSlop={10}>
          <Text style={[styles.copyText, copied && { color: '#4BB543' }]}>
            {copied ? t('chat.markdown.copied') : t('chat.markdown.copy')}
          </Text>
        </Pressable>
      </View>

      {/* SCROLLABLE CONTENT */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={true}
        persistentScrollbar={true}
        bounces={false}
        contentContainerStyle={{ flexGrow: 1 }}
        // Prevents parent from stealing touch
        onStartShouldSetResponder={() => true}
      >
        <View style={[styles.tableContainer, { minWidth: tableWidth }]}>
          
          {/* Table Header */}
          <View style={styles.headerRow}>
            {headers.map((headerText, i) => (
              <View key={`h-${i}`} style={[styles.cell, i === headers.length - 1 && styles.cellLast]}>
                <Text style={styles.headerText}>{headerText}</Text>
              </View>
            ))}
          </View>

          {/* Table Body */}
          {rows.map((row, rowIndex) => (
            <View 
              key={`r-${rowIndex}`} 
              style={[
                styles.row, 
                rowIndex % 2 === 0 ? styles.rowEven : styles.rowOdd 
              ]}
            >
              {row.map((cellText, cellIndex) => (
                <View key={`c-${rowIndex}-${cellIndex}`} style={[styles.cell, cellIndex === row.length - 1 && styles.cellLast]}>
                  <Text style={styles.cellText}>{cellText}</Text>
                </View>
              ))}
            </View>
          ))}

        </View>
      </ScrollView>
    </View>
  );
};

export const TableWrapper = ({ node, children }) => {
  return <MarkdownTable node={node}>{children}</MarkdownTable>;
};

export const TableRow = ({ children }) => <View style={{ flexDirection: 'row' }}>{children}</View>;
export const TableCell = ({ children }) => <View>{children}</View>;

export default TableWrapper;

const GREY_CARD = '#2D2D31';
const GREY_HEADER = '#39393E';
const HAIRLINE = 'rgba(255,255,255,0.08)';
const ACCENT = '#F05A28';

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 12,
    borderRadius: 16,
    backgroundColor: GREY_CARD,
    overflow: 'hidden',
    width: '100%',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: GREY_HEADER,
  },
  topBarTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A6A6AB',
    letterSpacing: 0.5,
  },
  copyText: {
    fontSize: 12,
    fontWeight: '600',
    color: ACCENT,
  },
  tableContainer: {
    flexDirection: 'column',
    flexGrow: 1,
  },
  
  // ROWS
  headerRow: {
    flexDirection: 'row',
    backgroundColor: GREY_HEADER,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
    minHeight: MIN_ROW_HEIGHT,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
    minHeight: MIN_ROW_HEIGHT,
  },
  rowEven: { backgroundColor: 'transparent' },
  rowOdd: { backgroundColor: 'rgba(255,255,255,0.03)' }, // Zebra stripe

  // CELLS
  cell: {
    flex: 1,
    minWidth: COL_WIDTH,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRightWidth: 1,
    borderRightColor: HAIRLINE,
    justifyContent: 'center',
    alignItems: 'flex-start', // Text aligns left
  },
  cellLast: {
    borderRightWidth: 0,
  },

  // TEXT
  headerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cellText: {
    fontSize: 12,
    color: '#DDDDDD',
    lineHeight: 18,
  },
});
