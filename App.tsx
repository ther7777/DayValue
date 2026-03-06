import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SQLiteProvider } from 'expo-sqlite';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { useFonts, PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { initDB } from './src/database';
import { CategoriesProvider } from './src/contexts/CategoriesContext';
import { CustomSplashScreen } from './src/components';
import {
  DashboardScreen,
  SettingsScreen,
  AddEditItemScreen,
  AddEditSubscriptionScreen,
  AddEditStoredCardScreen,
  ItemDetailScreen,
  SubscriptionDetailScreen,
  CategoriesScreen,
  StatisticsScreen,
} from './src/screens';
import type { RootStackParamList } from './src/types';
import { THEME } from './src/utils/constants';

// 阻止原生 Splash 自动隐藏，必须在模块顶部同步调用。
SplashScreen.preventAutoHideAsync().catch(() => {
  // 开发模式下可能重复初始化，忽略即可。
});

const Stack = createNativeStackNavigator<RootStackParamList>();

const screenOptions: NativeStackNavigationOptions = {
  headerStyle: {
    backgroundColor: THEME.colors.primary,
  },
  headerTintColor: '#FFFFFF',
  headerTitleStyle: {
    fontWeight: '700',
    fontSize: THEME.fontSize.lg,
  },
  statusBarStyle: 'light',
  statusBarBackgroundColor: THEME.colors.primary,
  statusBarAnimation: 'fade',
  contentStyle: {
    backgroundColor: THEME.colors.background,
  },
};

function LoadingFallback() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={THEME.colors.primary} />
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({ PressStart2P_400Regular });
  const [splashDone, setSplashDone] = useState(false);

  if (!fontsLoaded) {
    return <LoadingFallback />;
  }

  return (
    <>
      <React.Suspense fallback={<LoadingFallback />}>
        <SQLiteProvider databaseName="dayvalue.db" onInit={initDB}>
          <CategoriesProvider>
            <SafeAreaProvider>
              <NavigationContainer>
                <Stack.Navigator screenOptions={screenOptions}>
                  <Stack.Screen
                    name="Dashboard"
                    component={DashboardScreen}
                    options={{
                      headerShown: false,
                      statusBarStyle: 'light',
                      statusBarBackgroundColor: 'transparent',
                      statusBarTranslucent: true,
                    }}
                  />
                  <Stack.Screen
                    name="Settings"
                    component={SettingsScreen}
                    options={{ title: '设置' }}
                  />
                  <Stack.Screen
                    name="AddEditItem"
                    component={AddEditItemScreen}
                    options={{ title: '添加物品' }}
                  />
                  <Stack.Screen
                    name="AddEditSubscription"
                    component={AddEditSubscriptionScreen}
                    options={{ title: '添加订阅' }}
                  />
                  <Stack.Screen
                    name="ItemDetail"
                    component={ItemDetailScreen}
                    options={{ title: '物品详情' }}
                  />
                  <Stack.Screen
                    name="SubscriptionDetail"
                    component={SubscriptionDetailScreen}
                    options={{ title: '订阅详情' }}
                  />
                  <Stack.Screen
                    name="Categories"
                    component={CategoriesScreen}
                    options={{ title: '分类管理' }}
                  />
                  <Stack.Screen
                    name="Statistics"
                    component={StatisticsScreen}
                    options={{ title: '统计' }}
                  />
                  <Stack.Screen
                    name="AddEditStoredCard"
                    component={AddEditStoredCardScreen}
                    options={{ title: '新增储值卡' }}
                  />
                </Stack.Navigator>
              </NavigationContainer>
            </SafeAreaProvider>
          </CategoriesProvider>
        </SQLiteProvider>
      </React.Suspense>

      {/* CRT TV Off 过渡动画覆盖层，absoluteFill 叠在导航之上。 */}
      {!splashDone && (
        <CustomSplashScreen onAnimationEnd={() => setSplashDone(true)} />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.colors.background,
  },
});
