/**
 * PixelGridBackground - 像素网格纹理背景
 *
 * 使用一张 8×8 极小 PNG 瓦片通过 ImageBackground repeat 方式铺满，
 * 替代 SVG Pattern 方案，解决 FlatList 长列表场景下安卓中低端机的滑动掉帧问题。
 *
 * 性能对比：
 *  - SVG Pattern：每帧都需要 SVG 引擎光栅化 → 掉帧
 *  - PNG repeat ：原生 Bitmap 平铺，GPU 零开销 → 丝滑
 */
import React from 'react';
import { ImageBackground, StyleSheet, type ViewStyle } from 'react-native';
import { THEME } from '../utils/constants';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pixelGridTile = require('../../assets/pixel-grid-tile.png');

interface PixelGridBackgroundProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function PixelGridBackground({ children, style }: PixelGridBackgroundProps) {
  return (
    <ImageBackground
      source={pixelGridTile}
      resizeMode="repeat"
      style={[styles.container, style]}
      imageStyle={styles.image}
    >
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  image: {
    opacity: 0.6,
  },
});
