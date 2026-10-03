import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { graphite } from '../../../styles/graphite';

const AlertIcon = ({ tone }) => {
  const color = tone === 'warn' ? graphite.accent : graphite.textSecondary;
  const path = tone === 'warn' 
    ? "M12 2L1 21h22L12 2zm1 17h-2v-2h2v2zm0-4h-2v-4h2v4z" 
    : "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z";
  
  return (
    <Svg height={20} width={20} viewBox="0 0 24 24" fill={color} style={{ marginRight: 8, marginTop: 2 }}>
      <Path d={path} />
    </Svg>
  );
};

export const MarkdownBlockquote = ({ node, children }) => {
  const { t } = useTranslation();
  // Detect [!WARNING], [!NOTE], [!TIP]
  // We look deep into the children to find the text content
  const rawText = String(node?.children?.[0]?.children?.[0]?.content || node?.children?.[0]?.content || '');
  
  let tone = 'note';
  let title = t('chat.markdown.note');
  
  if (rawText.includes('[!WARNING]') || rawText.includes('⚠')) {
    tone = 'warn';
    title = t('chat.markdown.warning');
  } else if (rawText.includes('[!TIP]') || rawText.includes('💡')) {
    tone = 'tip';
    title = t('chat.markdown.tip');
  }
  
  const titleColor = tone === 'warn' ? graphite.accent : graphite.text;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <AlertIcon tone={tone} />
        <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
      </View>
      <View>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 14,
    // The last paragraph inside brings its own bottom margin.
    paddingBottom: 2,
    borderRadius: 16,
    marginVertical: 12,
    backgroundColor: graphite.card,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  title: { fontWeight: 'bold', fontSize: 14, marginBottom: 2 },
});
