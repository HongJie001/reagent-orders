import { useState, useEffect, useCallback } from 'react';
import { scopedStorage, logger } from '@lark-apaas/client-toolkit-lite';
import { supabase, isSupabaseAvailable, subscribeToTable, type SupabaseProductMemory } from '@/lib/supabase';

export interface IProductMemory {
  brand: string;
  catalogNumber: string;
  productName: string;
  specification: string;
  lastUsedAt: string;
  useCount: number;
}

const STORAGE_KEY = '__app_reagent_product_memory';

const DEFAULT_MEMORY: IProductMemory[] = [
  { brand: 'Sigma', catalogNumber: 'S7388', productName: '氯化钠', specification: '500g/瓶', lastUsedAt: '2025-01-15T08:30:00Z', useCount: 3 },
  { brand: 'Thermo', catalogNumber: 'T9283', productName: 'Tris缓冲液', specification: '1L/瓶', lastUsedAt: '2025-01-14T10:15:00Z', useCount: 5 },
  { brand: 'Abcam', catalogNumber: 'A1101', productName: '抗体Anti-GAPDH', specification: '100μl/支', lastUsedAt: '2025-01-13T09:00:00Z', useCount: 2 },
  { brand: 'Sigma', catalogNumber: 'S8751', productName: '蔗糖', specification: '1kg/瓶', lastUsedAt: '2025-01-12T14:00:00Z', useCount: 1 },
  { brand: 'Thermo', catalogNumber: 'T1023', productName: 'PBS缓冲液', specification: '500ml/瓶', lastUsedAt: '2025-01-11T11:00:00Z', useCount: 4 },
];

// ─── localStorage helpers ──────────────────────────────────────────────
function loadLocalMemory(): IProductMemory[] {
  try {
    const raw = scopedStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    logger.error('Failed to load product memory:', String(e));
  }
  return DEFAULT_MEMORY;
}

function saveLocalMemory(memory: IProductMemory[]) {
  try {
    scopedStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch (e) {
    logger.error('Failed to save product memory:', String(e));
  }
}

// ─── Supabase ↔ IProductMemory 转换 ────────────────────────────────────
function fromSupabaseMemory(sm: SupabaseProductMemory): IProductMemory {
  return {
    brand: sm.brand,
    catalogNumber: sm.catalog_number,
    productName: sm.product_name,
    specification: sm.specification,
    lastUsedAt: sm.last_used_at,
    useCount: sm.use_count,
  };
}

// ─── hook ──────────────────────────────────────────────────────────────
export function useProductMemory() {
  const [memory, setMemory] = useState<IProductMemory[]>(() => {
    if (isSupabaseAvailable()) return [];
    return loadLocalMemory();
  });
  const [cloudReady, setCloudReady] = useState(!isSupabaseAvailable());

  // ── Supabase 模式 ──
  useEffect(() => {
    if (!isSupabaseAvailable() || !supabase) return;

    let cancelled = false;

    async function loadFromCloud() {
      const { data, error } = await supabase!
        .from('product_memory')
        .select('*')
        .order('use_count', { ascending: false });

      if (error) {
        logger.error('useProductMemory Supabase 加载失败:', error.message);
        if (!cancelled) setCloudReady(true);
        return;
      }

      if (!cancelled && data) {
        setMemory((data as SupabaseProductMemory[]).map(fromSupabaseMemory));
        setCloudReady(true);
      }
    }

    loadFromCloud();

    const channel = subscribeToTable('product_memory', 'public', () => {
      loadFromCloud();
    });

    return () => {
      cancelled = true;
      if (channel) supabase?.removeChannel(channel);
    };
  }, []);

  // ── localStorage 模式 ──
  useEffect(() => {
    if (isSupabaseAvailable()) return;

    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue !== null) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setMemory(parsed);
        } catch { /* ignore */ }
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const addOrUpdateMemory = useCallback(async (brand: string, catalogNumber: string, productName: string, specification: string) => {
    if (isSupabaseAvailable() && supabase) {
      const now = new Date().toISOString();
      const { data: existing } = await supabase
        .from('product_memory')
        .select('*')
        .eq('brand', brand)
        .eq('catalog_number', catalogNumber)
        .single();

      if (existing) {
        await supabase.from('product_memory').update({
          product_name: productName,
          specification,
          last_used_at: now,
          use_count: (existing as SupabaseProductMemory).use_count + 1,
        }).eq('id', (existing as SupabaseProductMemory).id);
      } else {
        await supabase.from('product_memory').insert({
          brand,
          catalog_number: catalogNumber,
          product_name: productName,
          specification,
          last_used_at: now,
          use_count: 1,
        });
      }
    } else {
      setMemory(prev => {
        const now = new Date().toISOString();
        const idx = prev.findIndex(m => m.brand === brand && m.catalogNumber === catalogNumber);
        let next: IProductMemory[];
        if (idx >= 0) {
          next = [...prev];
          next[idx] = { ...next[idx], productName, specification, lastUsedAt: now, useCount: next[idx].useCount + 1 };
        } else {
          next = [...prev, { brand, catalogNumber, productName, specification, lastUsedAt: now, useCount: 1 }];
        }
        saveLocalMemory(next);
        return next;
      });
    }
  }, []);

  const queryByBrandAndCatalog = useCallback((brand: string, catalogNumber: string): IProductMemory | undefined => {
    return memory.find(m => m.brand === brand && m.catalogNumber === catalogNumber);
  }, [memory]);

  const queryByCatalogNumber = useCallback((catalogNumber: string): IProductMemory[] => {
    if (!catalogNumber) return [];
    const lower = catalogNumber.toLowerCase();
    return memory
      .filter(m => m.catalogNumber.toLowerCase().includes(lower))
      .sort((a, b) => b.useCount - a.useCount)
      .slice(0, 8);
  }, [memory]);

  const getAllBrands = useCallback((): string[] => {
    return [...new Set(memory.map(m => m.brand))].sort();
  }, [memory]);

  return {
    memory,
    addOrUpdateMemory,
    queryByBrandAndCatalog,
    queryByCatalogNumber,
    getAllBrands,
    cloudReady,
  };
}
