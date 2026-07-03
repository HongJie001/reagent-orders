import { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '@lark-apaas/client-toolkit-lite';
import { scopedStorage } from '@lark-apaas/client-toolkit-lite';
import type { IOrder } from '@/data/crud';
import { MOCK_ORDERS } from '@/data/crud';
import { supabase, isSupabaseAvailable, subscribeToTable, type SupabaseOrder } from '@/lib/supabase';

const STORAGE_KEY = '__app_reagent_orders';

// ─── localStorage helpers ──────────────────────────────────────────────
function loadLocalOrders(): IOrder[] {
  try {
    const raw = scopedStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as IOrder[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    logger.error('useOrders loadLocalOrders parse error:', String(e));
  }
  return [...MOCK_ORDERS];
}

function persistLocalOrders(orders: IOrder[]) {
  try {
    scopedStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  } catch (e) {
    logger.error('useOrders persistLocalOrders error:', String(e));
  }
}

// ─── Supabase ↔ IOrder 转换 ───────────────────────────────────────────
function toSupabaseOrder(order: IOrder): SupabaseOrder {
  return {
    id: order.id,
    procurement_date: order.procurementDate,
    procurement_method: order.procurementMethod,
    status: order.status,
    order_form: order.orderForm,
    customer: order.customer,
    brand: order.brand,
    catalog_number: order.catalogNumber,
    product_name: order.productName,
    specification: order.specification,
    list_price: order.listPrice,
    quantity: order.quantity,
    unit_price: order.unitPrice,
    total_price: order.totalPrice,
    remarks: order.remarks,
    arrival_time: order.arrivalTime ?? null,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
    source: order.source ?? 'user',
    user_id: null,
  };
}

function fromSupabaseOrder(so: SupabaseOrder): IOrder {
  return {
    id: so.id,
    procurementDate: so.procurement_date,
    procurementMethod: so.procurement_method,
    status: so.status as IOrder['status'],
    orderForm: so.order_form as IOrder['orderForm'],
    customer: so.customer,
    brand: so.brand,
    catalogNumber: so.catalog_number,
    productName: so.product_name,
    specification: so.specification,
    listPrice: Number(so.list_price),
    quantity: Number(so.quantity),
    unitPrice: Number(so.unit_price),
    totalPrice: Number(so.total_price),
    remarks: so.remarks,
    arrivalTime: so.arrival_time ?? undefined,
    createdAt: so.created_at,
    updatedAt: so.updated_at,
    source: (so.source as 'mock' | 'user') ?? 'user',
  };
}

// ─── hook ──────────────────────────────────────────────────────────────
export function useOrders() {
  const [orders, setOrders] = useState<IOrder[]>(() => {
    if (isSupabaseAvailable()) return [];
    return loadLocalOrders();
  });
  const [cloudReady, setCloudReady] = useState(!isSupabaseAvailable());
  const ordersRef = useRef(orders);
  ordersRef.current = orders;

  // ── Supabase 模式：加载 + 实时订阅 ──
  useEffect(() => {
    if (!isSupabaseAvailable() || !supabase) return;

    let cancelled = false;

    async function loadFromCloud() {
      const { data, error } = await supabase!
        .from('orders')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        logger.error('useOrders Supabase 加载失败:', error.message);
        if (!cancelled) setCloudReady(true);
        return;
      }

      if (!cancelled && data) {
        setOrders((data as SupabaseOrder[]).map(fromSupabaseOrder));
        setCloudReady(true);
      }
    }

    loadFromCloud();

    // 实时订阅
    const channel = subscribeToTable('orders', 'public', (payload) => {
      if (cancelled) return;
      setOrders(prev => {
        switch (payload.eventType) {
          case 'INSERT': {
            const neo = fromSupabaseOrder(payload.new as unknown as SupabaseOrder);
            if (prev.find(o => o.id === neo.id)) return prev;
            return [...prev, neo];
          }
          case 'UPDATE': {
            const updated = fromSupabaseOrder(payload.new as unknown as SupabaseOrder);
            return prev.map(o => (o.id === updated.id ? updated : o));
          }
          case 'DELETE': {
            const deletedId = (payload.old as unknown as SupabaseOrder).id;
            return prev.filter(o => o.id !== deletedId);
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

  // ── localStorage 模式：多标签页同步 ──
  useEffect(() => {
    if (isSupabaseAvailable()) return;

    const handler = (e: StorageEvent) => {
      if (e.key === null || e.key === STORAGE_KEY) {
        try {
          const raw = scopedStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw) as IOrder[];
            if (Array.isArray(parsed)) setOrders(parsed);
          } else {
            setOrders([...MOCK_ORDERS]);
          }
        } catch (err) {
          logger.error('useOrders storage sync error:', String(err));
        }
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // ── CRUD 操作（双模式） ──
  const addOrder = useCallback(async (order: IOrder) => {
    if (isSupabaseAvailable() && supabase) {
      const { error } = await supabase.from('orders').insert(toSupabaseOrder(order));
      if (error) logger.error('useOrders addOrder Supabase 失败:', error.message);
      // Realtime 会自动更新 state，无需手动 setOrders
    } else {
      setOrders(prev => {
        const next = [...prev, order];
        persistLocalOrders(next);
        return next;
      });
    }
  }, []);

  const updateOrder = useCallback(async (id: string, updates: Partial<IOrder>) => {
    if (isSupabaseAvailable() && supabase) {
      const supabaseUpdates: Record<string, unknown> = {};
      if (updates.procurementDate !== undefined) supabaseUpdates.procurement_date = updates.procurementDate;
      if (updates.procurementMethod !== undefined) supabaseUpdates.procurement_method = updates.procurementMethod;
      if (updates.status !== undefined) supabaseUpdates.status = updates.status;
      if (updates.orderForm !== undefined) supabaseUpdates.order_form = updates.orderForm;
      if (updates.customer !== undefined) supabaseUpdates.customer = updates.customer;
      if (updates.brand !== undefined) supabaseUpdates.brand = updates.brand;
      if (updates.catalogNumber !== undefined) supabaseUpdates.catalog_number = updates.catalogNumber;
      if (updates.productName !== undefined) supabaseUpdates.product_name = updates.productName;
      if (updates.specification !== undefined) supabaseUpdates.specification = updates.specification;
      if (updates.listPrice !== undefined) supabaseUpdates.list_price = updates.listPrice;
      if (updates.quantity !== undefined) supabaseUpdates.quantity = updates.quantity;
      if (updates.unitPrice !== undefined) supabaseUpdates.unit_price = updates.unitPrice;
      if (updates.totalPrice !== undefined) supabaseUpdates.total_price = updates.totalPrice;
      if (updates.remarks !== undefined) supabaseUpdates.remarks = updates.remarks;
      if (updates.arrivalTime !== undefined) supabaseUpdates.arrival_time = updates.arrivalTime || null;
      supabaseUpdates.updated_at = new Date().toISOString();

      const { error } = await supabase.from('orders').update(supabaseUpdates).eq('id', id);
      if (error) logger.error('useOrders updateOrder Supabase 失败:', error.message);
    } else {
      setOrders(prev => {
        const next = prev.map(o =>
          o.id === id ? { ...o, ...updates, updatedAt: new Date().toISOString() } : o
        );
        persistLocalOrders(next);
        return next;
      });
    }
  }, []);

  const deleteOrder = useCallback(async (id: string) => {
    if (isSupabaseAvailable() && supabase) {
      const { error } = await supabase.from('orders').delete().eq('id', id);
      if (error) logger.error('useOrders deleteOrder Supabase 失败:', error.message);
    } else {
      setOrders(prev => {
        const next = prev.filter(o => o.id !== id);
        persistLocalOrders(next);
        return next;
      });
    }
  }, []);

  const batchAddOrders = useCallback(async (newOrders: IOrder[]) => {
    if (isSupabaseAvailable() && supabase) {
      const { error } = await supabase.from('orders').insert(newOrders.map(toSupabaseOrder));
      if (error) logger.error('useOrders batchAddOrders Supabase 失败:', error.message);
    } else {
      setOrders(prev => {
        const next = [...prev, ...newOrders];
        persistLocalOrders(next);
        return next;
      });
    }
  }, []);

  const batchUpdateOrders = useCallback(async (updates: Array<{ id: string; changes: Partial<IOrder> }>) => {
    if (isSupabaseAvailable() && supabase) {
      for (const { id, changes } of updates) {
        const supabaseUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (changes.procurementDate !== undefined) supabaseUpdates.procurement_date = changes.procurementDate;
        if (changes.procurementMethod !== undefined) supabaseUpdates.procurement_method = changes.procurementMethod;
        if (changes.status !== undefined) supabaseUpdates.status = changes.status;
        if (changes.orderForm !== undefined) supabaseUpdates.order_form = changes.orderForm;
        if (changes.customer !== undefined) supabaseUpdates.customer = changes.customer;
        if (changes.brand !== undefined) supabaseUpdates.brand = changes.brand;
        if (changes.catalogNumber !== undefined) supabaseUpdates.catalog_number = changes.catalogNumber;
        if (changes.productName !== undefined) supabaseUpdates.product_name = changes.productName;
        if (changes.specification !== undefined) supabaseUpdates.specification = changes.specification;
        if (changes.listPrice !== undefined) supabaseUpdates.list_price = changes.listPrice;
        if (changes.quantity !== undefined) supabaseUpdates.quantity = changes.quantity;
        if (changes.unitPrice !== undefined) supabaseUpdates.unit_price = changes.unitPrice;
        if (changes.totalPrice !== undefined) supabaseUpdates.total_price = changes.totalPrice;
        if (changes.remarks !== undefined) supabaseUpdates.remarks = changes.remarks;
        if (changes.arrivalTime !== undefined) supabaseUpdates.arrival_time = changes.arrivalTime || null;
        await supabase.from('orders').update(supabaseUpdates).eq('id', id);
      }
    } else {
      setOrders(prev => {
        const updateMap = new Map(updates.map(u => [u.id, u.changes]));
        const next = prev.map(o => {
          const changes = updateMap.get(o.id);
          return changes ? { ...o, ...changes, updatedAt: new Date().toISOString() } : o;
        });
        persistLocalOrders(next);
        return next;
      });
    }
  }, []);

  return {
    orders,
    addOrder,
    updateOrder,
    deleteOrder,
    batchAddOrders,
    batchUpdateOrders,
    cloudReady,
  };
}
