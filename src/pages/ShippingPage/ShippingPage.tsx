import { Badge } from '@/components/ui/badge';
import { CheckCircle2 } from 'lucide-react';
import ShippingTableSection from '@/pages/ShippingPage/ShippingTableSection';

export default function ShippingPage() {
  return (
    <div className="h-full flex flex-col p-4 md:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">快递发货需求</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理发货流程，上传销售单据、填写快递信息、追踪物流
          </p>
        </div>
        <Badge variant="secondary" className="gap-1 text-xs h-6">
          <CheckCircle2 className="size-3 text-emerald-500" />
          自动保存
        </Badge>
      </div>
      <ShippingTableSection />
    </div>
  );
}
