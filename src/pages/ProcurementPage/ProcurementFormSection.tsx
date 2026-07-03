import { useState, type FormEvent, useCallback } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Save, ArrowLeft, Sparkles, RotateCcw } from 'lucide-react';
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
  const [parseText, setParseText] = useState('');

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

  const handleParseText = useCallback(() => {
    const text = parseText.trim();
    if (!text) {
      toast.error('请先粘贴或输入订单信息');
      return;
    }
    const result: Record<string, string> = {};

    // ─── 字段关键词模糊匹配表（支持简写、别名、部分匹配）───
    const fieldKeywords: Array<{ field: string; keys: string[] }> = [
      { field: 'customer',        keys: ['客户', '顾客', '收货人', '单位', '医院', '学院', '课题组', '课题', '实验室'] },
      { field: 'brand',           keys: ['品牌', '厂家', '厂商'] },
      { field: 'catalogNumber',   keys: ['货号', '编号', '产品编号', '目录号', 'cat'] },
      { field: 'productName',     keys: ['产品名称', '产品名', '品名', '试剂名', '名称'] },
      { field: 'specification',   keys: ['规格', '包装', '装量'] },
      { field: 'listPrice',       keys: ['目录价', '标价', '挂牌价'] },
      { field: 'unitPrice',       keys: ['单价', '成交价', '实价', '折扣价'] },
      { field: 'quantity',        keys: ['数量', '支数', '瓶数', '个数'] },
      { field: 'totalPrice',      keys: ['总价', '合计', '总金额', '总额'] },
      { field: 'remarks',         keys: ['备注', '说明', '用途', '备注信息'] },
      { field: 'procurementMethod', keys: ['采购方式', '采购渠道', '仓库'] },
      { field: 'orderForm',       keys: ['订单形式', '订单类型', '形式'] },
    ];

    // ─── 模式 1：key:value（支持模糊匹配字段名）───
    const lines = text.split(/[\n\r]+/).filter(l => l.trim());
    const kvPattern = /(.+?)[\s]*[：:=\-—][\s]*(.+)/;
    let matchedLines = 0;
    for (const line of lines) {
      const m = line.trim().match(kvPattern);
      if (!m) continue;
      const keyPart = m[1].trim();
      const valPart = m[2].trim();
      if (!valPart) continue;
      // 模糊匹配字段名
      for (const fk of fieldKeywords) {
        if (fk.keys.some(kw => keyPart.includes(kw) || kw.includes(keyPart))) {
          if (!result[fk.field]) {
            result[fk.field] = valPart;
            matchedLines++;
          }
          break;
        }
      }
    }

    // ─── 模式 2：Tab 分隔（Excel 粘贴）───
    if (matchedLines === 0 && lines.length > 0) {
      const cells = lines[0].split('\t');
      if (cells.length >= 5) {
        const fieldOrder = ['customer', 'brand', 'catalogNumber', 'productName', 'specification', 'listPrice', 'quantity', 'unitPrice', 'totalPrice', 'remarks'];
        cells.forEach((cell, i) => {
          if (i < fieldOrder.length && cell.trim()) {
            result[fieldOrder[i]] = cell.trim();
            matchedLines++;
          }
        });
      }
    }

    // ─── 模式 3：智能提取（无标签，按文本特征推断）───
    if (matchedLines === 0) {
      const joined = lines.join(' ');
      // 提取数字
      const numbers = [...joined.matchAll(/(\d+(?:\.\d+)?)/g)].map(m => parseFloat(m[1]));
      // 尝试识别价格类数字
      if (numbers.length >= 1) {
        const bigNums = numbers.filter(n => n >= 10);
        const smallNums = numbers.filter(n => n > 0 && n < 10 && Number.isInteger(n));
        if (bigNums.length >= 2) {
          result['listPrice'] = String(Math.max(bigNums[0], bigNums[1]));
          result['unitPrice'] = String(Math.min(bigNums[0], bigNums[1]));
        } else if (bigNums.length === 1) {
          result['unitPrice'] = String(bigNums[0]);
        }
        if (smallNums.length > 0) {
          result['quantity'] = String(smallNums[0]);
        }
      }
      // 提取货号模式（字母+数字组合，如 S7388、A1234）
      const catMatch = joined.match(/[A-Za-z]\d{3,6}/);
      if (catMatch) result['catalogNumber'] = catMatch[0];
      // 提取规格模式（如 500g、100ml、25kg）
      const specMatch = joined.match(/(\d+\s*(?:g|mg|kg|ml|L|μl|ul|μL)[\/／]?\s*(?:瓶|支|盒|包|管|桶|罐|袋)?)/i);
      if (specMatch) result['specification'] = specMatch[0];
      // 提取常见品牌
      const knownBrands = ['Sigma', 'Thermo', 'Abcam', 'Merck', 'Fluka', 'Alfa', 'TCI', '阿拉丁', '麦克林', '毕得', '安耐吉', '罗恩', '源叶', '泰坦'];
      for (const b of knownBrands) {
        if (joined.includes(b)) { result['brand'] = b; break; }
      }
    }

    if (Object.keys(result).length === 0) {
      toast.error('未能识别出有效字段，请尝试分行输入或使用「字段名：值」格式');
      return;
    }

    // 应用到表单（覆盖空字段或默认值）
    setForm(prev => {
      const next = { ...prev };
      for (const [field, value] of Object.entries(result)) {
        if (field in next) {
          const current = next[field as keyof typeof next];
          if (!current || current === '' || current === '0' || current === '1') {
            (next as Record<string, string>)[field] = value;
          }
        }
      }
      // 自动计算总价
      const qty = parseFloat(next.quantity) || 0;
      const up = parseFloat(next.unitPrice) || 0;
      if (qty && up) next.totalPrice = String(qty * up);
      return next;
    });
    toast.success(`已识别并填充 ${Object.keys(result).length} 个字段`);
  }, [parseText]);

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

            {/* 货号 */}
            <div className="space-y-1.5">
              <Label htmlFor="f-catalogNumber">货号</Label>
              <Input
                id="f-catalogNumber"
                value={form.catalogNumber}
                onChange={e => updateField('catalogNumber', e.target.value)}
                placeholder="如 S7388"
              />
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

      {/* 文字识别卡片 */}
      <Card className="mt-4 border-border/40">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            文字识别录入
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setParseText('')}
          >
            <RotateCcw className="size-3" />
            清空
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            粘贴订单信息文本，自动识别客户、品牌、货号、产品名称、规格、目录价、单价等字段。支持「字段名：值」格式或 Tab 分隔的 Excel 粘贴。
          </p>
          <Textarea
            value={parseText}
            onChange={e => setParseText(e.target.value)}
            placeholder={"示例：\n客户：中山大学化学学院\n品牌：Sigma\n货号：S7388\n产品名称：聚苯乙烯磺酸钠\n规格：500g/瓶\n目录价：1280\n单价：1024\n数量：2"}
            rows={6}
            className="text-xs font-mono"
          />
          <Button
            type="button"
            className="w-full gap-1.5"
            onClick={handleParseText}
            disabled={!parseText.trim()}
          >
            <Sparkles className="size-4" />
            识别并填充
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
