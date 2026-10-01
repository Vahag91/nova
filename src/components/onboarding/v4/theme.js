/**
 * Palette for the workspace onboarding (v4).
 *
 * Ported from the SwiftUI onboarding theme the iOS build shipped with, so the
 * two platforms stay visually identical. Colours are literals on purpose: the
 * app has no theme provider, and onboarding runs before any of it mounts.
 */
import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

export const rgba = (r, g, b, a = 1) => `rgba(${r}, ${g}, ${b}, ${a})`;

// Only Lato ships with the app, so weight has to come from the family name.
export const FONT = {
  regular: 'Lato-Regular',
  bold: 'Lato-Bold',
};

export const BRAND = {
  tiffany: '#0ABAB5',
  tiffanyBright: '#3CDDD6',
  graphite: [14, 31, 31],
  deepTitle: '#024947',
  button: '#03736F',
  accentLight: '#047672',
  deepTeal: [6, 127, 123],
};

// Accent per goal card.
export const GOAL_ACCENT = {
  orange: '#FF9433',
  red: '#FF5E54',
  yellow: '#FFCC45',
  cyan: '#40C7FF',
  purple: '#1ABAB5',
};

const DEMO_ACCENT = {
  light: {
    doc: '#B96818',
    img: '#6656C5',
    reply: '#6656C5',
    translation: '#1677A8',
  },
  dark: {
    doc: '#FFB45C',
    img: '#AA9CFF',
    reply: '#AA9CFF',
    translation: '#63C2F2',
  },
};

export function useOnboardingTheme(forcedScheme) {
  const system = useColorScheme();
  const scheme = forcedScheme || system || 'light';
  const isDark = scheme === 'dark';

  return useMemo(() => {
    const text = o => (isDark ? rgba(255, 255, 255, o) : rgba(...BRAND.graphite, o));

    return {
      isDark,
      // Identical to the paywall/app shell background: the paywall cross-fades
      // in over this surface, and any delta would read as a flash.
      backdrop: isDark ? '#05070A' : '#ECF8F6',
      primaryText: isDark ? rgba(255, 255, 255, 1) : rgba(...BRAND.graphite, 0.96),
      secondaryText: isDark ? rgba(255, 255, 255, 0.58) : rgba(...BRAND.graphite, 0.74),
      mutedText: isDark ? rgba(255, 255, 255, 0.42) : rgba(...BRAND.graphite, 0.5),
      titleColor: isDark ? BRAND.tiffanyBright : BRAND.deepTitle,
      titleGradient: isDark
        ? [BRAND.tiffanyBright, BRAND.tiffany, rgba(255, 255, 255, 0.92)]
        : [BRAND.deepTitle, BRAND.deepTitle],
      cardFill: isDark
        ? [rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.03)]
        : ['#FFFFFF', '#FFFFFF'],
      cardSolid: isDark ? rgba(255, 255, 255, 0.05) : '#FFFFFF',
      cardStroke: isDark ? rgba(255, 255, 255, 0.16) : rgba(2, 73, 71, 0.14),
      bubbleFill: isDark ? rgba(255, 255, 255, 0.05) : '#F4F8F8',
      buttonFill: isDark
        ? [rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0.18)]
        : [BRAND.button, BRAND.button],
      buttonSolid: isDark ? rgba(255, 255, 255, 0.24) : BRAND.button,
      accent: isDark ? BRAND.tiffany : BRAND.accentLight,
      demoAccent: isDark ? DEMO_ACCENT.dark : DEMO_ACCENT.light,
      controlFill: isDark ? rgba(255, 255, 255, 0.075) : rgba(255, 255, 255, 0.88),
      progressActive: isDark ? rgba(255, 255, 255, 0.82) : rgba(...BRAND.deepTeal, 0.88),
      progressInactive: isDark ? rgba(255, 255, 255, 0.13) : rgba(...BRAND.graphite, 0.15),
      shadowOpacity: isDark ? 0.28 : 0.1,
      text,
    };
  }, [isDark]);
}
