import { useCallback, useMemo } from 'react';
import { scopedStorage } from '@lark-apaas/client-toolkit-lite';

const STORAGE_KEY = '__app_reagent_column_memory';
const MAX_ITEMS = 20;

type ColumnMemoryMap = Record<string, string[]>;

function loadMemory(): ColumnMemoryMap {
  try {
    const raw = scopedStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) return parsed as ColumnMemoryMap;
    }
  } catch { /* ignore */ }
  return {};
}

function saveMemory(memory: ColumnMemoryMap) {
  scopedStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
}

/**
 * 同列记忆 Hook —— 按列名保存最近输入过的值，用于输入时自动完成
 */
export function useColumnMemory() {
  const memory = useMemo(() => loadMemory(), []);

  /** 记录一个值到指定列的记忆中 */
  const remember = useCallback((column: string, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const current = loadMemory();
    const list = current[column] ?? [];
    // 去重：移除旧值，插到最前
    const filtered = list.filter(v => v !== trimmed);
    filtered.unshift(trimmed);
    // 限制数量
    if (filtered.length > MAX_ITEMS) filtered.length = MAX_ITEMS;
    current[column] = filtered;
    saveMemory(current);
  }, []);

  /** 获取指定列的所有记忆值 */
  const getColumnValues = useCallback((column: string): string[] => {
    const current = loadMemory();
    return current[column] ?? [];
  }, []);

  /** 根据输入前缀过滤匹配的记忆值（包含匹配） */
  const suggest = useCallback((column: string, query: string): string[] => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const values = getColumnValues(column);
    return values.filter(v => v.toLowerCase().includes(q)).slice(0, 8);
  }, [getColumnValues]);

  return { remember, suggest, getColumnValues };
}
