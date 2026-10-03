import React, { useMemo } from 'react';
import { Text, Linking, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { userStyles, assistantStyles } from './markdownStyles';

export const MarkdownLink = ({ node, children, isUser }) => {
  const { t } = useTranslation();
  const url = node?.attributes?.href || '';
  const normalizedUrl = useMemo(() => {
    if (!url) return '';
    if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
    return `https://${url}`;
  }, [url]);

  const textContent = useMemo(() => {
    if (node?.content) return node.content;
    return React.Children.toArray(children)
      .filter(c => typeof c === 'string')
      .join('')
      .trim();
  }, [node?.content, children]);

  const onPress = () => {
    if (normalizedUrl) Linking.openURL(normalizedUrl).catch(() => {});
  };

  const isWiki = normalizedUrl.includes('wikipedia.org');
  const isYoutube = normalizedUrl.includes('youtube.com') || normalizedUrl.includes('youtu.be');

  const parsed = useMemo(() => {
    try {
      const u = new URL(normalizedUrl);
      return { domain: u.hostname.replace(/^www\./, ''), path: u.pathname };
    } catch (e) {
      return { domain: url, path: '' };
    }
  }, [normalizedUrl, url]);

  const title = useMemo(() => {
    if (textContent) return textContent;
    if (isWiki && parsed.path) {
      const slug = parsed.path.split('/').pop() || '';
      return decodeURIComponent(slug.replace(/_/g, ' ')) || t('chat.markdown.wikipedia');
    }
    return parsed.domain || t('chat.markdown.link');
  }, [textContent, isWiki, parsed, t]);

  const baseStyle = isUser ? userStyles.link : assistantStyles.link;
  const linkColor = isUser ? '#FFFFFF' : '#F05A28';

  if (isWiki) {
    return (
      <Text style={[baseStyle, styles.inlineLink]} onPress={onPress}>
        <Text style={styles.wikiGlyph}>⌁</Text>
        <Text style={styles.linkLabel}> {title} </Text>
        <Text style={[styles.arrow, { color: linkColor }]}>↗</Text>
      </Text>
    );
  }

  if (isYoutube) {
    return (
      <Text style={[baseStyle, styles.inlineLink]} onPress={onPress}>
        <Text style={[styles.playGlyph, { color: '#FF6B6B' }]}>▶</Text>
        <Text style={styles.linkLabel}> {t('chat.markdown.watchVideo')} </Text>
        <Text style={[styles.arrow, { color: linkColor }]}>↗</Text>
      </Text>
    );
  }

  return (
    <Text style={[baseStyle, styles.inlineLink]} onPress={onPress}>
      <Text style={styles.linkLabel}>{title || parsed.domain} </Text>
      <Text style={[styles.arrow, { color: linkColor }]}>↗</Text>
    </Text>
  );
};

const styles = StyleSheet.create({
  inlineLink: {
    textDecorationLine: 'none',
    fontWeight: '600',
  },
  linkLabel: {
    textDecorationLine: 'none',
  },
  arrow: {
    fontSize: 12,
    textDecorationLine: 'none',
  },
  wikiGlyph: {
    fontWeight: '800',
    color: '#5FBFF9',
    textDecorationLine: 'none',
  },
  playGlyph: {
    fontWeight: '800',
    textDecorationLine: 'none',
  },
});
