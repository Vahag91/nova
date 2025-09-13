// Utility function to convert hex to rgba
export const hexToRgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const LightColors = {
  primary: '#7950F2',
  secondary: '#FFFFFF',
  tertiary: '#F7F7F8',
  textPrimary: '#1A1A1A',
  textSecondary: '#4A4A4A',
  accent: '#EC4899',
  gradientStart: '#F7F7F8',
  gradientEnd: '#FFFFFF',
  black: '#000000',
  gray: {
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
  },
  transparent: 'transparent',
  // New overlay colors for glass effects
  overlay: {
    secondary50: 'rgba(255, 255, 255, 0.5)',
    secondary80: 'rgba(255, 255, 255, 0.8)',
  },
  // Border colors
  border: {
    top: 'rgba(0, 0, 0, 0.05)',
    bottom: 'rgba(0, 0, 0, 0.05)',
  },
};

export const DarkColors = {
  primary: '#7950F2',
  secondary: '#0D1221',
  tertiary: '#1A1F2E',
  textPrimary: '#FFFFFF',
  textSecondary: '#94A3B8',
  accent: '#EC4899',
  gradientStart: '#0D1221',
  gradientEnd: '#0A0F1A',
  black: '#000000',
  gray: {
    300: '#4D4D5A',
    400: '#6B6B78',
    500: '#94A3B8',
  },
  transparent: 'transparent',
  // New overlay colors for glass effects
  overlay: {
    secondary50: 'rgba(13, 18, 33, 0.5)',
    secondary80: 'rgba(13, 18, 33, 0.8)',
  },
  // Border colors
  border: {
    top: 'rgba(255, 255, 255, 0.1)',
    bottom: 'rgba(255, 255, 255, 0.1)',
  },
};

export const getColors = (isDarkMode) => {
  return isDarkMode ? DarkColors : LightColors;
};

export const getGradients = (isDarkMode) => {
  const colors = getColors(isDarkMode);
  return {
    primary: [colors.primary, colors.accent],
    background: [colors.gradientStart, colors.gradientEnd],
  };
};
