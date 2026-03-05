import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  Platform,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

interface CustomSplashScreenProps {
  onAnimationEnd: () => void;
}

/**
 * CRT TV Off 复古过渡动画
 *
 * 视觉流程：
 * 1. 显示 AndroidStart.png 静态画面 0.8s
 * 2. Stage 1 (100ms): 画面垂直压缩成一条极细的发光亮线
 * 3. Stage 2 (200ms): 亮线水平收缩至中心点消失
 * 4. 动画结束，调用 onAnimationEnd 销毁组件
 */
export default function CustomSplashScreen({ onAnimationEnd }: CustomSplashScreenProps) {
  const scaleY = useRef(new Animated.Value(1)).current;
  const scaleX = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let animation: Animated.CompositeAnimation | null = null;

    const runAnimation = async () => {
      // ---- 接力：隐藏原生 Splash ----
      try {
        await SplashScreen.hideAsync();
      } catch {
        // 开发模式下可能重复调用，忽略
      }

      // ---- 安静停留 0.8s ----
      timer = setTimeout(() => {
        animation = Animated.sequence([
          // ---- Stage 1: 垂直压扁为极细亮线 (100ms) ----
          Animated.parallel([
            Animated.timing(scaleY, {
              toValue: 0.005,
              duration: 100,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(glowOpacity, {
              toValue: 1,
              duration: 100,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
          // ---- Stage 2: 水平收缩至零点消失 (200ms) ----
          Animated.parallel([
            Animated.timing(scaleX, {
              toValue: 0,
              duration: 200,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(glowOpacity, {
              toValue: 0,
              duration: 200,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
        ]);

        animation.start(({ finished }) => {
          if (finished) {
            onAnimationEnd();
          }
        });
      }, 800);
    };

    runAnimation();

    // ---- Cleanup: 防止组件意外卸载时的内存泄漏 ----
    return () => {
      if (timer) clearTimeout(timer);
      if (animation) animation.stop();
    };
  }, [scaleY, scaleX, glowOpacity, onAnimationEnd]);

  return (
    <View style={styles.container}>
      {/* 启动图画面 */}
      <Animated.Image
        source={require('../../assets/AndroidStart.png')}
        style={[
          styles.image,
          {
            transform: [{ scaleY }, { scaleX }],
          },
        ]}
        resizeMode="cover"
      />

      {/* CRT 亮线发光层 —— 独立于 Image，避免被 scaleY 压到不可见 */}
      <Animated.View
        style={[
          styles.glowLine,
          {
            opacity: glowOpacity,
            transform: [{ scaleX }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  glowLine: {
    position: 'absolute',
    width: '100%',
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    // 像素风 CRT 荧光溢出效果
    ...Platform.select({
      ios: {
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 15,
      },
      android: {
        elevation: 10,
        // Android elevation 呈灰色阴影，用半透明白底增强亮线感
        borderWidth: 0.5,
        borderColor: 'rgba(255, 255, 255, 0.7)',
      },
    }),
  },
});
