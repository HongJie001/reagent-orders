import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2 } from 'lucide-react';
import { useOrders } from '@/hooks/useOrders';
import { useShipments } from '@/hooks/useShipments';
import type { IOrder } from '@/data/crud';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; className: string }> = {
  '待处理': { label: '待处理', variant: 'secondary', className: 'bg-amber-100 text-amber-800 border-amber-300' },
  '已采购': { label: '已采购', variant: 'default', className: 'bg-blue-100 text-blue-800 border-blue-300' },
  '已调拨': { label: '已调拨', variant: 'default', className: 'bg-purple-100 text-purple-800 border-purple-300' },
  '已到货': { label: '已到货', variant: 'default', className: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  '已发货': { label: '已发货', variant: 'default', className: 'bg-slate-200 text-slate-700 border-slate-400' },
};

const STAT_CARDS = [
  { key: '待处理', label: '待处理订单', color: 'bg-amber-100', textColor: 'text-amber-800' },
  { key: '已采购', label: '已采购订单', color: 'bg-blue-100', textColor: 'text-blue-800' },
  { key: '已调拨', label: '已调拨订单', color: 'bg-purple-100', textColor: 'text-purple-800' },
  { key: '未到货', label: '未到货订单', color: 'bg-orange-100', textColor: 'text-orange-700' },
  { key: '已发货', label: '已发货订单', color: 'bg-slate-200', textColor: 'text-slate-700' },
];

export default function DashboardPage() {
  const { orders } = useOrders();
  const { shipments } = useShipments();

  const stats = useMemo(() => {
    const pending = orders.filter(o => o.status === '待处理').length;
    const purchased = orders.filter(o => o.status === '已采购').length;
    const transferred = orders.filter(o => o.status === '已调拨').length;
    const unreceived = orders.filter(o => o.status === '已采购' || o.status === '已调拨').length;
    const shipped = shipments.filter(s => s.status === '已发货').length;

    return { 待处理: pending, 已采购: purchased, 已调拨: transferred, 未到货: unreceived, 已发货: shipped };
  }, [orders, shipments]);

  const totalOrders = orders.length;
  const statusDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    orders.forEach(o => {
      dist[o.status] = (dist[o.status] || 0) + 1;
    });
    return dist;
  }, [orders]);

  const recentActivities = useMemo(() => {
    const activities: { order: IOrder; time: string }[] = [];
    orders.forEach(o => {
      if (o.updatedAt !== o.createdAt) {
        activities.push({ order: o, time: o.updatedAt });
      }
    });
    activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    return activities.slice(0, 5);
  }, [orders]);

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8 h-full overflow-y-auto">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">首页总览</h1>
          <p className="text-sm text-muted-foreground mt-1">
            核心订单统计数据概览
          </p>
        </div>
        <Badge variant="secondary" className="gap-1 text-xs h-6">
          <CheckCircle2 className="size-3 text-emerald-500" />
          自动保存
        </Badge>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {STAT_CARDS.map((card, i) => (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
          >
            <Card className="border-border/40">
              <CardContent className="p-4 md:p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs md:text-sm text-muted-foreground">{card.label}</p>
                    <p className="text-2xl md:text-3xl font-bold tabular-nums tracking-tight mt-1">
                      {stats[card.key as keyof typeof stats] ?? 0}
                    </p>
                  </div>
                  <div className={`size-10 md:size-12 rounded-lg ${card.color} flex items-center justify-center`}>
                    <span className={`text-lg font-bold ${card.textColor}`}>
                      {stats[card.key as keyof typeof stats] ?? 0}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* 下方：状态分布 + 最近动态 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 状态分布 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          <Card className="border-border/40 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">状态分布</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(STATUS_CONFIG).map(([status, config]) => {
                const count = statusDistribution[status] || 0;
                const pct = totalOrders > 0 ? Math.round((count / totalOrders) * 100) : 0;
                return (
                  <div key={status} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{config.label}</span>
                      <span className="font-semibold tabular-nums">{count}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${config.className.split(' ')[0]}`}
                        initial={{ width: 0 }}
                        whileInView={{ width: `${pct}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>

        {/* 最近操作动态 */}
        <motion.div
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
          <Card className="border-border/40 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">最近操作动态</CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <p className="text-sm">暂无操作记录</p>
                  <p className="text-xs mt-1">订单状态变更后将在此展示</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentActivities.map((activity, i) => {
                    const config = STATUS_CONFIG[activity.order.status];
                    const timeStr = new Date(activity.time).toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    return (
                      <div
                        key={`${activity.order.id}-${i}`}
                        className="flex items-center justify-between gap-3 py-2 border-b border-border/30 last:border-b-0"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {activity.order.customer} · {activity.order.productName}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {activity.order.brand} / {activity.order.catalogNumber}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            variant={config.variant}
                            className={`text-xs border ${config.className}`}
                          >
                            {config.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {timeStr}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
