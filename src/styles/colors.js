// App palette: black background, flat grey surfaces, one orange accent.
// Every value is a plain 6-digit hex because some callers append an alpha
// suffix (for example `colors.primary + '20'`).
export const colors = {
  // Background colors
  background: '#000000',          // Main app background
  surface: '#2D2D31',             // Card/surface background
  surfaceElevated: '#39393E',     // Raised surfaces, card header strips
  surfaceInset: '#232326',        // Buttons and tiles that sit inside a card

  // Text colors
  text: '#ffffff',                // Primary text
  textSecondary: '#A6A6AB',       // Secondary text
  textMuted: '#8E8E93',           // Muted text

  // Border colors
  border: '#39393E',              // Default borders
  borderLight: '#4A4A50',         // Light borders
  borderDark: '#232326',          // Dark borders

  // Accent colors
  primary: '#F05A28',             // The single accent
  primaryDark: '#D94E20',         // Pressed accent
  accent: '#F05A28',              // Same accent, legacy name
  success: '#10b981',             // Green
  warning: '#f59e0b',             // Amber
  error: '#ef4444',               // Red

  // Message bubble colors
  userBubble: '#F05A28',          // User message background
  assistantBubble: '#2D2D31',     // Assistant message background
  userText: '#ffffff',            // User message text
  assistantText: '#ffffff',       // Assistant message text

  // Input colors
  inputBackground: '#2D2D31',     // Input field background
  inputBorder: '#39393E',         // Input field border
  inputText: '#ffffff',           // Input text
  placeholder: '#96969C',         // Placeholder text

  // Button colors
  buttonPrimary: '#F05A28',       // Primary button
  buttonSecondary: '#2D2D31',     // Secondary button
  buttonText: '#ffffff',          // Button text

  // Header colors
  headerBackground: '#000000',    // Header background
  headerBorder: '#39393E',        // Header border

  // Private mode colors
  privateBackground: '#2D2D31',   // Private mode background
  privateBorder: '#39393E',       // Private mode border
  privateText: '#A6A6AB',         // Private mode text
};
