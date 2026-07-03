import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PackageSearch, CheckCircle2, AlertCircle, Filter, X, Warehouse } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { IOrder } from '@/data/crud';

interface UnreceivedTableSectionProps {
  orders: IOrder[];
  onMarkReceived: (orderId: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  '已采购': 'bg-blue-100 text-blue-800 border-blue-300',
  '已调拨': 'bg-purple-100 text-purple-800 border-purple-300',
};

const COLUMNS = [
  { key: 'procurementDate', label: '采购日期', minWidth: 110 },
  { key: 'status', label: '状态', minWidth: 80 },
  { key: 'arrivalTime', label: '已到货时间', minWidth: 130 },
  { key: 'brand', label: '品牌', minWidth: 80 },
  { key: 'catalogNumber', label: '货号', minWidth: 100 },
  { key: 'productName', label: '产品名称', minWidth: 140 },
  { key: 'specification', label: '规格', minWidth: 100 },
  { key: 'quantity', label: '数量', minWidth: 60 },
  { key: 'remarks', label: '备注', minWidth: 160 },
] as const;

export default function UnreceivedTableSection({
  orders,
  onMarkReceived,
}: UnreceivedTableSectionProps) {
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [warehouseTab, setWarehouseTab] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false);
  const [colWidths, setColWidths] = useState<Record<string, number>>({
    procurementDate: 110,
    status: 80,
    arrivalTime: 130,
    brand: 80,
    catalogNumber: 100,
    productName: 140,
    specification: 100,
    quantity: 60,
    remarks: 160,
  });
  const resizingRef = useRef<{ field: string; startX: number; startWidth: number } | null>(null);

  const unreceivedOrders = useMemo(() => {
    let list = orders.filter((o) => o.status === '已采购' || o.status === '已调拨');
    // warehouse filter
    if (warehouseTab === 'tianhe') {
      list = list.filter(o => o.procurementMethod === '天河' || o.procurementMethod === '调拨天河');
    } else if (warehouseTab === 'panyu') {
      list = list.filter(o => o.procurementMethod === '番禺' || o.procurementMethod === '调拨番禺');
    } else if (warehouseTab === 'direct') {
      list = list.filter(o => o.procurementMethod === '直发');
    }
    if (brandFilter !== 'all') {
      list = list.filter((o) => o.brand === brandFilter);
    }
    return list;
  }, [orders, brandFilter, warehouseTab]);

  const brandList = useMemo(() => {
    const brands = new Set<string>();
    orders.forEach((o) => {
      if (o.status === '已采购' || o.status === '已调拨') {
        if (o.brand) brands.add(o.brand);
      }
    });
    return Array.from(brands).sort();
  }, [orders]);

  const allSelected = unreceivedOrders.length > 0 && selectedIds.size === unreceivedOrders.length;
  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unreceivedOrders.map((o) => o.id)));
    }
  }, [allSelected, unreceivedOrders]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBatchReceived = useCallback(() => {
    if (selectedIds.size === 0) {
      toast.error('请先选择要操作的记录');
      return;
    }
    setBatchConfirmOpen(true);
  }, [selectedIds]);

  const confirmBatchReceived = useCallback(() => {
    selectedIds.forEach((id) => onMarkReceived(id));
    toast.success(`已批量标记 ${selectedIds.size} 条为到货`);
    setSelectedIds(new Set());
    setBatchConfirmOpen(false);
  }, [selectedIds, onMarkReceived]);

  const handleConfirmReceived = useCallback(() => {
    if (!confirmId) return;
    onMarkReceived(confirmId);
    toast.success('已标记为到货');
    setConfirmId(null);
  }, [confirmId, onMarkReceived]);

  const onResizeStart = useCallback(
    (field: string, e: React.MouseEvent) => {
      e.preventDefault();
      resizingRef.current = { field, startX: e.clientX, startWidth: colWidths[field] || 100 };
      const onMove = (ev: MouseEvent) => {
        if (!resizingRef.current) return;
        const delta = ev.clientX - resizingRef.current.startX;
        const newWidth = Math.max(60, resizingRef.current.startWidth + delta);
        setColWidths((prev) => ({ ...prev, [resizingRef.current!.field]: newWidth }));
      };
      const onUp = () => {
        resizingRef.current = null;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [colWidths],
  );

  if (unreceivedOrders.length === 0 && brandFilter === 'all' && warehouseTab === 'all') {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
            <PackageSearch className="size-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">暂无未到货产品</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            所有已采购/已调拨的产品均已到货，或暂无待处理的采购订单
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div
      className="flex flex-col border border-border rounded-xl bg-card shadow-sm"
      >
        {/* 工具栏 */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Warehouse className="size-4 text-muted-foreground" />
            <Tabs value={warehouseTab} onValueChange={setWarehouseTab}>
              <TabsList className="h-8">
                <TabsTrigger value="all" className="text-xs h-7">全部</TabsTrigger>
                <TabsTrigger value="tianhe" className="text-xs h-7">天河仓</TabsTrigger>
                <TabsTrigger value="panyu" className="text-xs h-7">番禺仓</TabsTrigger>
                <TabsTrigger value="direct" className="text-xs h-7">直发</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-1.5 ml-2">
              <Filter className="size-4 text-muted-foreground" />
              <Select value={brandFilter} onValueChange={setBrandFilter}>
                <SelectTrigger className="h-8 w-[130px] text-xs">
                  <SelectValue placeholder="全部品牌" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部品牌</SelectItem>
                  {brandList.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {brandFilter !== 'all' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setBrandFilter('all')}
                >
                  <X className="size-3.5" />
                </Button>
              )}
            </div>

            {selectedIds.size > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">已选 {selectedIds.size} 条</span>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleBatchReceived}>
                  <CheckCircle2 className="size-3.5" />
                  批量到货
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              <AlertCircle className="size-3.5 inline mr-1 text-amber-500" />
              {unreceivedOrders.length} 条
            </span>
          </div>
        </div>

        {/* 表格 — 固定高度容器，独立滚动 */}
        <div className="w-full overflow-x-auto max-h-[calc(100vh-13rem)] overflow-y-auto">
          <table className="w-full border-collapse table-fixed min-w-[900px]">
            <thead className="sticky top-0 z-30">
              <tr>
                <th className="sticky left-0 z-30 border-b-2 border-border bg-muted/90 backdrop-blur-sm px-2 py-3 text-center w-[44px]">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="全选"
                  />
                </th>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className="relative border-b-2 border-border bg-muted/90 backdrop-blur-sm px-2 py-3 text-xs font-bold text-foreground text-center select-none"
                    style={{ width: colWidths[col.key] || col.minWidth, minWidth: 60 }}
                  >
                    {col.label}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/30"
                      onMouseDown={(e) => onResizeStart(col.key, e)}
                    />
                  </th>
                ))}
                <th className="sticky right-0 z-30 border-b-2 border-border bg-muted/90 backdrop-blur-sm px-3 py-3 text-xs font-bold text-foreground text-center w-[100px]">
                  操作
                </th>
              </tr>
            </thead>

            <tbody>
              {unreceivedOrders.length === 0 && brandFilter !== 'all' ? (
                <tr>
                  <td colSpan={COLUMNS.length + 2} className="py-16 text-center text-muted-foreground text-sm">
                    当前品牌筛选下无未到货产品
                  </td>
                </tr>
              ) : (
                unreceivedOrders.map((order, idx) => (
                  <motion.tr
                    key={order.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: idx * 0.03 }}
                    className={`border-b border-border/50 transition-colors ${
                      selectedIds.has(order.id) ? 'bg-primary/5' : 'hover:bg-muted/30'
                    }`}
                  >
                    <td className="sticky left-0 z-20 bg-card px-2 py-2 text-center">
                      <Checkbox
                        checked={selectedIds.has(order.id)}
                        onCheckedChange={() => toggleSelect(order.id)}
                        aria-label={`选择 ${order.productName}`}
                      />
                    </td>
                    {COLUMNS.map((col) => {
                      const value = order[col.key as keyof IOrder];
                      if (col.key === 'status') {
                        return (
                          <td
                            key={col.key}
                            className="px-2 py-2 text-center text-sm font-semibold"
                          >
                            <Badge
                              variant="outline"
                              className={`text-xs font-semibold border ${STATUS_COLORS[String(value)] || 'bg-muted text-muted-foreground'}`}
                            >
                              {String(value)}
                            </Badge>
                          </td>
                        );
                      }
                      if (col.key === 'arrivalTime') {
                        // 只有状态为"已到货"时才显示已到货时间
                        const showTime = order.status === '已到货' && value;
                        return (
                          <td
                            key={col.key}
                            className="px-2 py-2 text-center text-sm font-semibold text-muted-foreground"
                          >
                            {showTime ? String(value) : '-'}
                          </td>
                        );
                      }
                      // text fields: allow word-wrap
                      if (col.key === 'productName' || col.key === 'specification' || col.key === 'remarks' || col.key === 'brand' || col.key === 'catalogNumber') {
                        return (
                          <td
                            key={col.key}
                            className="px-2 py-2 text-sm font-semibold"
                            style={{ width: colWidths[col.key] || col.minWidth }}
                          >
                            <div className="max-w-full whitespace-normal break-words text-center">
                              {String(value ?? '') || '-'}
                            </div>
                          </td>
                        );
                      }
                      return (
                        <td
                          key={col.key}
                          className="whitespace-nowrap px-2 py-2 text-center text-sm font-semibold"
                        >
                          {String(value ?? '') || '-'}
                        </td>
                      );
                    })}
                    <td className="sticky right-0 z-20 bg-card px-2 py-2 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 border-green-300 text-green-700 hover:bg-green-50 hover:text-green-800"
                        onClick={() => setConfirmId(order.id)}
                      >
                        <CheckCircle2 className="size-3.5" />
                        已到货
                      </Button>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AlertDialog open={!!confirmId} onOpenChange={(open) => !open && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认到货</AlertDialogTitle>
            <AlertDialogDescription>
              确认该产品已到货？操作后该条记录将从本页面移除，状态同步更新为"已到货"。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReceived}>确认到货</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={batchConfirmOpen} onOpenChange={setBatchConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>批量确认到货</AlertDialogTitle>
            <AlertDialogDescription>
              确认将选中的 {selectedIds.size} 条记录标记为已到货？操作后这些记录将从本页面移除，状态同步更新为"已到货"。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBatchReceived}>确认到货 ({selectedIds.size} 条)</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
