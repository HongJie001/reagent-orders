import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ExternalLink, Copy, Check, Database, Cloud, Key, Users, Shield, Server, Globe, AlertCircle, HelpCircle, ArrowRight, Rocket, Zap, Github, Mail, Smartphone, Laptop, Clock, FileCode, Terminal, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { UniversalLink } from '@lark-apaas/client-toolkit-lite';

const SQL_SCHEMA = `-- ============================================
-- 科研试剂订单管理系统 — Supabase 建表 SQL
-- 在 Supabase SQL Editor 中粘贴执行
-- ============================================

-- 1. 用户资料表（存储用户昵称和权限）
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. 采购订单表（存储所有订单数据）
CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY,
  procurement_date TEXT NOT NULL DEFAULT '',
  procurement_method TEXT NOT NULL DEFAULT '天河',
  status TEXT NOT NULL DEFAULT '待处理',
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

-- 3. 快递发货表（存储发货记录和物流信息）
CREATE TABLE IF NOT EXISTS public.shipments (
  id TEXT PRIMARY KEY,
  screenshots JSONB NOT NULL DEFAULT '[]'::jsonb,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  delivery_address TEXT NOT NULL DEFAULT '',
  remind_courier TEXT NOT NULL DEFAULT '',
  tracking_number TEXT NOT NULL DEFAULT '',
  logistics_info JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT '待发货',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'user',
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 4. 产品记忆库表（品牌+货号→产品名称+规格的映射）
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

-- 5. 自定义选项表（采购方式、订单形式、提醒发货员等下拉选项）
CREATE TABLE IF NOT EXISTS public.options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_type TEXT NOT NULL,
  option_value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(option_type, option_value)
);

-- 6. 启用行级安全（RLS）
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.options ENABLE ROW LEVEL SECURITY;

-- 7. 设置访问权限（登录用户可读写）
CREATE POLICY "允许所有人读取订单" ON public.orders FOR SELECT USING (true);
CREATE POLICY "允许认证用户新增订单" ON public.orders FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "允许认证用户修改订单" ON public.orders FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "允许认证用户删除订单" ON public.orders FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "允许所有人读取发货记录" ON public.shipments FOR SELECT USING (true);
CREATE POLICY "允许认证用户新增发货记录" ON public.shipments FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "允许认证用户修改发货记录" ON public.shipments FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "允许认证用户删除发货记录" ON public.shipments FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "允许所有人读取产品记忆" ON public.product_memory FOR SELECT USING (true);
CREATE POLICY "允许认证用户新增产品记忆" ON public.product_memory FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "允许认证用户修改产品记忆" ON public.product_memory FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "允许所有人读取选项" ON public.options FOR SELECT USING (true);
CREATE POLICY "允许认证用户新增选项" ON public.options FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 8. 启用实时同步（Realtime）
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shipments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.product_memory;
ALTER PUBLICATION supabase_realtime ADD TABLE public.options;

-- 9. 插入初始选项数据
INSERT INTO public.options (option_type, option_value) VALUES
  ('procurement_method', '天河'),
  ('order_form', '常规'), ('order_form', '线下'), ('order_form', '后补单'),
  ('remind_courier', '天河宾'), ('remind_courier', '番禺荣')
ON CONFLICT (option_type, option_value) DO NOTHING;`;

const TABLE_DESCRIPTIONS = [
  { name: 'user_profiles', desc: '用户资料表 — 存储每个用户的昵称和权限角色（管理员/编辑者/查看者）' },
  { name: 'orders', desc: '采购订单表 — 存储所有订单数据，包括品牌、货号、价格、状态等' },
  { name: 'shipments', desc: '快递发货表 — 存储发货记录、截图、物流轨迹信息' },
  { name: 'product_memory', desc: '产品记忆库 — 记住品牌+货号对应的产品名称和规格，下次自动填充' },
  { name: 'options', desc: '自定义选项表 — 采购方式、订单形式、提醒发货员等下拉选项' },
];

export default function DeployGuidePage() {
  const [copied, setCopied] = useState(false);

  const handleCopySQL = async () => {
    try {
      await navigator.clipboard.writeText(SQL_SCHEMA);
      setCopied(true);
      toast.success('SQL 已复制到剪贴板，去 Supabase SQL Editor 粘贴执行吧！');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error('复制失败，请手动选中代码后 Ctrl+C 复制');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12 space-y-10">

        {/* ==================== 标题 ==================== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-primary/10 mb-4">
            <Rocket className="size-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">🚀 部署指南 · 手把手教学</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            即使你完全不懂编程，跟着这份指南一步步操作，<strong className="text-foreground">20 分钟</strong>就能把系统部署上线，让全团队一起使用！
          </p>
        </motion.div>

        {/* ==================== 新手入门 ==================== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <HelpCircle className="size-5 text-primary" />
                新手必读：先搞清楚这几个概念
              </CardTitle>
              <CardDescription>花 2 分钟看完，后面操作就不会懵了</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-background border border-border space-y-2">
                  <div className="flex items-center gap-2">
                    <Globe className="size-5 text-primary" />
                    <span className="font-semibold">Vercel 是什么？</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Vercel 是一个<strong className="text-foreground">免费的前端托管平台</strong>。你可以把它理解成"网上的文件柜"——把你的网页文件放上去，全世界的人就能通过网址访问了。它速度很快，全球都有服务器，而且<strong className="text-emerald-600">完全免费</strong>（每月 100GB 流量，小团队绰绰有余）。
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-background border border-border space-y-2">
                  <div className="flex items-center gap-2">
                    <Database className="size-5 text-primary" />
                    <span className="font-semibold">Supabase 是什么？</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Supabase 是一个<strong className="text-foreground">免费的在线数据库</strong>。你可以把它理解成"网上的 Excel"——所有订单数据都存在这里，团队成员打开网页看到的是同一份数据。它还自带<strong className="text-emerald-600">用户注册登录</strong>和<strong className="text-emerald-600">实时同步</strong>功能，完全免费（500MB 存储空间）。
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-background border border-border">
                <p className="text-sm font-semibold mb-3">📋 整体流程（跟着箭头走就行）：</p>
                <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm">
                  <span className="px-3 py-1.5 rounded-full bg-primary text-primary-foreground font-semibold whitespace-nowrap">① 注册 Supabase</span>
                  <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                  <span className="px-3 py-1.5 rounded-full bg-primary/80 text-primary-foreground font-semibold whitespace-nowrap">② 创建数据库</span>
                  <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                  <span className="px-3 py-1.5 rounded-full bg-primary/60 text-primary-foreground font-semibold whitespace-nowrap">③ 执行建表 SQL</span>
                  <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                  <span className="px-3 py-1.5 rounded-full bg-emerald-600 text-white font-semibold whitespace-nowrap">④ 获取密钥</span>
                  <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                  <span className="px-3 py-1.5 rounded-full bg-amber-600 text-white font-semibold whitespace-nowrap">⑤ 注册 Vercel</span>
                  <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                  <span className="px-3 py-1.5 rounded-full bg-amber-600/80 text-white font-semibold whitespace-nowrap">⑥ 导入代码</span>
                  <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                  <span className="px-3 py-1.5 rounded-full bg-amber-600/60 text-white font-semibold whitespace-nowrap">⑦ 配置密钥</span>
                  <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                  <span className="px-3 py-1.5 rounded-full bg-green-600 text-white font-semibold whitespace-nowrap">⑧ 部署完成！</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ==================== 第一部分：Supabase ==================== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <Card>
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="flex items-center gap-3 text-xl">
                <span className="size-8 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center font-bold shrink-0">1</span>
                设置 Supabase（在线数据库）
              </CardTitle>
              <CardDescription>预计耗时：10 分钟 · 难度：⭐（非常简单）</CardDescription>
            </CardHeader>
            <CardContent className="pt-5 space-y-6">

              {/* 步骤 1.1 */}
              <div className="flex gap-4">
                <span className="size-7 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">1.1</span>
                <div className="space-y-2 flex-1">
                  <p className="font-semibold">打开 Supabase 网站，注册账号</p>
                  <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside leading-relaxed">
                    <li>用浏览器打开{' '}
                      <UniversalLink to="https://supabase.com" target="_blank" rel="noreferrer" className="text-primary underline inline-flex items-center gap-0.5">
                        supabase.com <ExternalLink className="size-3" />
                      </UniversalLink>
                    </li>
                    <li>点击右上角绿色的 <strong className="text-foreground">「Sign Up」</strong> 按钮</li>
                    <li>选择 <strong className="text-foreground">「Continue with GitHub」</strong>（用 GitHub 账号登录最方便）</li>
                    <li>如果没有 GitHub 账号，点下方「Sign up with email」，用邮箱注册一个</li>
                    <li>首次登录可能需要验证邮箱，去邮箱里点一下验证链接即可</li>
                  </ol>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground mt-2">
                    💡 <strong className="text-foreground">小提示：</strong>GitHub 是程序员常用的代码托管网站，注册免费且简单。如果你没有 GitHub 账号，用邮箱注册也一样，不影响后续操作。
                  </div>
                </div>
              </div>

              {/* 步骤 1.2 */}
              <div className="flex gap-4">
                <span className="size-7 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">1.2</span>
                <div className="space-y-2 flex-1">
                  <p className="font-semibold">登录后，进入后台管理界面</p>
                  <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside leading-relaxed">
                    <li>验证邮箱后会自动跳转到 Supabase 后台（Dashboard）</li>
                    <li>如果看到「Create a new organization」弹窗，随便填个名字（比如你的公司名），点 <strong className="text-foreground">「Create organization」</strong></li>
                    <li>之后会看到项目列表页面，目前是空的，接下来我们创建第一个项目</li>
                  </ol>
                </div>
              </div>

              {/* 步骤 1.3 */}
              <div className="flex gap-4">
                <span className="size-7 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">1.3</span>
                <div className="space-y-2 flex-1">
                  <p className="font-semibold">创建新项目（New Project）</p>
                  <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside leading-relaxed">
                    <li>在项目列表页，点击右上角黄色的 <strong className="text-foreground">「New project」</strong> 按钮</li>
                    <li>会弹出一个表单，需要填写以下信息：</li>
                  </ol>
                  <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-3 mt-2">
                    <div className="text-sm">
                      <span className="font-semibold text-foreground">📛 Name（项目名称）：</span>
                      <span className="text-muted-foreground ml-1">填 </span>
                      <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">reagent-orders</code>
                      <span className="text-muted-foreground">（或你喜欢的任何名字，比如"试剂订单系统"）</span>
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold text-foreground">🔑 Database Password（数据库密码）：</span>
                      <span className="text-muted-foreground ml-1">设置一个密码，</span>
                      <strong className="text-destructive">请务必记下来！</strong>
                      <span className="text-muted-foreground">建议用"大小写字母+数字"组合，比如 </span>
                      <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">Reagent2025!</code>
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold text-foreground">🌍 Region（服务器区域）：</span>
                      <span className="text-muted-foreground ml-1">选择 </span>
                      <strong className="text-foreground">Southeast Asia (Singapore)</strong>
                      <span className="text-muted-foreground">——新加坡离国内最近，访问速度最快。如果列表里没有新加坡，选 </span>
                      <strong className="text-foreground">Northeast Asia (Tokyo)</strong>
                      <span className="text-muted-foreground"> 也可以。</span>
                    </div>
                  </div>
                  <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside leading-relaxed" start={3}>
                    <li>填好后，点击底部的绿色 <strong className="text-foreground">「Create project」</strong> 按钮</li>
                  </ol>
                </div>
              </div>

              {/* 步骤 1.4 */}
              <div className="flex gap-4">
                <span className="size-7 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">1.4</span>
                <div className="space-y-2 flex-1">
                  <p className="font-semibold">等待项目创建完成（约 2 分钟）</p>
                  <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside leading-relaxed">
                    <li>点击创建后，页面会显示进度条和"Provisioning database..."的提示</li>
                    <li>耐心等待 <strong className="text-foreground">1-2 分钟</strong>，不要关闭页面</li>
                    <li>创建完成后会自动进入项目 Dashboard（仪表盘）</li>
                    <li>你会看到左侧有一排菜单，右侧显示项目信息——说明创建成功！</li>
                  </ol>
                </div>
              </div>

              {/* 步骤 1.5 */}
              <div className="flex gap-4">
                <span className="size-7 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">1.5</span>
                <div className="space-y-2 flex-1">
                  <p className="font-semibold">🔴 关键步骤：执行建表 SQL</p>
                  <p className="text-sm text-muted-foreground">这一步会创建数据库表（就像在 Excel 里新建几个工作表），是让系统能存数据的关键。</p>
                  <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside leading-relaxed">
                    <li>在左侧菜单栏找到并点击 <strong className="text-foreground">「SQL Editor」</strong>（图标是一个数据库带闪电⚡）</li>
                    <li>点击左上角 <strong className="text-foreground">「New query」</strong> 按钮</li>
                    <li>回到本页面，点击下方代码块右上角的 <strong className="text-foreground">「复制 SQL」</strong> 按钮</li>
                    <li>回到 Supabase 的 SQL Editor，在编辑区 <strong className="text-foreground">Ctrl+V（Mac 是 Cmd+V）粘贴</strong></li>
                    <li>点击右下角绿色的 <strong className="text-foreground">「Run」</strong> 按钮执行</li>
                    <li>看到底部显示 "Success. No rows returned" 就说明成功了！</li>
                  </ol>
                  <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-xs text-muted-foreground mt-2">
                    ⚠️ <strong className="text-destructive">注意：</strong>如果执行报错，检查一下 SQL Editor 右上角是否选择了正确的数据库（默认是选中状态，一般不用改）。
                  </div>
                </div>
              </div>

              {/* SQL 代码块 */}
              <div className="ml-11">
                <div className="rounded-lg border-2 border-primary/30 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-primary/5 border-b border-primary/20">
                    <div className="flex items-center gap-2">
                      <FileCode className="size-4 text-primary" />
                      <span className="text-sm font-semibold text-primary">📋 完整建表 SQL（全选复制）</span>
                    </div>
                    <Button
                      size="sm"
                      variant={copied ? "default" : "outline"}
                      className="h-8 text-xs gap-1.5"
                      onClick={handleCopySQL}
                    >
                      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      {copied ? '已复制！' : '复制 SQL'}
                    </Button>
                  </div>
                  <div className="p-3 bg-muted/30">
                    <p className="text-xs text-muted-foreground mb-2">以下 SQL 会创建 <strong className="text-foreground">5 张数据表</strong>：</p>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {TABLE_DESCRIPTIONS.map(t => (
                        <span key={t.name} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-background border border-border text-xs">
                          <code className="text-primary font-mono">{t.name}</code>
                          <span className="text-muted-foreground">— {t.desc}</span>
                        </span>
                      ))}
                    </div>
                    <pre className="bg-background rounded-lg p-3 text-xs overflow-x-auto max-h-80 border border-border leading-relaxed">
                      {SQL_SCHEMA}
                    </pre>
                  </div>
                </div>
              </div>

              {/* 步骤 1.6 */}
              <div className="flex gap-4">
                <span className="size-7 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">1.6</span>
                <div className="space-y-2 flex-1">
                  <p className="font-semibold">🔴 关键步骤：获取 API 密钥（连接凭证）</p>
                  <p className="text-sm text-muted-foreground">这两个密钥就像"门禁卡"，让前端网页能访问你的数据库。后面部署到 Vercel 时需要用到。</p>
                  <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside leading-relaxed">
                    <li>在左侧菜单栏，点击 <strong className="text-foreground">「Settings」</strong>（齿轮图标⚙️，在最底部）</li>
                    <li>在 Settings 子菜单中，点击 <strong className="text-foreground">「API」</strong></li>
                    <li>你会看到两个重要的值：</li>
                  </ol>
                  <div className="space-y-2 mt-2">
                    <div className="p-3 rounded-lg bg-muted/30 border border-border">
                      <div className="flex items-center gap-2 mb-1">
                        <Key className="size-4 text-primary shrink-0" />
                        <span className="text-sm font-semibold">Project URL（项目地址）</span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">格式类似：</p>
                      <code className="block bg-background px-3 py-1.5 rounded text-xs font-mono text-foreground border border-border break-all">
                        https://abcdefg.supabase.co
                      </code>
                      <p className="text-xs text-muted-foreground mt-1">📌 <strong>复制这个地址，存到记事本里，后面要用。</strong></p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30 border border-border">
                      <div className="flex items-center gap-2 mb-1">
                        <Shield className="size-4 text-primary shrink-0" />
                        <span className="text-sm font-semibold">anon public key（匿名公钥）</span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">一串很长的字母，格式类似：</p>
                      <code className="block bg-background px-3 py-1.5 rounded text-xs font-mono text-foreground border border-border break-all">
                        eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFz...
                      </code>
                      <p className="text-xs text-muted-foreground mt-1">📌 <strong>复制这串密钥，也存到记事本里，后面要用。</strong></p>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-xs text-muted-foreground mt-2">
                    ⚠️ <strong className="text-destructive">重要：</strong>anon key 很长，一定要完整复制（从头到尾），不要漏掉任何字符。建议先粘贴到记事本确认完整。
                  </div>
                </div>
              </div>

              {/* 步骤 1.7 */}
              <div className="flex gap-4">
                <span className="size-7 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">1.7</span>
                <div className="space-y-2 flex-1">
                  <p className="font-semibold">开启 Realtime（实时同步功能）</p>
                  <p className="text-sm text-muted-foreground">这个功能让多人同时操作时数据自动刷新，不用手动刷新页面。</p>
                  <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside leading-relaxed">
                    <li>在左侧菜单栏，点击 <strong className="text-foreground">「Database」</strong>（数据库图标🗄️）</li>
                    <li>在 Database 子菜单中，点击 <strong className="text-foreground">「Replication」</strong></li>
                    <li>你会看到一个叫 <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">supabase_realtime</code> 的发布项</li>
                    <li>点击它，在下方找到这 4 张表，把它们的开关都打开（变成绿色）：</li>
                  </ol>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {['orders', 'shipments', 'product_memory', 'options'].map(t => (
                      <code key={t} className="bg-muted px-2 py-1 rounded text-xs font-mono text-foreground">{t}</code>
                    ))}
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground mt-2">
                    💡 <strong className="text-foreground">小提示：</strong>如果找不到 Replication 菜单，说明你的 Supabase 版本较新。不用慌——前面执行的建表 SQL 里已经包含了开启 Realtime 的命令（第 8 步），这一步可以跳过。
                  </div>
                </div>
              </div>

              {/* 步骤 1.8 */}
              <div className="flex gap-4">
                <span className="size-7 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">1.8</span>
                <div className="space-y-2 flex-1">
                  <p className="font-semibold">关闭邮箱验证（可选，推荐新手关闭）</p>
                  <p className="text-sm text-muted-foreground">默认情况下，用户注册后需要去邮箱点验证链接。如果觉得麻烦，可以先关掉。</p>
                  <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside leading-relaxed">
                    <li>左侧菜单点击 <strong className="text-foreground">「Authentication」</strong>（盾牌图标🛡️）</li>
                    <li>点击子菜单 <strong className="text-foreground">「Settings」</strong></li>
                    <li>找到 <strong className="text-foreground">「Confirm email」</strong> 开关，把它关掉</li>
                    <li>点击页面底部的 <strong className="text-foreground">「Save」</strong> 保存</li>
                  </ol>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground mt-2">
                    💡 关掉后用户注册就能直接登录，不用验证邮箱。等团队用起来了，如果想更安全，随时可以回来打开。
                  </div>
                </div>
              </div>

              <div className="ml-11 p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                <p className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
                  <Check className="size-4" />
                  ✅ Supabase 设置完成！
                </p>
                <p className="text-xs text-emerald-700 mt-1">
                  你已经拿到了两个密钥（Project URL 和 anon key），请确保它们保存在记事本里。接下来进入第二部分。
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ==================== 第二部分：获取源代码 ==================== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card>
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="flex items-center gap-3 text-xl">
                <span className="size-8 rounded-full bg-emerald-600 text-white text-sm flex items-center justify-center font-bold shrink-0">2</span>
                获取项目源代码
              </CardTitle>
              <CardDescription>预计耗时：3 分钟 · 难度：⭐</CardDescription>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              <div className="flex gap-4">
                <span className="size-7 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">2.1</span>
                <div className="space-y-2 flex-1">
                  <p className="font-semibold">将代码上传到 GitHub（推荐方式）</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Vercel 可以直接从 GitHub 拉取代码自动部署，所以我们需要先把代码放到 GitHub 上。
                  </p>
                  <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside leading-relaxed">
                    <li>如果你还没有 GitHub 账号，先去{' '}
                      <UniversalLink to="https://github.com" target="_blank" rel="noreferrer" className="text-primary underline inline-flex items-center gap-0.5">
                        github.com <ExternalLink className="size-3" />
                      </UniversalLink>
                      {' '}注册一个（免费，用邮箱即可）
                    </li>
                    <li>登录 GitHub 后，点击右上角 <strong className="text-foreground">「+」</strong> → <strong className="text-foreground">「New repository」</strong></li>
                    <li>Repository name 填 <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">reagent-orders</code>，选择 <strong className="text-foreground">Public</strong>（公开），点击「Create repository」</li>
                    <li>创建完成后，GitHub 会显示上传代码的指引页面</li>
                  </ol>
                </div>
              </div>

              <div className="flex gap-4">
                <span className="size-7 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">2.2</span>
                <div className="space-y-2 flex-1">
                  <p className="font-semibold">上传代码到 GitHub</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    如果你在妙搭平台开发，可以导出项目代码后上传。具体操作：
                  </p>
                  <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-2">
                    <p className="text-sm font-semibold">方式一：通过妙搭平台导出（最简单）</p>
                    <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>在妙搭平台中，点击项目右上角的「导出」或「下载」按钮</li>
                      <li>下载 ZIP 压缩包到电脑</li>
                      <li>解压后，将整个文件夹拖到 GitHub 仓库页面上传</li>
                    </ol>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-2">
                    <p className="text-sm font-semibold">方式二：通过 Git 命令行（适合懂一点命令行的用户）</p>
                    <div className="bg-background rounded p-3 text-xs font-mono text-foreground border border-border space-y-1">
                      <div>git init</div>
                      <div>git add .</div>
                      <div>git commit -m "初始化项目"</div>
                      <div>git remote add origin https://github.com/你的用户名/reagent-orders.git</div>
                      <div>git push -u origin main</div>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground mt-2">
                    💡 <strong className="text-foreground">确认：</strong>上传完成后，在 GitHub 仓库页面应该能看到 <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">package.json</code>、<code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">vercel.json</code> 等文件。如果看不到，说明上传没成功，请重新上传。
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ==================== 第三部分：Vercel ==================== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
        >
          <Card>
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="flex items-center gap-3 text-xl">
                <span className="size-8 rounded-full bg-amber-600 text-white text-sm flex items-center justify-center font-bold shrink-0">3</span>
                部署到 Vercel（网页托管）
              </CardTitle>
              <CardDescription>预计耗时：5 分钟 · 难度：⭐</CardDescription>
            </CardHeader>
            <CardContent className="pt-5 space-y-6">

              {/* 3.1 */}
              <div className="flex gap-4">
                <span className="size-7 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">3.1</span>
                <div className="space-y-2 flex-1">
                  <p className="font-semibold">注册 Vercel 账号</p>
                  <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside leading-relaxed">
                    <li>打开{' '}
                      <UniversalLink to="https://vercel.com" target="_blank" rel="noreferrer" className="text-primary underline inline-flex items-center gap-0.5">
                        vercel.com <ExternalLink className="size-3" />
                      </UniversalLink>
                    </li>
                    <li>点击右上角 <strong className="text-foreground">「Sign Up」</strong></li>
                    <li>选择 <strong className="text-foreground">「Continue with GitHub」</strong>（用 GitHub 账号登录）</li>
                    <li>授权 Vercel 访问你的 GitHub 账号（点「Authorize Vercel」）</li>
                    <li>注册完成后会进入 Vercel 后台（Dashboard）</li>
                  </ol>
                </div>
              </div>

              {/* 3.2 */}
              <div className="flex gap-4">
                <span className="size-7 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">3.2</span>
                <div className="space-y-2 flex-1">
                  <p className="font-semibold">导入 GitHub 项目</p>
                  <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside leading-relaxed">
                    <li>在 Vercel Dashboard，点击 <strong className="text-foreground">「Add New...」</strong> → <strong className="text-foreground">「Project」</strong></li>
                    <li>Vercel 会列出你的 GitHub 仓库列表</li>
                    <li>找到 <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">reagent-orders</code>，点击右侧的 <strong className="text-foreground">「Import」</strong> 按钮</li>
                    <li>如果列表里找不到，点「Adjust GitHub App Permissions」授权访问</li>
                  </ol>
                </div>
              </div>

              {/* 3.3 */}
              <div className="flex gap-4">
                <span className="size-7 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">3.3</span>
                <div className="space-y-2 flex-1">
                  <p className="font-semibold">🔴 关键步骤：配置环境变量</p>
                  <p className="text-sm text-muted-foreground">这是让前端网页能连上你数据库的关键一步！把前面第 1.6 步保存的两个密钥填进去。</p>
                  <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside leading-relaxed">
                    <li>在导入页面，找到 <strong className="text-foreground">「Environment Variables」</strong> 区域</li>
                    <li>点击展开，你会看到两行输入框：左边填变量名，右边填变量值</li>
                    <li>添加第一个变量：</li>
                  </ol>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border mt-2 space-y-2">
                    <div className="text-sm">
                      <span className="font-semibold">变量名：</span>
                      <code className="bg-background px-2 py-0.5 rounded text-xs font-mono text-primary font-semibold">VITE_SUPABASE_URL</code>
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold">变量值：</span>
                      <span className="text-muted-foreground">粘贴你在第 1.6 步复制的 </span>
                      <strong className="text-foreground">Project URL</strong>
                      <span className="text-muted-foreground">（格式：https://xxxxx.supabase.co）</span>
                    </div>
                  </div>
                  <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside leading-relaxed" start={4}>
                    <li>点击「Add Another」添加第二个变量：</li>
                  </ol>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border mt-2 space-y-2">
                    <div className="text-sm">
                      <span className="font-semibold">变量名：</span>
                      <code className="bg-background px-2 py-0.5 rounded text-xs font-mono text-primary font-semibold">VITE_SUPABASE_ANON_KEY</code>
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold">变量值：</span>
                      <span className="text-muted-foreground">粘贴你在第 1.6 步复制的 </span>
                      <strong className="text-foreground">anon public key</strong>
                      <span className="text-muted-foreground">（很长的那串字母）</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-xs text-muted-foreground mt-2">
                    ⚠️ <strong className="text-destructive">常见错误：</strong>变量名要一字不差地输入（包括下划线和大写），变量值要完整粘贴（不要多空格、不要漏字符）。两个变量缺一不可！
                  </div>
                </div>
              </div>

              {/* 3.4 */}
              <div className="flex gap-4">
                <span className="size-7 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">3.4</span>
                <div className="space-y-2 flex-1">
                  <p className="font-semibold">部署上线</p>
                  <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside leading-relaxed">
                    <li>确认环境变量填好后，点击 <strong className="text-foreground">「Deploy」</strong> 按钮</li>
                    <li>Vercel 开始自动构建（会显示进度条和日志）</li>
                    <li>等待 <strong className="text-foreground">1-2 分钟</strong>，看到满屏的🎉烟花动画就说明部署成功了！</li>
                    <li>点击 <strong className="text-foreground">「Continue to Dashboard」</strong> 进入项目页面</li>
                    <li>在项目页面顶部，你会看到一个网址，格式类似：</li>
                  </ol>
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 mt-2">
                    <code className="text-sm font-mono text-emerald-800 break-all">
                      https://reagent-orders-xxxxx.vercel.app
                    </code>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    📌 <strong>这就是你的系统网址！</strong>复制这个链接，发到团队微信群里，大家打开浏览器就能用了！
                  </p>
                </div>
              </div>

              {/* 3.5 */}
              <div className="flex gap-4">
                <span className="size-7 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">3.5</span>
                <div className="space-y-2 flex-1">
                  <p className="font-semibold">（可选）绑定自定义域名</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    如果你有自己的域名（如 www.你的公司.com），可以绑定到 Vercel：
                  </p>
                  <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside leading-relaxed">
                    <li>在 Vercel 项目页面，点击顶部 <strong className="text-foreground">「Settings」</strong> → <strong className="text-foreground">「Domains」</strong></li>
                    <li>输入你的域名，按提示在域名服务商（如阿里云、腾讯云）添加一条 DNS 记录</li>
                    <li>等待 DNS 生效（通常 5-30 分钟），之后就能用你自己的域名访问了</li>
                  </ol>
                </div>
              </div>

              <div className="ml-11 p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                <p className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
                  <Rocket className="size-4" />
                  🎉 部署完成！你的系统已经上线了！
                </p>
                <p className="text-xs text-emerald-700 mt-1">
                  把 Vercel 给你的网址发给团队成员，大家打开浏览器就能开始用了。
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ==================== 第四部分：团队使用指南 ==================== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card>
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="flex items-center gap-3 text-xl">
                <span className="size-8 rounded-full bg-green-600 text-white text-sm flex items-center justify-center font-bold shrink-0">4</span>
                团队使用指南
              </CardTitle>
              <CardDescription>让团队成员开始使用系统</CardDescription>
            </CardHeader>
            <CardContent className="pt-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border border-border space-y-2">
                  <Users className="size-5 text-primary" />
                  <p className="font-semibold text-sm">分享链接给同事</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    把 Vercel 给你的网址（如 https://reagent-orders.vercel.app）直接发到微信群或钉钉群里，同事用手机或电脑浏览器打开就能访问。
                  </p>
                </div>
                <div className="p-4 rounded-lg border border-border space-y-2">
                  <Smartphone className="size-5 text-primary" />
                  <p className="font-semibold text-sm">同事如何注册账号</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    打开网址后，点击「注册」标签，填写显示名称、邮箱和密码，点击「注册并登录」即可。注册后自动获得"编辑者"权限。
                  </p>
                </div>
                <div className="p-4 rounded-lg border border-border space-y-2">
                  <Shield className="size-5 text-primary" />
                  <p className="font-semibold text-sm">设置管理员权限</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    第一个注册的用户默认为"编辑者"。要设为管理员：进入 Supabase Dashboard → Table Editor → 选择 <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">user_profiles</code> 表 → 找到对应用户 → 把 <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">role</code> 改为 <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">admin</code>。
                  </p>
                </div>
                <div className="p-4 rounded-lg border border-border space-y-2">
                  <Cloud className="size-5 text-primary" />
                  <p className="font-semibold text-sm">数据安全</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Supabase 每天自动备份数据。你也可以在 Supabase Dashboard → Database → Backups 手动下载备份。数据库密码请妥善保管，不要分享给他人。
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-muted/30 border border-border">
                <p className="text-sm font-semibold mb-2">👥 三种权限角色说明：</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded bg-background border border-border text-center">
                    <p className="font-semibold text-primary text-sm">🔑 管理员</p>
                    <p className="text-xs text-muted-foreground mt-1">全部权限：增删改查 + 管理用户权限</p>
                  </div>
                  <div className="p-3 rounded bg-background border border-border text-center">
                    <p className="font-semibold text-emerald-600 text-sm">✏️ 编辑者</p>
                    <p className="text-xs text-muted-foreground mt-1">可新增和编辑数据，不可删除</p>
                  </div>
                  <div className="p-3 rounded bg-background border border-border text-center">
                    <p className="font-semibold text-amber-600 text-sm">👀 查看者</p>
                    <p className="text-xs text-muted-foreground mt-1">只读模式，不可修改任何数据</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ==================== 第五部分：FAQ ==================== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
        >
          <Card>
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="flex items-center gap-3 text-xl">
                <span className="size-8 rounded-full bg-destructive/10 text-destructive text-sm flex items-center justify-center font-bold shrink-0">❓</span>
                常见问题 FAQ
              </CardTitle>
              <CardDescription>遇到问题？先来这里找答案</CardDescription>
            </CardHeader>
            <CardContent className="pt-3">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="q1">
                  <AccordionTrigger className="text-sm font-medium hover:no-underline">
                    <span className="flex items-center gap-2">
                      <AlertCircle className="size-4 text-destructive shrink-0" />
                      部署失败了怎么办？Vercel 显示红色报错
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-2">
                    <p>别慌，按以下步骤排查：</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li><strong>检查环境变量</strong>：确认两个变量名一字不差（<code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">VITE_SUPABASE_URL</code> 和 <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">VITE_SUPABASE_ANON_KEY</code>），变量值完整无遗漏</li>
                      <li><strong>检查 GitHub 仓库</strong>：确认代码已完整上传，仓库里有 <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">package.json</code> 文件</li>
                      <li><strong>重新部署</strong>：在 Vercel 项目页面点击「Deployments」→ 找到失败的部署 → 点击右侧「⋯」→「Redeploy」</li>
                      <li><strong>查看日志</strong>：点击失败的部署，查看「Build Logs」了解具体报错原因</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="q2">
                  <AccordionTrigger className="text-sm font-medium hover:no-underline">
                    <span className="flex items-center gap-2">
                      <AlertCircle className="size-4 text-amber-600 shrink-0" />
                      部署成功了，但打开网页是空白页？
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-2">
                    <p>通常是环境变量没配好。检查：</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>进入 Vercel 项目 → Settings → Environment Variables</li>
                      <li>确认两个变量都在列表中，且值正确</li>
                      <li>如果改了环境变量，需要重新部署一次才能生效（点「Redeploy」）</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="q3">
                  <AccordionTrigger className="text-sm font-medium hover:no-underline">
                    <span className="flex items-center gap-2">
                      <AlertCircle className="size-4 text-amber-600 shrink-0" />
                      注册账号后无法登录？
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-2">
                    <ol className="list-decimal list-inside space-y-1">
                      <li>检查是否关闭了邮箱验证（第 1.8 步），如果没关，去邮箱找验证邮件</li>
                      <li>确认密码输入正确（至少 6 位）</li>
                      <li>如果还是不行，在 Supabase Dashboard → Authentication → Users 中查看用户是否存在</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="q4">
                  <AccordionTrigger className="text-sm font-medium hover:no-underline">
                    <span className="flex items-center gap-2">
                      <AlertCircle className="size-4 text-amber-600 shrink-0" />
                      多人同时操作，数据不同步？
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-2">
                    <ol className="list-decimal list-inside space-y-1">
                      <li>检查 Realtime 是否开启（第 1.7 步）</li>
                      <li>在 Supabase Dashboard → Database → Replication 确认 4 张表的开关都是绿色</li>
                      <li>如果刚开启 Realtime，需要等 1-2 分钟生效</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="q5">
                  <AccordionTrigger className="text-sm font-medium hover:no-underline">
                    <span className="flex items-center gap-2">
                      <AlertCircle className="size-4 text-emerald-600 shrink-0" />
                      免费额度够用吗？会不会突然收费？
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-2">
                    <p>完全够用！两个平台都不会突然收费：</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li><strong>Supabase 免费版</strong>：500MB 数据库 + 50,000 月活用户 + 2GB 文件存储。小团队（10-20 人）用几年都不会超</li>
                      <li><strong>Vercel 免费版</strong>：100GB 带宽/月 + 6000 分钟构建时间。正常使用完全够</li>
                      <li>超出免费额度后，平台会先发邮件提醒，不会自动扣费</li>
                      <li>如果团队发展到需要升级，Supabase Pro 是 $25/月，Vercel Pro 是 $20/月</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="q6">
                  <AccordionTrigger className="text-sm font-medium hover:no-underline">
                    <span className="flex items-center gap-2">
                      <AlertCircle className="size-4 text-emerald-600 shrink-0" />
                      怎么换成自己的域名？
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-2">
                    <ol className="list-decimal list-inside space-y-1">
                      <li>在 Vercel 项目页面 → Settings → Domains</li>
                      <li>输入你的域名（如 order.你的公司.com）</li>
                      <li>Vercel 会提示你添加一条 DNS 记录，去你的域名服务商（阿里云/腾讯云等）添加</li>
                      <li>等待 DNS 生效（通常 5-30 分钟），之后就能用你的域名访问了</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="q7">
                  <AccordionTrigger className="text-sm font-medium hover:no-underline">
                    <span className="flex items-center gap-2">
                      <AlertCircle className="size-4 text-emerald-600 shrink-0" />
                      后续代码更新了怎么同步？
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-2">
                    <p>Vercel 会自动同步！</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>把新代码推送到 GitHub 仓库</li>
                      <li>Vercel 会自动检测到更新，自动重新构建部署</li>
                      <li>你什么都不用做，等 1-2 分钟刷新网页就能看到更新了</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </motion.div>

        {/* ==================== 底部 ==================== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-center pb-8"
        >
          <p className="text-sm text-muted-foreground">
            如果按照指南操作仍然遇到问题，可以截图发给技术人员协助排查。
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            本系统基于 Vite + React + Tailwind CSS + Supabase 构建，代码开源免费使用。
          </p>
        </motion.div>

      </main>
    </div>
  );
}
