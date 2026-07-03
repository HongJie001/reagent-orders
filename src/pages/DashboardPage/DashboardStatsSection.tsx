import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ClipboardList,
  ShoppingCart,
  ArrowLeftRight,
  PackageSearch,
  Truck,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { IOrder } from '@/data/crud';

interface DashboardStatsSectionProps {
  orders: IOrder[];
}

interface StatCard {
  label: string;
  key: IOrder['status'] | '未到货';
  count: number;
  icon: typeof ClipboardList;
  color: string;
  bgColor: string;
}

const STATUS_CONFIG: Record<string, { color: string; bgColor: string; icon: typeof ClipboardList }> = {
  '待处理': { color: 'text-muted-foreground', bgColor: 'bg-muted', icon: Clock },
  '已采购': { color: 'text-blue-600', bgColor: 'bg-blue-50', icon: ShoppingCart },
  '已调拨': { color: 'text-amber-600', bgColor: 'bg-amber-50', icon: ArrowLeftRight },
  '已到货': { color: 'text-emerald-600', bgColor: 'bg-emerald-50', icon: PackageSearch },
  '已发货': { color: 'text-purple-600', bgColor: 'bg-purple-50', icon: Truck },
  '未到货': { color: 'text-orange-600', bgColor: 'bg-orange-50', icon: PackageSearch },
};

const STATUS_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  '待处理': 'secondary',
  '已采购': 'default',
  '已调拨': 'outline',
  '已到货': 'default',
  '已发货': 'default',
};

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case '已采购': return 'bg-blue-100 text-blue-700 border-blue-200';
    case '已调拨': return 'bg-amber-100 text-amber-700 border-amber-200';
    case '已到货': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case '已发货': return 'bg-purple-100 text-purple-700 border-purple-200';
    default: return 'bg-muted text-muted-foreground';
  }
}

export default function DashboardStatsSection({ orders }: DashboardStatsSectionProps) {
  const stats = useMemo((): StatCard[] => {
    const pending = orders.filter(o => o.status === '待处理').length;
    const purchased = orders.filter(o => o.status === '已采购').length;
    const transferred = orders.filter(o => o.status === '已调拨').length;
    const arrived = orders.filter(o => o.status === '已到货').length;
    const shipped = orders.filter(o => o.status === '已发货').length;
    const unreceived = orders.filter(o => o.status === '已采购' || o.status === '已调拨').length;

    return [
      { label: '待处理', key: '待处理', count: pending, ...STATUS_CONFIG['待处理'] },
      { label: '已采购', key: '已采购', count: purchased, ...STATUS_CONFIG['已采购'] },
      { label: '已调拨', key: '已调拨', count: transferred, ...STATUS_CONFIG['已调拨'] },
      { label: '未到货', key: '未到货', count: unreceived, ...STATUS_CONFIG['未到货'] },
      { label: '已发货', key: '已发货', count: shipped, ...STATUS_CONFIG['已发货'] },
    ];
  }, [orders]);

  const totalOrders = orders.length;

  const recentActivities = useMemo(() => {
    return [...orders]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5);
  }, [orders]);

  const statusDistribution = useMemo(() => {
    const statuses: IOrder['status'][] = ['待处理', '已采购', '已调拨', '已到货', '已发货'];
    return statuses.map(s => ({
      status: s,
      count: orders.filter(o => o.status === s).length,
      percent: totalOrders > 0 ? Math.round((orders.filter(o => o.status === s).length / totalOrders) * 100) : 0,
    }));
  }, [orders, totalOrders]);

  return (
    <div className="space-y-6">
      {/* 统计卡片行 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            >
              <Card className="border-border/60 shadow-xs hover:shadow-sm transition-shadow duration-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                      <p className={`text-2xl font-bold tabular-nums tracking-tight ${stat.color}`}>
                        {stat.count}
                      </p>
                    </div>
                    <div className={`size-10 rounded-lg flex items-center justify-center ${stat.bgColor}`}>
                      <Icon className={`size-5 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* 下方双列：状态分布 + 最近动态 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 状态分布 - 1/3 */}
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="size-4 text-muted-foreground" />
              状态分布
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {statusDistribution.map((item) => (
              <div key={item.status} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{item.status}</span>
                  <span className="font-semibold tabular-nums">{item.count}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${item.status === '待处理' ? 'bg-muted-foreground/40' : item.status === '已采购' ? 'bg-blue-500' : item.status === '已调拨' ? 'bg-amber-500' : item.status === '已到货' ? 'bg-emerald-500' : 'bg-purple-500'}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${item.percent}%` }}
                    transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-right">{item.percent}%</p>
              </div>
            ))}
            {totalOrders > 0 && (
              <div className="pt-2 border-t border-border/40">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">订单总数</span>
                  <span className="font-bold text-foreground tabular-nums">{totalOrders}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 最近动态 - 2/3 */}
        <Card className="lg:col-span-2 border-border/60 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              最近操作动态
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivities.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                暂无操作记录
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivities.map((order, i) => (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.04 }}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/40 bg-card/50 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium truncate">{order.customer}</span>
                        <Badge
                          variant="outline"
                          className={`shrink-0 text-xs ${getStatusBadgeClass(order.status)}`}
                        >
                          {order.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {order.brand} · {order.productName} · {order.specification} · ×{order.quantity}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                      {new Date(order.updatedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
