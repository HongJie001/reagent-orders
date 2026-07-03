-- ============================================
-- 科研试剂订单管理系统 — Supabase 建表 SQL
-- ============================================
-- 在 Supabase SQL Editor 中执行此文件即可完成初始化
-- ============================================

-- 1. 用户资料表（扩展 Supabase Auth 内置 users 表）
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 新用户注册时自动创建 profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'viewer'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. 采购订单表
CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY,
  procurement_date TEXT NOT NULL DEFAULT '',
  procurement_method TEXT NOT NULL DEFAULT '天河',
  status TEXT NOT NULL DEFAULT '待处理' CHECK (status IN ('待处理', '已采购', '已调拨', '已到货', '已发货')),
  order_form TEXT NOT NULL DEFAULT '常规',
  customer TEXT NOT NULL DEFAULT '',
  brand TEXT NOT NULL DEFAULT '',
  catalog_number TEXT NOT NULL DEFAULT '',
  product_name TEXT NOT NULL DEFAULT '',
  specification TEXT NOT NULL DEFAULT '',
  list_price NUMERIC NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  remarks TEXT NOT NULL DEFAULT '',
  arrival_time TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'user',
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 3. 快递发货表
CREATE TABLE IF NOT EXISTS public.shipments (
  id TEXT PRIMARY KEY,
  screenshots JSONB NOT NULL DEFAULT '[]'::jsonb,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  delivery_address TEXT NOT NULL DEFAULT '',
  remind_courier TEXT NOT NULL DEFAULT '',
  tracking_number TEXT NOT NULL DEFAULT '',
  logistics_info JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT '待发货' CHECK (status IN ('待发货', '已发货')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'user',
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 4. 产品记忆库表
CREATE TABLE IF NOT EXISTS public.product_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand TEXT NOT NULL,
  catalog_number TEXT NOT NULL,
  product_name TEXT NOT NULL DEFAULT '',
  specification TEXT NOT NULL DEFAULT '',
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  use_count INTEGER NOT NULL DEFAULT 1,
  UNIQUE(brand, catalog_number)
);

-- 5. 自定义选项表
CREATE TABLE IF NOT EXISTS public.options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_type TEXT NOT NULL,
  option_value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(option_type, option_value)
);

-- ============================================
-- 6. 行级安全策略 (RLS)
-- ============================================

-- 启用 RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.options ENABLE ROW LEVEL SECURITY;

-- user_profiles: 所有人可读，仅本人可修改
CREATE POLICY "允许所有人读取用户资料" ON public.user_profiles
  FOR SELECT USING (true);

CREATE POLICY "允许用户修改自己的资料" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- orders: 所有人可读写（团队协作场景）
CREATE POLICY "允许所有人读取订单" ON public.orders
  FOR SELECT USING (true);

CREATE POLICY "允许认证用户新增订单" ON public.orders
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "允许认证用户修改订单" ON public.orders
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "允许认证用户删除订单" ON public.orders
  FOR DELETE USING (auth.role() = 'authenticated');

-- shipments: 所有人可读写
CREATE POLICY "允许所有人读取发货记录" ON public.shipments
  FOR SELECT USING (true);

CREATE POLICY "允许认证用户新增发货记录" ON public.shipments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "允许认证用户修改发货记录" ON public.shipments
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "允许认证用户删除发货记录" ON public.shipments
  FOR DELETE USING (auth.role() = 'authenticated');

-- product_memory: 所有人可读写
CREATE POLICY "允许所有人读取产品记忆" ON public.product_memory
  FOR SELECT USING (true);

CREATE POLICY "允许认证用户新增产品记忆" ON public.product_memory
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "允许认证用户修改产品记忆" ON public.product_memory
  FOR UPDATE USING (auth.role() = 'authenticated');

-- options: 所有人可读写
CREATE POLICY "允许所有人读取选项" ON public.options
  FOR SELECT USING (true);

CREATE POLICY "允许认证用户新增选项" ON public.options
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "允许认证用户修改选项" ON public.options
  FOR UPDATE USING (auth.role() = 'authenticated');

-- ============================================
-- 7. 启用 Realtime（必须执行！）
-- ============================================
-- 在 Supabase Dashboard → Database → Replication 中
-- 将 orders、shipments、product_memory、options 四张表开启 Realtime

-- 或者通过 SQL 开启（Supabase 新版本支持）：
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shipments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.product_memory;
ALTER PUBLICATION supabase_realtime ADD TABLE public.options;

-- ============================================
-- 8. 初始数据（可选）
-- ============================================

-- 插入默认选项
INSERT INTO public.options (option_type, option_value) VALUES
  ('procurement_method', '天河'),
  ('order_form', '常规'),
  ('order_form', '线下'),
  ('order_form', '后补单'),
  ('remind_courier', '天河宾'),
  ('remind_courier', '番禺荣')
ON CONFLICT (option_type, option_value) DO NOTHING;

-- ============================================
-- 9. 索引优化
-- ============================================
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_updated_at ON public.orders(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON public.shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_user_id ON public.shipments(user_id);
CREATE INDEX IF NOT EXISTS idx_product_memory_brand_catalog ON public.product_memory(brand, catalog_number);
CREATE INDEX IF NOT EXISTS idx_options_type ON public.options(option_type);
