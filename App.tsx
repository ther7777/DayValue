import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts, PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';

import { initDB } from './src/database';
import { THEME } from './src/utils/constants';
import type { RootStackParamList } from './src/types';
import {
  DashboardScreen,
  AddEditItemScreen,
  AddEditSubscriptionScreen,
  ItemDetailScreen,
  SubscriptionDetailScreen,
} from './src/screens';

const Stack = createNativeStackNavigator<RootStackParamList>();

const screenOptions = {
  headerStyle: {
    backgroundColor: THEME.colors.primary,
  },
  headerTintColor: '#FFFFFF',
  headerTitleStyle: {
    fontWeight: '700' as const,
    fontSize: THEME.fontSize.lg,
  },
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

  if (!fontsLoaded) {
    return <LoadingFallback />;
  }

  return (
    <React.Suspense fallback={<LoadingFallback />}>
      <SQLiteProvider databaseName="dayvalue.db" onInit={initDB}>
        <NavigationContainer>
          <Stack.Navigator screenOptions={screenOptions}>
            <Stack.Screen
              name="Dashboard"
              component={DashboardScreen}
              options={{ headerShown: false }}
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
          </Stack.Navigator>
          <StatusBar style="light" />
        </NavigationContainer>
      </SQLiteProvider>
    </React.Suspense>
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
