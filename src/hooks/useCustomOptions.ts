import { useState, useEffect, useCallback } from 'react';
import { logger } from '@lark-apaas/client-toolkit-lite';
import { supabase, isSupabaseAvailable, subscribeToTable, type SupabaseOption } from '@/lib/supabase';

const STORAGE_KEY = '__app_reagent_custom_options';

export interface ICustomOptions {
  procurementMethods: string[];
  orderForms: string[];
  remindCouriers: string[];
}

const DEFAULT_OPTIONS: ICustomOptions = {
  procurementMethods: ['天河'],
  orderForms: ['常规', '线下', '后补单'],
  remindCouriers: ['天河宾', '番禺荣'],
};

// ─── localStorage helpers ──────────────────────────────────────────────
function loadLocalOptions(): ICustomOptions {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        procurementMethods: Array.isArray(parsed.procurementMethods) ? parsed.procurementMethods : DEFAULT_OPTIONS.procurementMethods,
        orderForms: Array.isArray(parsed.orderForms) ? parsed.orderForms : DEFAULT_OPTIONS.orderForms,
        remindCouriers: Array.isArray(parsed.remindCouriers) ? parsed.remindCouriers : DEFAULT_OPTIONS.remindCouriers,
      };
    }
  } catch (e) {
    logger.error('useCustomOptions loadLocalOptions error:', String(e));
  }
  return DEFAULT_OPTIONS;
}

function saveLocalOptions(options: ICustomOptions): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
  } catch (e) {
    logger.error('useCustomOptions saveLocalOptions error:', String(e));
  }
}

// ─── Supabase helpers ──────────────────────────────────────────────────
function buildOptionsFromSupabase(rows: SupabaseOption[]): ICustomOptions {
  const result: ICustomOptions = {
    procurementMethods: [...DEFAULT_OPTIONS.procurementMethods],
    orderForms: [...DEFAULT_OPTIONS.orderForms],
    remindCouriers: [...DEFAULT_OPTIONS.remindCouriers],
  };
  for (const row of rows) {
    switch (row.option_type) {
      case 'procurement_method':
        if (!result.procurementMethods.includes(row.option_value)) {
          result.procurementMethods.push(row.option_value);
        }
        break;
      case 'order_form':
        if (!result.orderForms.includes(row.option_value)) {
          result.orderForms.push(row.option_value);
        }
        break;
      case 'remind_courier':
        if (!result.remindCouriers.includes(row.option_value)) {
          result.remindCouriers.push(row.option_value);
        }
        break;
    }
  }
  return result;
}

// ─── hook ──────────────────────────────────────────────────────────────
export function useCustomOptions() {
  const [options, setOptions] = useState<ICustomOptions>(() => {
    if (isSupabaseAvailable()) return DEFAULT_OPTIONS;
    return loadLocalOptions();
  });
  const [cloudReady, setCloudReady] = useState(!isSupabaseAvailable());

  // ── Supabase 模式 ──
  useEffect(() => {
    if (!isSupabaseAvailable() || !supabase) return;

    let cancelled = false;

    async function loadFromCloud() {
      const { data, error } = await supabase!
        .from('options')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        logger.error('useCustomOptions Supabase 加载失败:', error.message);
        if (!cancelled) setCloudReady(true);
        return;
      }

      if (!cancelled && data) {
        setOptions(buildOptionsFromSupabase(data as SupabaseOption[]));
        setCloudReady(true);
      }
    }

    loadFromCloud();

    const channel = subscribeToTable('options', 'public', () => {
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
          setOptions({
            procurementMethods: Array.isArray(parsed.procurementMethods) ? parsed.procurementMethods : DEFAULT_OPTIONS.procurementMethods,
            orderForms: Array.isArray(parsed.orderForms) ? parsed.orderForms : DEFAULT_OPTIONS.orderForms,
            remindCouriers: Array.isArray(parsed.remindCouriers) ? parsed.remindCouriers : DEFAULT_OPTIONS.remindCouriers,
          });
        } catch { /* ignore */ }
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // ── 通用：添加选项 ──
  const addOption = useCallback(async (optionType: string, value: string) => {
    if (!value.trim()) return;

    if (isSupabaseAvailable() && supabase) {
      const { error } = await supabase.from('options').insert({
        option_type: optionType,
        option_value: value.trim(),
      });
      if (error && !error.message.includes('duplicate')) {
        logger.error('useCustomOptions addOption Supabase 失败:', error.message);
      }
    } else {
      // fallback to local
      setOptions(prev => {
        const next = { ...prev };
        if (optionType === 'procurement_method' && !next.procurementMethods.includes(value.trim())) {
          next.procurementMethods = [...next.procurementMethods, value.trim()];
        } else if (optionType === 'order_form' && !next.orderForms.includes(value.trim())) {
          next.orderForms = [...next.orderForms, value.trim()];
        } else if (optionType === 'remind_courier' && !next.remindCouriers.includes(value.trim())) {
          next.remindCouriers = [...next.remindCouriers, value.trim()];
        }
        saveLocalOptions(next);
        return next;
      });
    }
  }, []);

  const addProcurementMethod = useCallback((method: string) => {
    addOption('procurement_method', method);
  }, [addOption]);

  const removeProcurementMethod = useCallback((method: string) => {
    setOptions(prev => {
      const next = { ...prev, procurementMethods: prev.procurementMethods.filter(m => m !== method) };
      saveLocalOptions(next);
      return next;
    });
  }, []);

  const addOrderForm = useCallback((form: string) => {
    addOption('order_form', form);
  }, [addOption]);

  const removeOrderForm = useCallback((form: string) => {
    setOptions(prev => {
      const next = { ...prev, orderForms: prev.orderForms.filter(f => f !== form) };
      saveLocalOptions(next);
      return next;
    });
  }, []);

  const addRemindCourier = useCallback((courier: string) => {
    addOption('remind_courier', courier);
  }, [addOption]);

  const removeRemindCourier = useCallback((courier: string) => {
    setOptions(prev => {
      const next = { ...prev, remindCouriers: prev.remindCouriers.filter(c => c !== courier) };
      saveLocalOptions(next);
      return next;
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    setOptions(DEFAULT_OPTIONS);
    saveLocalOptions(DEFAULT_OPTIONS);
  }, []);

  return {
    options,
    addProcurementMethod,
    removeProcurementMethod,
    addOrderForm,
    removeOrderForm,
    addRemindCourier,
    removeRemindCourier,
    resetToDefaults,
    cloudReady,
  };
}
