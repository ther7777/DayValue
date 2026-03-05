import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import {
  createCategory as createCategoryRecord,
  deleteCategory as deleteCategoryRecord,
  getCategories,
  getCategoryUsageCount,
  updateCategory as updateCategoryRecord,
} from '../database';
import type { CategoryInfo, CategoryType } from '../types';

interface CategoriesContextValue {
  itemCategories: CategoryInfo[];
  subscriptionCategories: CategoryInfo[];
  storedCardCategories: CategoryInfo[];
  loading: boolean;
  refreshCategories: () => Promise<void>;
  createCategory: (input: { name: string; icon: string; type: CategoryType }) => Promise<void>;
  updateCategory: (input: { id: string; name: string; icon: string; type: CategoryType }) => Promise<void>;
  deleteCategory: (type: CategoryType, id: string) => Promise<void>;
  getCategoryUsageCount: (type: CategoryType, id: string) => Promise<number>;
  getCategoryInfo: (type: CategoryType, categoryId: string) => CategoryInfo;
}

const CategoriesContext = createContext<CategoriesContextValue | null>(null);

const FALLBACK_OTHER: CategoryInfo = { id: 'other', name: '其他', icon: '📦' };

export function CategoriesProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const [itemCategories, setItemCategories] = useState<CategoryInfo[]>([]);
  const [subscriptionCategories, setSubscriptionCategories] = useState<CategoryInfo[]>([]);
  const [storedCardCategories, setStoredCardCategories] = useState<CategoryInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshCategories = useCallback(async () => {
    setLoading(true);
    try {
      const [items, subs, stored] = await Promise.all([
        getCategories(db, 'item'),
        getCategories(db, 'subscription'),
        getCategories(db, 'stored_card'),
      ]);
      setItemCategories(items.map(({ id, name, icon }) => ({ id, name, icon })));
      setSubscriptionCategories(subs.map(({ id, name, icon }) => ({ id, name, icon })));
      setStoredCardCategories(stored.map(({ id, name, icon }) => ({ id, name, icon })));
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    refreshCategories();
  }, [refreshCategories]);

  const createCategory = useCallback(
    async (input: { name: string; icon: string; type: CategoryType }) => {
      await createCategoryRecord(db, input);
      await refreshCategories();
    },
    [db, refreshCategories],
  );

  const updateCategory = useCallback(
    async (input: { id: string; name: string; icon: string; type: CategoryType }) => {
      await updateCategoryRecord(db, input);
      await refreshCategories();
    },
    [db, refreshCategories],
  );

  const deleteCategory = useCallback(
    async (type: CategoryType, id: string) => {
      await deleteCategoryRecord(db, type, id);
      await refreshCategories();
    },
    [db, refreshCategories],
  );

  const readCategoryUsageCount = useCallback(
    async (type: CategoryType, id: string) => getCategoryUsageCount(db, type, id),
    [db],
  );

  const getCategoryInfo = useCallback(
    (type: CategoryType, categoryId: string): CategoryInfo => {
      const list =
        type === 'item'
          ? itemCategories
          : type === 'subscription'
            ? subscriptionCategories
            : storedCardCategories;
      return (
        list.find(c => c.id === categoryId) ??
        list.find(c => c.id === 'other') ??
        FALLBACK_OTHER
      );
    },
    [itemCategories, storedCardCategories, subscriptionCategories],
  );

  const value = useMemo<CategoriesContextValue>(
    () => ({
      itemCategories,
      subscriptionCategories,
      storedCardCategories,
      loading,
      refreshCategories,
      createCategory,
      updateCategory,
      deleteCategory,
      getCategoryUsageCount: readCategoryUsageCount,
      getCategoryInfo,
    }),
    [
      createCategory,
      deleteCategory,
      getCategoryInfo,
      itemCategories,
      loading,
      readCategoryUsageCount,
      refreshCategories,
      storedCardCategories,
      subscriptionCategories,
      updateCategory,
    ],
  );

  return <CategoriesContext.Provider value={value}>{children}</CategoriesContext.Provider>;
}

export function useCategories(): CategoriesContextValue {
  const ctx = useContext(CategoriesContext);
  if (!ctx) {
    throw new Error('useCategories 必须在 CategoriesProvider 内使用');
  }
  return ctx;
}
