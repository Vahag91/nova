import React, { useState, memo, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import Haptic from 'react-native-haptic-feedback';
import SyntaxHighlighter from 'react-native-syntax-highlighter';
// We use the 'atomOneDark' style for better contrast than vscDarkPlus on mobile
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { colors } from '../../../styles/colors';

const CodeBlock = ({ language, content }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    Clipboard.setString(content);
    Haptic.trigger('notificationSuccess');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // --- 1. SMART LANGUAGE DETECTION ---
  // If the AI forgets to label the block (sending 'text' or ''), we guess.
  const activeLanguage = useMemo(() => {
    const cleanLang = (language || '').toLowerCase().trim();
    
    // If it's already a valid language, return it
    if (cleanLang && cleanLang !== 'text' && cleanLang !== 'txt') {
      return cleanLang;
    }

    // Heuristics to guess language based on content
    const code = content.trim();
    if (code.startsWith('<') || code.includes('</div>') || code.includes('</body>')) return 'xml'; // HTML/XML
    if (code.includes('import ') || code.includes('const ') || code.includes('function ') || code.includes('=>')) return 'javascript';
    if (code.includes('def ') || code.includes('print(') || code.includes('class ')) return 'python';
    if (code.includes('struct ') || code.includes('impl ')) return 'rust';
    if (code.includes('package ') || code.includes('func ')) return 'go';
    
    return 'javascript'; // Default to JS as it looks best for generic code
  }, [language, content]);

  const langDisplay = activeLanguage.toUpperCase();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.language}>{langDisplay}</Text>
        <Pressable 
          onPress={handleCopy} 
          hitSlop={12} 
          style={({ pressed }) => [styles.copyBtn, pressed && { opacity: 0.6 }]}
        >
          <Text style={[styles.copyText, copied && styles.copyTextSuccess]}>
            {copied ? 'Copied' : 'Copy'}
          </Text>
        </Pressable>
      </View>

      {/* Syntax Highlighter */}
      <SyntaxHighlighter
        language={activeLanguage}
        style={atomOneDark}
        customStyle={styles.highlighter}
        fontSize={13}
        fontFamily={Platform.OS === 'ios' ? 'Menlo-Regular' : 'monospace'}
        highlighter="hljs" // Use hljs for better auto-detection support if needed
        PreTag={View}
        CodeTag={View}
        // Force wrap to prevent horizontal scrolling issues on small screens if desired
        // wrapLongLines={true} 
      >
        {content.replace(/\n$/, '')} 
      </SyntaxHighlighter>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#1E1E1E', // Dark background
    width: '100%',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#2D2D2D', // Slightly lighter header
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  language: {
    color: '#A9A9A9',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  copyBtn: {
    padding: 4,
  },
  copyText: {
    color: colors.primary, // Use your app's primary color
    fontSize: 12,
    fontWeight: '600',
  },
  copyTextSuccess: {
    color: '#4BB543',
  },
  highlighter: {
    padding: 16,
    margin: 0,
    backgroundColor: '#1E1E1E', // Match container
  },
});

export default memo(CodeBlock);