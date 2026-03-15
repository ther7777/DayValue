import type { CategoryInfo } from '../types';

export const CATEGORIES: CategoryInfo[] = [
  { id: 'digital', name: '数码设备', icon: '📱' },
  { id: 'computer', name: '电脑办公', icon: '💻' },
  { id: 'home', name: '家电家居', icon: '🏠' },
  { id: 'transport', name: '出行装备', icon: '🚗' },
  { id: 'clothing', name: '穿戴配件', icon: '⌚' },
  { id: 'entertainment', name: '影音游戏', icon: '🎮' },
  { id: 'software', name: '软件服务', icon: '💿' },
  { id: 'education', name: '学习设备', icon: '🎓' },
  { id: 'sports', name: '运动器材', icon: '🏋️' },
  { id: 'other', name: '其他资产', icon: '📦' },
];

export function getCategoryInfo(categoryId: string): CategoryInfo {
  return CATEGORIES.find(category => category.id === categoryId) ?? CATEGORIES[CATEGORIES.length - 1];
}

export const THEME = {
  colors: {
    primary: '#6C5CE7',
    primaryLight: '#A29BFE',
    primaryDark: '#4834D4',
    accent: '#00CEC9',
    accentLight: '#81ECEC',
    highlight: '#FFD93D',
    highlightMuted: '#FFF3CD',
    danger: '#FF7675',
    dangerDark: '#D63031',
    warning: '#FDCB6E',
    success: '#00B894',
    background: '#F0F3FA',
    surface: '#FFFFFF',
    textPrimary: '#2D3436',
    textSecondary: '#636E72',
    textLight: '#B2BEC3',
    border: '#DFE6E9',
    borderDark: '#2D3436',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  fontSize: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 18,
    xl: 22,
    xxl: 28,
  },
  borderRadius: 6,
  pixelBorder: {
    borderWidth: 2,
    borderColor: '#2D3436',
    borderRadius: 6,
  },
  pixelShadow: {
    shadowColor: '#2D3436',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 0,
    elevation: 3,
  },
  fontFamily: {
    pixel: 'PressStart2P_400Regular',
  },
} as const;
