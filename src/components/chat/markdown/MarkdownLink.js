import React, { useMemo } from 'react';
import { Text, Linking, StyleSheet } from 'react-native';
import { colors } from '../../../styles/colors';
import { userStyles, assistantStyles } from './markdownStyles';

export const MarkdownLink = ({ node, children, isUser }) => {
  const url = node?.attributes?.href || '';

  const textContent = useMemo(() => {
    if (node?.content) return node.content;
    return React.Children.toArray(children)
      .filter((c) => typeof c === 'string')
      .join('')
      .trim();
  }, [node?.content, children]);

  const onPress = () => {
    if (url) Linking.openURL(url).catch(() => {});
  };

  const isWiki = url.includes('wikipedia.org');
  const isYoutube = url.includes('youtube.com') || url.includes('youtu.be');

  const parsed = useMemo(() => {
    try {
      const u = new URL(url);
      return { domain: u.hostname.replace(/^www\./, ''), path: u.pathname };
    } catch (e) {
      return { domain: url, path: '' };
    }
  }, [url]);

  const title = useMemo(() => {
    if (textContent) return textContent;
    if (isWiki && parsed.path) {
      const t = parsed.path.split('/').pop() || '';
      return decodeURIComponent(t.replace(/_/g, ' ')) || 'Wikipedia';
    }
    return parsed.domain || 'Link';
  }, [textContent, isWiki, parsed]);

  const baseStyle = isUser ? userStyles.link : assistantStyles.link;
  const linkColor = isUser ? '#FFFFFF' : colors.primary;

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
        <Text style={styles.linkLabel}> Watch Video </Text>
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
