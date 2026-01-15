import { StyleSheet, Platform } from 'react-native';
import { colors } from '../../../styles/colors';

// 1. BASE STYLES (Layouts, Sizes, Typography - NO COLORS HERE)
export const baseStyles = {
  // 'body' acts as the default container.
  // If no other style matches, text falls back to this.
  body: {
    fontSize: 16,
    lineHeight: 28,
    letterSpacing: 0.3,
  },

  // --- HEADINGS (Explicit Sizes) ---
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

  // --- PARAGRAPH ---
  paragraph: {
    marginBottom: 16,
    paddingRight: 16, // Prevents text touching screen edge
    fontSize: 16, // Explicitly set size
    lineHeight: 28,
  },

  // --- INLINE FORMATTING ---
  strong: { fontWeight: 'bold' },
  em: { fontStyle: 'italic' },
  s: { textDecorationLine: 'line-through' },

  // --- BLOCKQUOTE ---
  blockquote: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderLeftWidth: 4,
    marginLeft: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },

  // --- HORIZONTAL RULE ---
  hr: { height: 1, backgroundColor: '#333', marginVertical: 24 },

  // --- LIST STYLES (Used by your Custom List Component) ---
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
    // 1. Force the container to take available space
    flex: 1,
    // 2. THE MAGIC LINE:
    // This forces the View to ignore the text width and calculate based on the parent Row.
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

// 2. ASSISTANT STYLES (The Grey/Light Theme)
export const assistantStyles = StyleSheet.create({
  ...baseStyles,

  // --- EXPLICIT COLORS FOR EVERY ELEMENT ---

  // Default Text
  body: { ...baseStyles.body, color: '#E0E0E0' },

  // Headings
  heading1: { ...baseStyles.heading1, color: '#FFFFFF' },
  heading2: { ...baseStyles.heading2, color: '#f9f8f8' },
  heading3: { ...baseStyles.heading3, color: '#f0f0f0' },
  heading4: { ...baseStyles.heading4, color: '#e0e0e0' },
  heading5: { ...baseStyles.heading5, color: '#e0e0e0' },
  heading6: { ...baseStyles.heading6, color: '#e0e0e0' },

  // Paragraph & Inline
  paragraph: { ...baseStyles.paragraph, color: '#E0E0E0' },
  strong: { ...baseStyles.strong, color: '#FFFFFF' }, // Make bold text pop
  em: { ...baseStyles.em, color: '#E0E0E0' },
  s: { ...baseStyles.s, color: '#A0A0A0' },

  // Blockquote text usually inherits, but we can force it
  blockquote: { ...baseStyles.blockquote, borderColor: '#6C757D' },

  // Code & Links
  code_inline: {
    backgroundColor: '#2D2D2D',
    color: '#FF79C6',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    borderRadius: 4,
    paddingHorizontal: 5,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#3E3E3E',
  },
  link: { color: colors.primary, textDecorationLine: 'underline' },
});

// 3. USER STYLES (The White Theme)
// 3. USER STYLES (Simple, Clean, White Text)
// We do NOT inherit baseStyles here to prevent giant headers or complex layouts in user bubbles.
export const userStyles = StyleSheet.create({
  // The main container for user text
  body: {
    fontSize: 16,
    lineHeight: 24, // Slightly tighter than assistant for a "chat bubble" feel
    color: '#FFFFFF',
  },
  // Standard text blocks
  paragraph: {
    marginBottom: -4, // User messages usually don't need bottom margins
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 24,
    paddingHorizontal: 2,
    paddingVertical: 5,
  },
  // Catch-all for loose text
  text: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});
