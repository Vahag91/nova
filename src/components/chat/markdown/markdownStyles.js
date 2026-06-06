import { StyleSheet } from 'react-native';
import { colors } from '../../../styles/colors';

export const baseStyles = {
  body: {
    fontSize: 16,
    lineHeight: 28,
    letterSpacing: 0.3,
  },
  heading1: {
    fontSize: 26,
    fontWeight: '800',
    marginTop: 24,
    marginBottom: 16,
    lineHeight: 34,
  },
  heading2: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 12,
    lineHeight: 30,
  },
  heading3: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 10,
    lineHeight: 28,
  },
  heading4: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 8,
    lineHeight: 26,
  },
  heading5: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 6,
    lineHeight: 24,
  },
  heading6: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 6,
    lineHeight: 20,
  },
  paragraph: {
    marginBottom: 16,
    paddingRight: 16,
    fontSize: 16,
    lineHeight: 28,
  },
  strong: { fontWeight: 'bold' },
  em: { fontStyle: 'italic' },
  s: { textDecorationLine: 'line-through' },
  blockquote: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderLeftWidth: 4,
    marginLeft: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
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
    lineHeight: 28,
    fontWeight: 'bold',
    minWidth: 20,
    color: '#888',
  },
};

export const assistantStyles = StyleSheet.create({
  ...baseStyles,
  body: { ...baseStyles.body, color: '#E0E0E0' },
  heading1: { ...baseStyles.heading1, color: '#FFFFFF' },
  heading2: { ...baseStyles.heading2, color: '#f9f8f8' },
  heading3: { ...baseStyles.heading3, color: '#f0f0f0' },
  heading4: { ...baseStyles.heading4, color: '#e0e0e0' },
  heading5: { ...baseStyles.heading5, color: '#e0e0e0' },
  heading6: { ...baseStyles.heading6, color: '#e0e0e0' },
  paragraph: { ...baseStyles.paragraph, color: '#E0E0E0' },
  strong: { ...baseStyles.strong, color: '#FFFFFF' },
  em: { ...baseStyles.em, color: '#E0E0E0' },
  s: { ...baseStyles.s, color: '#A0A0A0' },
  blockquote: { ...baseStyles.blockquote, borderColor: '#6C757D' },
  code_inline: {
    backgroundColor: '#2D2D2D',
    color: '#FF79C6',
    fontFamily: 'monospace',
    borderRadius: 4,
    paddingHorizontal: 5,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#3E3E3E',
  },
  link: { color: colors.primary, textDecorationLine: 'underline' },
});

export const userStyles = StyleSheet.create({
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
  paragraph: {
    marginBottom: -4,
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 24,
    paddingHorizontal: 2,
    paddingVertical: 5,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});
