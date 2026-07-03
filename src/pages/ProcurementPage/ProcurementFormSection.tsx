import { useState, type FormEvent, useCallback } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Search, Save, ArrowLeft, ExternalLink, Copy, Check, Loader2, Globe } from 'lucide-react';
import { scopedStorage } from '@lark-apaas/client-toolkit-lite';
import { IOrder, MOCK_ORDERS } from '@/data/crud';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const STORAGE_KEY = '__app_reagent_orders';

function loadOrders(): IOrder[] {
  try {
    const raw = scopedStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as IOrder[];
  } catch { /* ignore */ }
  return MOCK_ORDERS;
}

function saveOrders(orders: IOrder[]) {
  scopedStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
}

interface ProcurementFormSectionProps {
  onBack: () => void;
}

const DEFAULT_VALUES = {
  procurementDate: new Date().toISOString().slice(0, 10),
  procurementMethod: '天河',
  status: '待处理' as IOrder['status'],
  orderForm: '常规' as IOrder['orderForm'],
  customer: '',
  brand: '',
  catalogNumber: '',
  productName: '',
  specification: '',
  listPrice: '',
  quantity: '1',
  unitPrice: '',
  totalPrice: '',
  remarks: '',
  arrivalTime: '',
};

export default function ProcurementFormSection({ onBack }: ProcurementFormSectionProps) {
  const { canAdd } = useAuth();
  const [form, setForm] = useState({ ...DEFAULT_VALUES });
  const [submitting, setSubmitting] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchUrl, setSearchUrl] = useState('');
  const [iframeLoading, setIframeLoading] = useState(false);
  const [manualProductName, setManualProductName] = useState('');

  const updateField = (field: string, value: string) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      // auto-calc totalPrice
      if (field === 'quantity' || field === 'unitPrice' || field === 'listPrice') {
        const qty = parseFloat(next.quantity) || 0;
        const up = parseFloat(next.unitPrice) || 0;
        next.totalPrice = String(qty * up);
      }
      return next;
    });
  };

  const handleCatalogSearch = useCallback(() => {
    const catalog = form.catalogNumber.trim();
    if (!catalog) {
      toast.error('请先输入货号');
      return;
    }
    const url = `https://www.rjmart.cn/searchProduct?key=${encodeURIComponent(catalog)}`;
    setSearchUrl(url);
    setIframeLoading(true);
    setManualProductName('');
    setSearchOpen(true);
  }, [form.catalogNumber]);

  const handleApplyProductName = useCallback(() => {
    if (!manualProductName.trim()) {
      toast.error('请先输入产品名称');
      return;
    }
    updateField('productName', manualProductName.trim());
    setSearchOpen(false);
    toast.success('已回填产品名称');
  }, [manualProductName]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canAdd) {
      toast.error('当前用户无新增权限');
      return;
    }
    if (!form.customer.trim()) {
      toast.error('请填写客户名称');
      return;
    }
    if (!form.productName.trim()) {
      toast.error('请填写产品名称');
      return;
    }

    setSubmitting(true);
    const orders = loadOrders();
    const newOrder: IOrder = {
      id: String(Date.now()),
      procurementDate: form.procurementDate,
      procurementMethod: form.procurementMethod,
      status: form.status,
      orderForm: form.orderForm,
      customer: form.customer.trim(),
      brand: form.brand.trim(),
      catalogNumber: form.catalogNumber.trim(),
      productName: form.productName.trim(),
      specification: form.specification.trim(),
      listPrice: parseFloat(form.listPrice) || 0,
      quantity: parseInt(form.quantity) || 1,
      unitPrice: parseFloat(form.unitPrice) || 0,
      totalPrice: parseFloat(form.totalPrice) || 0,
      remarks: form.remarks.trim(),
      arrivalTime: form.arrivalTime.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'user',
    };

    saveOrders([...orders, newOrder]);
    toast.success('订单已保存');
    setForm({ ...DEFAULT_VALUES });
    setSubmitting(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-lg mx-auto"
    >
      <Card className="border-border/40">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="size-8" onClick={onBack}>
              <ArrowLeft className="size-4" />
            </Button>
            <CardTitle className="text-base">表单录入</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground">适合手机端填写</span>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* 采购日期 */}
            <div className="space-y-1.5">
              <Label htmlFor="f-procurementDate">采购日期</Label>
              <Input
                id="f-procurementDate"
                type="date"
                value={form.procurementDate}
                onChange={e => updateField('procurementDate', e.target.value)}
              />
            </div>

            {/* 状态 */}
            <div className="space-y-1.5">
              <Label htmlFor="f-status">状态</Label>
              <Select value={form.status} onValueChange={v => updateField('status', v)}>
                <SelectTrigger id="f-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="待处理">待处理</SelectItem>
                  <SelectItem value="已采购">已采购</SelectItem>
                  <SelectItem value="已调拨">已调拨</SelectItem>
                  <SelectItem value="已到货">已到货</SelectItem>
                  <SelectItem value="已发货">已发货</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 采购方式 */}
            <div className="space-y-1.5">
              <Label htmlFor="f-procurementMethod">采购方式</Label>
              <Select value={form.procurementMethod} onValueChange={v => updateField('procurementMethod', v)}>
                <SelectTrigger id="f-procurementMethod">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="天河">天河</SelectItem>
                  <SelectItem value="番禺">番禺</SelectItem>
                  <SelectItem value="调拨天河">调拨天河</SelectItem>
                  <SelectItem value="调拨番禺">调拨番禺</SelectItem>
                  <SelectItem value="直发">直发</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 订单形式 */}
            <div className="space-y-1.5">
              <Label htmlFor="f-orderForm">订单形式</Label>
              <Select value={form.orderForm} onValueChange={v => updateField('orderForm', v)}>
                <SelectTrigger id="f-orderForm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="常规">常规</SelectItem>
                  <SelectItem value="线下">线下</SelectItem>
                  <SelectItem value="后补单">后补单</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 客户 */}
            <div className="space-y-1.5">
              <Label htmlFor="f-customer">客户 *</Label>
              <Input
                id="f-customer"
                value={form.customer}
                onChange={e => updateField('customer', e.target.value)}
                placeholder="输入客户名称"
              />
            </div>

            {/* 品牌 */}
            <div className="space-y-1.5">
              <Label htmlFor="f-brand">品牌</Label>
              <Input
                id="f-brand"
                value={form.brand}
                onChange={e => updateField('brand', e.target.value)}
                placeholder="如 Sigma、Thermo"
              />
            </div>

            {/* 货号 + 检索按钮 */}
            <div className="space-y-1.5">
              <Label htmlFor="f-catalogNumber">货号</Label>
              <div className="flex gap-2">
                <Input
                  id="f-catalogNumber"
                  value={form.catalogNumber}
                  onChange={e => updateField('catalogNumber', e.target.value)}
                  placeholder="如 S7388"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 shrink-0"
                  onClick={handleCatalogSearch}
                >
                  <Search className="size-4" />
                  检索
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                点击检索在锐竞采购平台搜索产品信息
                <ExternalLink className="size-3 inline ml-0.5" />
              </p>
            </div>

            {/* 产品名称 */}
            <div className="space-y-1.5">
              <Label htmlFor="f-productName">产品名称 *</Label>
              <Input
                id="f-productName"
                value={form.productName}
                onChange={e => updateField('productName', e.target.value)}
                placeholder="输入产品名称"
              />
            </div>

            {/* 规格 */}
            <div className="space-y-1.5">
              <Label htmlFor="f-specification">规格</Label>
              <Input
                id="f-specification"
                value={form.specification}
                onChange={e => updateField('specification', e.target.value)}
                placeholder="如 500g/瓶"
              />
            </div>

            {/* 目录价 + 单价 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="f-listPrice">目录价</Label>
                <Input
                  id="f-listPrice"
                  type="number"
                  step="0.01"
                  value={form.listPrice}
                  onChange={e => updateField('listPrice', e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-unitPrice">单价</Label>
                <Input
                  id="f-unitPrice"
                  type="number"
                  step="0.01"
                  value={form.unitPrice}
                  onChange={e => updateField('unitPrice', e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            {/* 数量 + 总价 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="f-quantity">数量</Label>
                <Input
                  id="f-quantity"
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={e => updateField('quantity', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-totalPrice">总价</Label>
                <Input
                  id="f-totalPrice"
                  type="number"
                  step="0.01"
                  value={form.totalPrice}
                  onChange={e => updateField('totalPrice', e.target.value)}
                  readOnly
                  className="bg-muted/50"
                />
              </div>
            </div>

            {/* 已到货时间 — 仅状态为已到货时显示 */}
            {form.status === '已到货' && (
              <div className="space-y-1.5">
                <Label htmlFor="f-arrivalTime">已到货时间</Label>
                <Input
                  id="f-arrivalTime"
                  type="date"
                  value={form.arrivalTime ? form.arrivalTime.slice(0, 10) : ''}
                  onChange={e => updateField('arrivalTime', e.target.value)}
                />
              </div>
            )}

            {/* 备注 */}
            <div className="space-y-1.5">
              <Label htmlFor="f-remarks">备注</Label>
              <Textarea
                id="f-remarks"
                value={form.remarks}
                onChange={e => updateField('remarks', e.target.value)}
                placeholder="备注信息"
                rows={2}
              />
            </div>

            {/* 提交按钮 */}
            <Button
              type="submit"
              className="w-full"
              disabled={submitting || !canAdd}
            >
              {submitting ? (
                <span className="animate-spin size-4 border-2 border-current border-t-transparent rounded-full mr-1.5" />
              ) : (
                <Save className="size-4 mr-1.5" />
              )}
              保存订单
            </Button>

            {!canAdd && (
              <p className="text-xs text-destructive text-center">
                当前用户为查看者，无新增权限
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      {/* 货号检索弹窗 — 大尺寸，优先新窗口打开 */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-[95vw] w-[1200px] h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 py-3 border-b border-border shrink-0">
            <DialogTitle className="text-base flex items-center gap-2">
              <Globe className="size-4" />
              货号检索：{form.catalogNumber || '-'}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              <span>锐竞采购平台可能限制内嵌显示，建议点击右侧按钮在新窗口打开</span>
              <Button
                size="sm"
                variant="default"
                className="gap-1.5 ml-auto"
                onClick={() => {
                  window.open(searchUrl, '_blank', 'noopener,noreferrer');
                }}
              >
                <ExternalLink className="size-3.5" />
                在新窗口打开检索
              </Button>
            </DialogDescription>
          </DialogHeader>

          {/* iframe 区域 — 增大尺寸 */}
          <div className="flex-1 relative min-h-0">
            {iframeLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="size-8 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">正在加载搜索结果...</span>
                  <span className="text-xs text-muted-foreground">如长时间空白，请使用「新窗口打开」</span>
                </div>
              </div>
            )}
            <iframe
              src={searchUrl}
              className="w-full h-full border-0"
              title="锐竞采购平台检索"
              onLoad={() => setIframeLoading(false)}
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            />
          </div>

          {/* 底部回填区 */}
          <div className="px-4 py-3 border-t border-border shrink-0 flex items-center gap-3 bg-muted/30">
            <Label htmlFor="manual-pn" className="text-sm shrink-0 whitespace-nowrap">
              产品名称：
            </Label>
            <Input
              id="manual-pn"
              value={manualProductName}
              onChange={e => setManualProductName(e.target.value)}
              placeholder="在新窗口复制产品名称后粘贴到这里"
              className="flex-1"
              onKeyDown={e => {
                if (e.key === 'Enter') handleApplyProductName();
              }}
            />
            <Button size="sm" onClick={handleApplyProductName} className="gap-1.5 shrink-0">
              <Check className="size-4" />
              回填
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
