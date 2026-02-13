// Design tokens from design_guidelines.json
export const colors = {
  primary: '#3B82F6',
  primaryHover: '#2563EB',
  primaryForeground: '#FFFFFF',
  bg: '#0F172A',
  bgSecondary: '#1E293B',
  bgTertiary: '#334155',
  fg: '#F8FAFC',
  fgMuted: '#94A3B8',
  fgInverse: '#0F172A',
  border: 'rgba(255, 255, 255, 0.1)',
  borderActive: 'rgba(59, 130, 246, 0.5)',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  badgeBg: 'rgba(59, 130, 246, 0.2)',
  badgeText: '#60A5FA',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 30,
  xxxxl: 36,
};

export const layout = {
  cardRadius: 8,
  buttonRadius: 6,
  inputHeight: 48,
  containerPadding: 16,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
};
