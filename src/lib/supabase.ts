import { createClient, type RealtimeChannel, type RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { logger } from '@lark-apaas/client-toolkit-lite';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function createSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    logger.info('[Supabase] 未配置环境变量，使用 localStorage 模式');
    return null;
  }
  try {
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
    logger.info('[Supabase] 客户端初始化成功');
    return client;
  } catch (error) {
    logger.error('[Supabase] 初始化失败:', String(error));
    return null;
  }
}

export const supabase = createSupabaseClient();

/** 是否已配置 Supabase（云端模式） */
export function isSupabaseAvailable(): boolean {
  return supabase !== null;
}

/**
 * 订阅表变更（INSERT / UPDATE / DELETE）
 * 返回取消订阅函数
 */
export function subscribeToTable(
  table: string,
  schema: string,
  onPayload: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void,
): RealtimeChannel | null {
  if (!supabase) return null;

  const channel = supabase
    .channel(`${schema}-${table}-changes`)
    .on(
      'postgres_changes',
      { event: '*', schema, table },
      (payload) => {
        logger.info(`[Realtime] ${table} ${payload.eventType}:`, payload.new ?? payload.old);
        onPayload(payload as RealtimePostgresChangesPayload<Record<string, unknown>>);
      },
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        logger.info(`[Realtime] 已订阅 ${schema}.${table}`);
      } else {
        logger.error(`[Realtime] ${schema}.${table} 订阅状态: ${status}`);
      }
    });

  return channel;
}

/** 数据库类型定义 */
export interface SupabaseOrder {
  id: string;
  procurement_date: string;
  procurement_method: string;
  status: string;
  order_form: string;
  customer: string;
  brand: string;
  catalog_number: string;
  product_name: string;
  specification: string;
  list_price: number;
  quantity: number;
  unit_price: number;
  total_price: number;
  remarks: string;
  arrival_time: string | null;
  created_at: string;
  updated_at: string;
  source: string;
  user_id: string | null;
}

export interface SupabaseShipment {
  id: string;
  screenshots: string[];
  attachments: string[];
  delivery_address: string;
  remind_courier: string;
  tracking_number: string;
  logistics_info: Record<string, unknown>[];
  status: string;
  created_at: string;
  updated_at: string;
  source: string;
  user_id: string | null;
}

export interface SupabaseProductMemory {
  id: string;
  brand: string;
  catalog_number: string;
  product_name: string;
  specification: string;
  last_used_at: string;
  use_count: number;
}

export interface SupabaseOption {
  id: string;
  option_type: string;
  option_value: string;
  created_at: string;
}

export interface SupabaseUserProfile {
  id: string;
  email: string;
  display_name: string;
  role: string;
  created_at: string;
}
