import { useState, useEffect, useCallback } from 'react';
import { logger, scopedStorage } from '@lark-apaas/client-toolkit-lite';
import type { ILogisticsNode } from '@/data/logistics';
import { MOCK_LOGISTICS_MAP } from '@/data/logistics';
import { supabase, isSupabaseAvailable, subscribeToTable, type SupabaseShipment } from '@/lib/supabase';

const STORAGE_KEY = '__app_reagent_shipments';

export interface IShipment {
  id: string;
  screenshots: string[];
  attachments: string[];
  deliveryAddress: string;
  remindCourier: string;
  trackingNumber: string;
  logisticsInfo: ILogisticsNode[];
  status: '待发货' | '已发货';
  createdAt: string;
  updatedAt: string;
  source?: 'mock' | 'user';
}

function generateId(): string {
  return `ship_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

// ─── localStorage helpers ──────────────────────────────────────────────
function loadFromStorage(): IShipment[] {
  try {
    const raw = scopedStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as IShipment[];
  } catch (e) {
    logger.error('Failed to load shipments from localStorage:', String(e));
  }
  return [];
}

function saveToStorage(shipments: IShipment[]): void {
  try {
    scopedStorage.setItem(STORAGE_KEY, JSON.stringify(shipments));
  } catch (e) {
    logger.error('Failed to save shipments to localStorage:', String(e));
  }
}

function buildMockShipments(): IShipment[] {
  return [
    {
      id: generateId(), screenshots: [], attachments: [],
      deliveryAddress: '广州市天河区五山路381号华南理工大学材料学院B栋302室',
      remindCourier: '天河宾', trackingNumber: 'SF1234567890',
      logisticsInfo: MOCK_LOGISTICS_MAP['SF1234567890'] ?? [],
      status: '待发货', createdAt: '2025-01-15T09:00:00Z', updatedAt: '2025-01-15T09:00:00Z', source: 'mock',
    },
    {
      id: generateId(), screenshots: [], attachments: [],
      deliveryAddress: '广州市番禺区大学城外环西路230号广州大学行政楼A201',
      remindCourier: '番禺荣', trackingNumber: 'YT9876543210',
      logisticsInfo: MOCK_LOGISTICS_MAP['YT9876543210'] ?? [],
      status: '已发货', createdAt: '2025-01-14T10:30:00Z', updatedAt: '2025-01-15T07:45:00Z', source: 'mock',
    },
    {
      id: generateId(), screenshots: [], attachments: [],
      deliveryAddress: '深圳市南山区学苑大道1066号深圳大学丽湖校区生命科学学院C座',
      remindCourier: '天河宾', trackingNumber: 'DB2468013579',
      logisticsInfo: MOCK_LOGISTICS_MAP['DB2468013579'] ?? [],
      status: '待发货', createdAt: '2025-01-16T11:00:00Z', updatedAt: '2025-01-16T11:00:00Z', source: 'mock',
    },
  ];
}

function initializeLocalShipments(): IShipment[] {
  const stored = loadFromStorage();
  if (stored.length > 0) return stored;
  const mock = buildMockShipments();
  saveToStorage(mock);
  return mock;
}

// ─── Supabase ↔ IShipment 转换 ─────────────────────────────────────────
function toSupabaseShipment(s: IShipment): SupabaseShipment {
  return {
    id: s.id,
    screenshots: s.screenshots,
    attachments: s.attachments,
    delivery_address: s.deliveryAddress,
    remind_courier: s.remindCourier,
    tracking_number: s.trackingNumber,
    logistics_info: s.logisticsInfo as unknown as Record<string, unknown>[],
    status: s.status,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
    source: s.source ?? 'user',
    user_id: null,
  };
}

function fromSupabaseShipment(ss: SupabaseShipment): IShipment {
  return {
    id: ss.id,
    screenshots: (ss.screenshots as string[]) ?? [],
    attachments: (ss.attachments as string[]) ?? [],
    deliveryAddress: ss.delivery_address,
    remindCourier: ss.remind_courier,
    trackingNumber: ss.tracking_number,
    logisticsInfo: (ss.logistics_info as unknown as ILogisticsNode[]) ?? [],
    status: ss.status as IShipment['status'],
    createdAt: ss.created_at,
    updatedAt: ss.updated_at,
    source: (ss.source as 'mock' | 'user') ?? 'user',
  };
}

// ─── hook ──────────────────────────────────────────────────────────────
export function useShipments() {
  const [shipments, setShipments] = useState<IShipment[]>(() => {
    if (isSupabaseAvailable()) return [];
    return initializeLocalShipments();
  });
  const [cloudReady, setCloudReady] = useState(!isSupabaseAvailable());

  // ── Supabase 模式 ──
  useEffect(() => {
    if (!isSupabaseAvailable() || !supabase) return;

    let cancelled = false;

    async function loadFromCloud() {
      const { data, error } = await supabase!
        .from('shipments')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        logger.error('useShipments Supabase 加载失败:', error.message);
        if (!cancelled) setCloudReady(true);
        return;
      }

      if (!cancelled && data) {
        setShipments((data as SupabaseShipment[]).map(fromSupabaseShipment));
        setCloudReady(true);
      }
    }

    loadFromCloud();

    const channel = subscribeToTable('shipments', 'public', (payload) => {
      if (cancelled) return;
      setShipments(prev => {
        switch (payload.eventType) {
          case 'INSERT': {
            const neo = fromSupabaseShipment(payload.new as unknown as SupabaseShipment);
            if (prev.find(s => s.id === neo.id)) return prev;
            return [...prev, neo];
          }
          case 'UPDATE': {
            const updated = fromSupabaseShipment(payload.new as unknown as SupabaseShipment);
            return prev.map(s => (s.id === updated.id ? updated : s));
          }
          case 'DELETE': {
            const deletedId = (payload.old as unknown as SupabaseShipment).id;
            return prev.filter(s => s.id !== deletedId);
          }
          default:
            return prev;
        }
      });
    });

    return () => {
      cancelled = true;
      if (channel) supabase?.removeChannel(channel);
    };
  }, []);

  // ── localStorage 模式 ──
  useEffect(() => {
    if (isSupabaseAvailable()) return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue !== null) {
        try {
          setShipments(JSON.parse(e.newValue) as IShipment[]);
        } catch (err) {
          logger.error('Failed to parse shipments from storage event:', String(err));
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const persist = useCallback((updated: IShipment[]) => {
    setShipments(updated);
    saveToStorage(updated);
  }, []);

  const addShipment = useCallback(async (data: Partial<IShipment>) => {
    const now = nowISO();
    const newShipment: IShipment = {
      id: generateId(),
      screenshots: data.screenshots ?? [],
      attachments: data.attachments ?? [],
      deliveryAddress: data.deliveryAddress ?? '',
      remindCourier: data.remindCourier ?? '天河宾',
      trackingNumber: data.trackingNumber ?? '',
      logisticsInfo: data.trackingNumber ? (MOCK_LOGISTICS_MAP[data.trackingNumber] ?? []) : [],
      status: data.status ?? '待发货',
      createdAt: now, updatedAt: now, source: 'user',
    };

    if (isSupabaseAvailable() && supabase) {
      await supabase.from('shipments').insert(toSupabaseShipment(newShipment));
    } else {
      persist([...shipments, newShipment]);
    }
    return newShipment;
  }, [shipments, persist]);

  const updateShipment = useCallback(async (id: string, data: Partial<IShipment>) => {
    if (isSupabaseAvailable() && supabase) {
      const updates: Record<string, unknown> = { updated_at: nowISO() };
      if (data.screenshots !== undefined) updates.screenshots = data.screenshots;
      if (data.attachments !== undefined) updates.attachments = data.attachments;
      if (data.deliveryAddress !== undefined) updates.delivery_address = data.deliveryAddress;
      if (data.remindCourier !== undefined) updates.remind_courier = data.remindCourier;
      if (data.trackingNumber !== undefined) {
        updates.tracking_number = data.trackingNumber;
        updates.logistics_info = data.trackingNumber ? (MOCK_LOGISTICS_MAP[data.trackingNumber] ?? []) : [];
      }
      if (data.status !== undefined) updates.status = data.status;
      await supabase.from('shipments').update(updates).eq('id', id);
    } else {
      const updated = shipments.map((s) => {
        if (s.id !== id) return s;
        const merged = { ...s, ...data, id: s.id, updatedAt: nowISO() };
        if (data.trackingNumber !== undefined) {
          merged.logisticsInfo = data.trackingNumber ? (MOCK_LOGISTICS_MAP[data.trackingNumber] ?? []) : [];
        }
        return merged;
      });
      persist(updated);
    }
  }, [shipments, persist]);

  const deleteShipment = useCallback(async (id: string) => {
    if (isSupabaseAvailable() && supabase) {
      await supabase.from('shipments').delete().eq('id', id);
    } else {
      persist(shipments.filter((s) => s.id !== id));
    }
  }, [shipments, persist]);

  const markAsShipped = useCallback(async (id: string) => {
    if (isSupabaseAvailable() && supabase) {
      await supabase.from('shipments').update({ status: '已发货', updated_at: nowISO() }).eq('id', id);
    } else {
      const updated = shipments.map((s) =>
        s.id === id ? { ...s, status: '已发货' as const, updatedAt: nowISO() } : s,
      );
      persist(updated);
    }
  }, [shipments, persist]);

  const addScreenshot = useCallback(async (id: string, dataUrl: string) => {
    if (isSupabaseAvailable() && supabase) {
      const target = shipments.find(s => s.id === id);
      if (target) {
        await supabase.from('shipments').update({
          screenshots: [...target.screenshots, dataUrl],
          updated_at: nowISO(),
        }).eq('id', id);
      }
    } else {
      const updated = shipments.map((s) =>
        s.id === id ? { ...s, screenshots: [...s.screenshots, dataUrl], updatedAt: nowISO() } : s,
      );
      persist(updated);
    }
  }, [shipments, persist]);

  const removeScreenshot = useCallback(async (id: string, index: number) => {
    if (isSupabaseAvailable() && supabase) {
      const target = shipments.find(s => s.id === id);
      if (target) {
        await supabase.from('shipments').update({
          screenshots: target.screenshots.filter((_, i) => i !== index),
          updated_at: nowISO(),
        }).eq('id', id);
      }
    } else {
      const updated = shipments.map((s) =>
        s.id === id ? { ...s, screenshots: s.screenshots.filter((_, i) => i !== index), updatedAt: nowISO() } : s,
      );
      persist(updated);
    }
  }, [shipments, persist]);

  const addAttachment = useCallback(async (id: string, dataUrl: string) => {
    if (isSupabaseAvailable() && supabase) {
      const target = shipments.find(s => s.id === id);
      if (target) {
        await supabase.from('shipments').update({
          attachments: [...target.attachments, dataUrl],
          updated_at: nowISO(),
        }).eq('id', id);
      }
    } else {
      const updated = shipments.map((s) =>
        s.id === id ? { ...s, attachments: [...s.attachments, dataUrl], updatedAt: nowISO() } : s,
      );
      persist(updated);
    }
  }, [shipments, persist]);

  const removeAttachment = useCallback(async (id: string, index: number) => {
    if (isSupabaseAvailable() && supabase) {
      const target = shipments.find(s => s.id === id);
      if (target) {
        await supabase.from('shipments').update({
          attachments: target.attachments.filter((_, i) => i !== index),
          updated_at: nowISO(),
        }).eq('id', id);
      }
    } else {
      const updated = shipments.map((s) =>
        s.id === id ? { ...s, attachments: s.attachments.filter((_, i) => i !== index), updatedAt: nowISO() } : s,
      );
      persist(updated);
    }
  }, [shipments, persist]);

  return {
    shipments,
    addShipment,
    updateShipment,
    deleteShipment,
    markAsShipped,
    addScreenshot,
    removeScreenshot,
    addAttachment,
    removeAttachment,
    cloudReady,
  } as const;
}
