import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
  ActivityIndicator,
} from 'react-native';
import { THEME } from '../utils/constants';

interface PixelButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'accent' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function PixelButton({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  style,
}: PixelButtonProps) {
  const bgColor: Record<string, string> = {
    primary: THEME.colors.primary,
    accent: THEME.colors.accent,
    danger: THEME.colors.danger,
    outline: 'transparent',
  };

  const textColor = variant === 'outline' ? THEME.colors.primary : '#FFFFFF';

  const sizeStyles: Record<string, { pv: number; ph: number; fs: number }> = {
    sm: { pv: 6, ph: 12, fs: THEME.fontSize.sm },
    md: { pv: 10, ph: 20, fs: THEME.fontSize.md },
    lg: { pv: 14, ph: 28, fs: THEME.fontSize.lg },
  };

  const s = sizeStyles[size];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[
        styles.base,
        {
          backgroundColor: disabled ? THEME.colors.textLight : bgColor[variant],
          paddingVertical: s.pv,
          paddingHorizontal: s.ph,
          borderColor: variant === 'outline' ? THEME.colors.primary : THEME.colors.borderDark,
        },
        THEME.pixelShadow as ViewStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <Text style={[styles.text, { color: textColor, fontSize: s.fs }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    ...THEME.pixelBorder,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  text: {
    fontWeight: '700',
    letterSpacing: 0.5,
  } as TextStyle,
});
