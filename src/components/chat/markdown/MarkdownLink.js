import React, { useMemo } from 'react';
import { Text, Linking, StyleSheet, Platform } from 'react-native';
import { colors } from '../../../styles/colors';
import { userStyles, assistantStyles } from './markdownStyles';
import ChatText from '../ChatText';

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
  const isIosAssistant = Platform.OS === 'ios' && !isUser;
  const LinkText = isIosAssistant ? ChatText : Text;
  const outerPressProps = isIosAssistant ? {} : { onPress };
  const innerPressProps = isIosAssistant ? { onPress } : {};

  if (isWiki) {
    return (
      <LinkText style={[baseStyle, styles.inlineLink]} {...outerPressProps}>
        <LinkText style={styles.wikiGlyph} {...innerPressProps}>⌁</LinkText>
        <LinkText style={styles.linkLabel} {...innerPressProps}> {title} </LinkText>
        <LinkText style={[styles.arrow, { color: linkColor }]} {...innerPressProps}>↗</LinkText>
      </LinkText>
    );
  }

  if (isYoutube) {
    return (
      <LinkText style={[baseStyle, styles.inlineLink]} {...outerPressProps}>
        <LinkText style={[styles.playGlyph, { color: '#FF6B6B' }]} {...innerPressProps}>▶</LinkText>
        <LinkText style={styles.linkLabel} {...innerPressProps}> Watch Video </LinkText>
        <LinkText style={[styles.arrow, { color: linkColor }]} {...innerPressProps}>↗</LinkText>
      </LinkText>
    );
  }

  return (
    <LinkText style={[baseStyle, styles.inlineLink]} {...outerPressProps}>
      <LinkText style={styles.linkLabel} {...innerPressProps}>{title || parsed.domain} </LinkText>
      <LinkText style={[styles.arrow, { color: linkColor }]} {...innerPressProps}>↗</LinkText>
    </LinkText>
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
