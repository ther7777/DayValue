import type { CategoryInfo } from '../types';

// ===================== 预设分类 =====================

export const CATEGORIES: CategoryInfo[] = [
  { id: 'digital', name: '数码', icon: '📱' },
  { id: 'computer', name: '电脑', icon: '💻' },
  { id: 'home', name: '居家', icon: '🏠' },
  { id: 'transport', name: '出行', icon: '🚗' },
  { id: 'clothing', name: '服饰', icon: '👔' },
  { id: 'entertainment', name: '娱乐', icon: '🎮' },
  { id: 'software', name: '软件', icon: '💿' },
  { id: 'education', name: '学习', icon: '📚' },
  { id: 'sports', name: '运动', icon: '⚽' },
  { id: 'other', name: '其他', icon: '📦' },
];

/** 通过 categoryId 获取分类信息，找不到则返回"其他" */
export function getCategoryInfo(categoryId: string): CategoryInfo {
  return CATEGORIES.find(c => c.id === categoryId) ?? CATEGORIES[CATEGORIES.length - 1];
}

// ===================== 清新像素风主题 =====================

export const THEME = {
  colors: {
    primary: '#6C5CE7',
    primaryLight: '#A29BFE',
    accent: '#00CEC9',
    accentLight: '#81ECEC',
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
