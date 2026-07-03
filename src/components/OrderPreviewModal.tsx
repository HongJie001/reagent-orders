import { useState, useMemo, useCallback, type FormEvent } from 'react';
import { toast } from 'sonner';
import { IOrder } from '@/data/crud';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Copy, Printer, X, Plus, Trash2 } from 'lucide-react';

// ─── 订单预览行 ──────────────────────────────────────────
interface IOrderLine {
  id: string;
  seq: number;
  brand: string;
  catalogNumber: string;
  productName: string;
  specification: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface OrderPreviewModalProps {
  orders: IOrder[];
  open: boolean;
  onClose: () => void;
}

export default function OrderPreviewModal({ orders, open, onClose }: OrderPreviewModalProps) {
  // ── 头部可编辑字段 ──────────────────────────────────
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [orderDate, setOrderDate] = useState(today);
  const [customer, setCustomer] = useState('');
  const [shippingMethod, setShippingMethod] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [remarks, setRemarks] = useState('');

  // ── 初始化头部字段 ──────────────────────────────────
  const [initialized, setInitialized] = useState(false);
  if (open && !initialized) {
    const first = orders[0];
    setOrderDate(today);
    setCustomer(first?.customer ?? '');
    setShippingMethod('');
    setDeliveryAddress('');
    setContactPerson('');
    setContactPhone('');
    setRemarks('');
    setInitialized(true);
  }
  if (!open && initialized) {
    // reset flag when closed
    setTimeout(() => setInitialized(false), 200);
  }

  // ── 产品明细 ────────────────────────────────────────
  const [lines, setLines] = useState<IOrderLine[]>([]);
  const [linesInit, setLinesInit] = useState(false);
  if (open && !linesInit) {
    const initLines = orders.map((o, i) => ({
      id: `line-${o.id}-${i}`,
      seq: i + 1,
      brand: o.brand,
      catalogNumber: o.catalogNumber,
      productName: o.productName,
      specification: o.specification,
      quantity: o.quantity,
      unitPrice: o.unitPrice,
      amount: o.totalPrice,
    }));
    setLines(initLines);
    setLinesInit(true);
  }
  if (!open && linesInit) {
    setTimeout(() => setLinesInit(false), 200);
  }

  const updateLine = useCallback((lineId: string, field: keyof IOrderLine, value: string | number) => {
    setLines(prev => prev.map(l => {
      if (l.id !== lineId) return l;
      const updated = { ...l, [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        updated.amount = updated.quantity * updated.unitPrice;
      }
      return updated;
    }));
  }, []);

  const deleteLine = useCallback((lineId: string) => {
    setLines(prev => {
      const filtered = prev.filter(l => l.id !== lineId);
      return filtered.map((l, i) => ({ ...l, seq: i + 1 }));
    });
  }, []);

  const addLine = useCallback(() => {
    const newId = `line-new-${Date.now()}`;
    setLines(prev => [...prev, {
      id: newId,
      seq: prev.length + 1,
      brand: '',
      catalogNumber: '',
      productName: '',
      specification: '',
      quantity: 1,
      unitPrice: 0,
      amount: 0,
    }]);
  }, []);

  // ── 合计 ────────────────────────────────────────────
  const totals = useMemo(() => {
    const totalQty = lines.reduce((s, l) => s + l.quantity, 0);
    const totalAmount = lines.reduce((s, l) => s + l.amount, 0);
    return { totalQty, totalAmount };
  }, [lines]);

  // ── 复制 ────────────────────────────────────────────
  const handleCopy = useCallback(() => {
    const headerLines = [
      `订单日期：${orderDate}`,
      `客户名称：${customer}`,
      `发货方式：${shippingMethod}`,
      `收货地址：${deliveryAddress}`,
      `联系人：${contactPerson}`,
      `联系电话：${contactPhone}`,
      `备注：${remarks}`,
      '',
      '序号\t品牌\t货号\t产品名称\t规格\t数量\t单价\t金额',
    ];
    const dataLines = lines.map(l =>
      `${l.seq}\t${l.brand}\t${l.catalogNumber}\t${l.productName}\t${l.specification}\t${l.quantity}\t${l.unitPrice.toFixed(2)}\t${l.amount.toFixed(2)}`
    );
    const footerLines = [
      '',
      `合计数量：${totals.totalQty}\t合计金额：¥${totals.totalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`,
    ];
    const text = [...headerLines, ...dataLines, ...footerLines].join('\n');
    navigator.clipboard.writeText(text).then(() => {
      toast.success('已复制订单内容');
    }).catch(() => {
      toast.error('复制失败，请手动复制');
    });
  }, [orderDate, customer, shippingMethod, deliveryAddress, contactPerson, contactPhone, remarks, lines, totals]);

  // ── 打印 ────────────────────────────────────────────
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[95vw] w-[1100px] h-[92vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg">订单预览</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                所有字段均可编辑，修改后可直接复制或打印
              </DialogDescription>
            </div>
            <Button variant="ghost" size="icon" className="size-8" onClick={onClose}>
              <X className="size-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* 内容区 — 可滚动 */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* ── 头部信息 ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">订单日期</Label>
              <Input
                type="date"
                value={orderDate}
                onChange={e => setOrderDate(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">客户名称</Label>
              <Input
                value={customer}
                onChange={e => setCustomer(e.target.value)}
                className="h-9 text-sm"
                placeholder="客户名称"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">发货方式</Label>
              <Input
                value={shippingMethod}
                onChange={e => setShippingMethod(e.target.value)}
                className="h-9 text-sm"
                placeholder="如：快递、自提"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs text-muted-foreground">收货地址</Label>
              <Input
                value={deliveryAddress}
                onChange={e => setDeliveryAddress(e.target.value)}
                className="h-9 text-sm"
                placeholder="详细收货地址"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">联系人</Label>
              <Input
                value={contactPerson}
                onChange={e => setContactPerson(e.target.value)}
                className="h-9 text-sm"
                placeholder="联系人"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">联系电话</Label>
              <Input
                value={contactPhone}
                onChange={e => setContactPhone(e.target.value)}
                className="h-9 text-sm"
                placeholder="联系电话"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs text-muted-foreground">备注</Label>
              <Textarea
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                className="text-sm min-h-[40px]"
                rows={2}
                placeholder="备注信息"
              />
            </div>
          </div>

          {/* ── 产品明细表格 ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-foreground">产品明细</h3>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addLine}>
                <Plus className="size-3 mr-1" />
                新增行
              </Button>
            </div>
            <div className="border border-border rounded-md overflow-hidden">
              <div className="w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-center text-xs font-bold w-[50px]">序号</TableHead>
                      <TableHead className="text-center text-xs font-bold min-w-[80px]">品牌</TableHead>
                      <TableHead className="text-center text-xs font-bold min-w-[100px]">货号</TableHead>
                      <TableHead className="text-center text-xs font-bold min-w-[140px]">产品名称</TableHead>
                      <TableHead className="text-center text-xs font-bold min-w-[100px]">规格</TableHead>
                      <TableHead className="text-center text-xs font-bold w-[70px]">数量</TableHead>
                      <TableHead className="text-center text-xs font-bold w-[90px]">单价</TableHead>
                      <TableHead className="text-center text-xs font-bold w-[100px]">金额</TableHead>
                      <TableHead className="text-center text-xs font-bold w-[60px]">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line) => (
                      <TableRow key={line.id} className="hover:bg-muted/30">
                        <TableCell className="text-center text-sm font-semibold py-1.5">{line.seq}</TableCell>
                        <TableCell className="p-1">
                          <Input
                            value={line.brand}
                            onChange={e => updateLine(line.id, 'brand', e.target.value)}
                            className="h-8 text-sm text-center border-0 bg-transparent hover:bg-muted/50 focus:bg-background"
                          />
                        </TableCell>
                        <TableCell className="p-1">
                          <Input
                            value={line.catalogNumber}
                            onChange={e => updateLine(line.id, 'catalogNumber', e.target.value)}
                            className="h-8 text-sm text-center border-0 bg-transparent hover:bg-muted/50 focus:bg-background"
                          />
                        </TableCell>
                        <TableCell className="p-1">
                          <Input
                            value={line.productName}
                            onChange={e => updateLine(line.id, 'productName', e.target.value)}
                            className="h-8 text-sm text-center border-0 bg-transparent hover:bg-muted/50 focus:bg-background"
                          />
                        </TableCell>
                        <TableCell className="p-1">
                          <Input
                            value={line.specification}
                            onChange={e => updateLine(line.id, 'specification', e.target.value)}
                            className="h-8 text-sm text-center border-0 bg-transparent hover:bg-muted/50 focus:bg-background"
                          />
                        </TableCell>
                        <TableCell className="p-1">
                          <Input
                            type="number"
                            min={1}
                            value={line.quantity}
                            onChange={e => updateLine(line.id, 'quantity', parseInt(e.target.value) || 0)}
                            className="h-8 text-sm text-center border-0 bg-transparent hover:bg-muted/50 focus:bg-background"
                          />
                        </TableCell>
                        <TableCell className="p-1">
                          <Input
                            type="number"
                            step="0.01"
                            value={line.unitPrice}
                            onChange={e => updateLine(line.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="h-8 text-sm text-center border-0 bg-transparent hover:bg-muted/50 focus:bg-background"
                          />
                        </TableCell>
                        <TableCell className="text-center text-sm font-semibold tabular-nums py-1.5">
                          ¥{line.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-center py-1.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            onClick={() => deleteLine(line.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* 合计行 */}
              <div className="flex items-center justify-end gap-6 px-4 py-2.5 border-t border-border bg-muted/30">
                <span className="text-sm font-bold text-foreground">
                  合计数量：<span className="tabular-nums">{totals.totalQty}</span>
                </span>
                <span className="text-sm font-bold text-foreground">
                  合计金额：<span className="tabular-nums text-primary">¥{totals.totalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 底部操作栏 */}
        <div className="px-6 py-3 border-t border-border shrink-0 flex items-center justify-between bg-muted/20">
          <span className="text-xs text-muted-foreground">
            共 {lines.length} 条产品 · 选中 {orders.length} 个订单
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCopy}>
              <Copy className="size-4" />
              复制
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePrint}>
              <Printer className="size-4" />
              打印
            </Button>
            <Button size="sm" onClick={onClose}>
              关闭
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
