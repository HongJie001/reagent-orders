import { useCallback } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2 } from 'lucide-react';
import UnreceivedTableSection from '@/pages/UnreceivedPage/UnreceivedTableSection';
import { useOrders } from '@/hooks/useOrders';

export default function UnreceivedPage() {
  const { orders, updateOrder } = useOrders();

  const handleMarkReceived = useCallback((orderId: string) => {
    const now = new Date();
    const arrivalTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    updateOrder(orderId, { status: '已到货', arrivalTime });
    toast.success('已标记为到货，状态已同步更新', {
      action: {
        label: '撤销',
        onClick: () => {
          updateOrder(orderId, { status: '已采购', arrivalTime: '' });
          toast.success('已撤销到货标记');
        },
      },
    });
  }, [updateOrder]);

  return (
    <div className="h-full flex flex-col p-4 md:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">未到货产品</h1>
          <p className="text-sm text-muted-foreground mt-1">
            自动筛选采购需求中已采购/已调拨但未到货的订单，仓管核对到货后操作入库
          </p>
        </div>
        <Badge variant="secondary" className="gap-1 text-xs h-6">
          <CheckCircle2 className="size-3 text-emerald-500" />
          自动保存
        </Badge>
      </div>
      <UnreceivedTableSection orders={orders} onMarkReceived={handleMarkReceived} />
    </div>
  );
}
