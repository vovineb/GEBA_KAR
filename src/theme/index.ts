/** Design tokens: the single source for colours, spacing and type. */
export const colors = {
  brand: '#0B6E4F',
  brandPressed: '#085A40',
  brandSoft: '#E3F2EC',
  text: '#111827',
  textMuted: '#4B5563',
  textSubtle: '#6B7280',
  textInverse: '#FFFFFF',
  background: '#FFFFFF',
  surface: '#F5F6F7',
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',
  danger: '#B42318',
  dangerSoft: '#FEE4E2',
  warning: '#B54708',
  warningSoft: '#FEF0C7',
  success: '#067647',
  successSoft: '#DCFAE6',
  info: '#175CD3',
  infoSoft: '#D1E9FF',
  live: '#D92D20',
  overlay: 'rgba(17, 24, 39, 0.45)',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const type = {
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700' },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  subheading: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  caption: { fontSize: 14, lineHeight: 19, fontWeight: '400' },
  small: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
} as const;

/** Minimum touch target (Android/iOS accessibility guidance). */
export const touchTarget = 48;
