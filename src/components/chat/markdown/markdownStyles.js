import { StyleSheet } from 'react-native';
import { graphite } from '../../../styles/graphite';

export const baseStyles = {
  body: {
    fontSize: 16,
    lineHeight: 25,
    letterSpacing: 0.1,
  },
  heading1: {
    fontSize: 24,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 12,
    lineHeight: 31,
    letterSpacing: -0.2,
  },
  heading2: {
    fontSize: 21,
    fontWeight: '600',
    marginTop: 22,
    marginBottom: 10,
    lineHeight: 28,
    letterSpacing: -0.1,
  },
  heading3: {
    fontSize: 19,
    fontWeight: '600',
    marginTop: 18,
    marginBottom: 8,
    lineHeight: 26,
  },
  heading4: {
    fontSize: 17,
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 8,
    lineHeight: 24,
  },
  heading5: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 6,
    lineHeight: 24,
  },
  heading6: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 6,
    lineHeight: 20,
  },
  paragraph: {
    marginBottom: 14,
    paddingRight: 8,
    fontSize: 16,
    lineHeight: 25,
  },
  strong: { fontWeight: '600' },
  em: { fontStyle: 'italic' },
  s: { textDecorationLine: 'line-through' },
  blockquote: {
    backgroundColor: graphite.card,
    borderRadius: 16,
    marginLeft: 0,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  hr: { height: 1, backgroundColor: '#333', marginVertical: 24 },
  listContainer: {
    paddingLeft: 12,
    marginBottom: 8,
  },
  listItemContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  contentContainer: {
    flex: 1,
    width: 0,
  },
  bulletPoint: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: 'bold',
    minWidth: 20,
    color: '#8E8E93',
  },
};

export const assistantStyles = StyleSheet.create({
  ...baseStyles,
  body: { ...baseStyles.body, color: '#EDEDEF' },
  heading1: { ...baseStyles.heading1, color: '#FFFFFF' },
  heading2: { ...baseStyles.heading2, color: '#f9f8f8' },
  heading3: { ...baseStyles.heading3, color: '#f0f0f0' },
  heading4: { ...baseStyles.heading4, color: '#e0e0e0' },
  heading5: { ...baseStyles.heading5, color: '#e0e0e0' },
  heading6: { ...baseStyles.heading6, color: '#e0e0e0' },
  paragraph: { ...baseStyles.paragraph, color: '#EDEDEF' },
  strong: { ...baseStyles.strong, color: '#FFFFFF' },
  em: { ...baseStyles.em, color: '#E0E0E0' },
  s: { ...baseStyles.s, color: '#A0A0A0' },
  blockquote: baseStyles.blockquote,
  code_inline: {
    backgroundColor: graphite.card,
    color: '#FFFFFF',
    fontFamily: 'monospace',
    borderRadius: 6,
    paddingHorizontal: 5,
    fontSize: 14,
  },
  link: { color: graphite.accent, textDecorationLine: 'underline' },
});

export const userStyles = StyleSheet.create({
  body: {
    fontSize: 16,
    lineHeight: 23,
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  paragraph: {
    marginBottom: 0,
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 24,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});
