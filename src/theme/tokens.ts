/**
 * Design tokens from the "Organic" design system used in the Claude Design
 * handoff (docs/design/handoff). Values are final intent.
 */
export const palette = {
  bg: '#f5ead8',
  surface: '#ebddc5',
  text: '#201e1d',
  divider: 'rgba(32, 30, 29, 0.16)',
  accent: {
    100: '#fff2eb',
    200: '#ffe1d0',
    300: '#ffc6a5',
    400: '#f6a06b',
    500: '#d67f48',
    base: '#c67139',
    600: '#b2622d',
    700: '#8c491a',
    800: '#643312',
    900: '#402310',
  },
  accent2: {
    100: '#f0fae1',
    200: '#e1eecc',
    300: '#ccdbb2',
    400: '#aebf92',
    500: '#8fa073',
    base: '#7a8a5e',
    600: '#728157',
    700: '#56633f',
    800: '#3d472b',
    900: '#272e1b',
  },
  neutral: {
    100: '#f9f4ed',
    200: '#eee7db',
    300: '#dcd3c4',
    400: '#c0b6a5',
    500: '#a19786',
    600: '#82796a',
    700: '#645c50',
    800: '#474238',
    900: '#2e2b25',
  },
  // Abby / shifts. Specified in OKLCH; these are sRGB approximations.
  honey: {
    base: '#d9b25a', // oklch(0.78 0.12 82)
    tint: '#f2dfb0', // oklch(0.90 0.07 85)
    bar: '#e9cb85', // oklch(0.85 0.09 85)
    ink: '#6b4d17', // oklch(0.40 0.08 70)
  },
} as const;

/** Person colors: [dot/fill, tint, ink]. */
export const personColors = {
  colton: [palette.accent[500], palette.accent[200], palette.accent[900]],
  kristin: [palette.accent2[500], palette.accent2[200], palette.accent2[900]],
  family: [palette.neutral[700], palette.neutral[300], palette.neutral[900]],
  abby: [palette.honey.base, palette.honey.tint, palette.honey.ink],
} as const;

export const fonts = {
  heading: 'Caprasimo', // 400, headings and big numbers
  body: 'Figtree', // 400 / 600 / 700 / 800
} as const;

export const radius = { sm: 8, md: 16, lg: 28, pill: 999, sheet: 30 } as const;

export const space = { xs: 4.4, sm: 8.8, md: 13.2, lg: 17.6, xl: 26.4, xxl: 35.2 } as const;

const shadowColor = '#2e2b25';
export const shadow = {
  sm: { shadowColor, shadowOpacity: 0.14, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  md: { shadowColor, shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
  lg: {
    shadowColor,
    shadowOpacity: 0.22,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 12 },
  },
} as const;

export const minTouchTarget = 44;
