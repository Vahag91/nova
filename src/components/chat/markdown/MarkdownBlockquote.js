import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const AlertIcon = ({ tone }) => {
  const color = tone === 'warn' ? '#FFB74D' : tone === 'tip' ? '#4CAF50' : '#64B5F6';
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
  // Detect [!WARNING], [!NOTE], [!TIP]
  // We look deep into the children to find the text content
  const rawText = String(node?.children?.[0]?.children?.[0]?.content || node?.children?.[0]?.content || '');
  
  let tone = 'note';
  let title = 'Note';
  
  if (rawText.includes('[!WARNING]') || rawText.includes('⚠')) { tone = 'warn'; title = 'Warning'; }
  else if (rawText.includes('[!TIP]') || rawText.includes('💡')) { tone = 'tip'; title = 'Tip'; }
  
  const borderColor = tone === 'warn' ? '#FFB74D' : tone === 'tip' ? '#4CAF50' : '#42A5F5';
  const bgColor = tone === 'warn' ? '#332200' : tone === 'tip' ? '#002200' : '#111b26';
console.log("worked blockquote");

  return (
    <View style={[styles.container, { borderLeftColor: borderColor, backgroundColor: bgColor }]}>
      <View style={styles.header}>
        <AlertIcon tone={tone} />
        <Text style={[styles.title, { color: borderColor }]}>{title}</Text>
      </View>
      <View>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderLeftWidth: 4,
    padding: 12,
    borderRadius: 8,
    marginVertical: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  title: { fontWeight: 'bold', fontSize: 14, marginBottom: 2 },
});