import React, { memo, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import Haptic from 'react-native-haptic-feedback';
import SyntaxHighlighter from 'react-native-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../styles/colors';

const CodeBlock = ({ language, content }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    Clipboard.setString(content);
    Haptic.trigger('notificationSuccess');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeLanguage = useMemo(() => {
    const cleanLang = (language || '').toLowerCase().trim();
    if (cleanLang && cleanLang !== 'text' && cleanLang !== 'txt') {
      return cleanLang;
    }

    const code = content.trim();
    if (code.startsWith('<') || code.includes('</div>') || code.includes('</body>')) return 'xml';
    if (code.includes('import ') || code.includes('const ') || code.includes('function ') || code.includes('=>')) return 'javascript';
    if (code.includes('def ') || code.includes('print(') || code.includes('class ')) return 'python';
    if (code.includes('struct ') || code.includes('impl ')) return 'rust';
    if (code.includes('package ') || code.includes('func ')) return 'go';

    return 'javascript';
  }, [language, content]);

  const langDisplay = activeLanguage.toUpperCase();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.language}>{langDisplay}</Text>
        <Pressable onPress={handleCopy} hitSlop={12} style={({ pressed }) => [styles.copyBtn, pressed && { opacity: 0.6 }]}>
          <Text style={[styles.copyText, copied && styles.copyTextSuccess]}>
            {copied ? t('chat.markdown.copied') : t('chat.markdown.copy')}
          </Text>
        </Pressable>
      </View>

      <SyntaxHighlighter
        language={activeLanguage}
        style={atomOneDark}
        customStyle={styles.highlighter}
        fontSize={13}
        fontFamily="monospace"
        highlighter="hljs"
        PreTag={View}
        CodeTag={View}
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
    backgroundColor: '#1E1E1E',
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
    backgroundColor: '#2D2D2D',
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
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  copyTextSuccess: {
    color: '#4BB543',
  },
  highlighter: {
    padding: 16,
    margin: 0,
    backgroundColor: '#1E1E1E',
  },
});

export default memo(CodeBlock);
