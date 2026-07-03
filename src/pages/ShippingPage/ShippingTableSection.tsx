import { useState, useEffect, useCallback, useRef, useMemo, type ChangeEvent } from 'react';
import { toast } from 'sonner';
import { logger, scopedStorage } from '@lark-apaas/client-toolkit-lite';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Image } from '@/components/ui/image';
import { MOCK_LOGISTICS_MAP, type ILogisticsNode } from '@/data/logistics';
import { useColumnMemory } from '@/hooks/useColumnMemory';
import {
  Plus,
  X,
  Upload,
  ImageIcon,
  FileText,
  Trash2,
  PackageCheck,
  Clock,
  MapPin,
  Search,
  Truck,
  Filter,
} from 'lucide-react';

// ── 类型定义 ──────────────────────────────────────────────

interface IAttachment {
  name: string;
  data: string;
}

interface IShipment {
  id: string;
  screenshots: string[];
  attachments: IAttachment[];
  deliveryAddress: string;
  remindCourier: string;
  trackingNumber: string;
  logisticsInfo: ILogisticsNode[];
  status: '待发货' | '已发货';
  shippedTime?: string;
  createdAt: string;
  updatedAt: string;
  source?: 'mock' | 'user';
}

interface ICustomOptions {
  procurementMethods: string[];
  orderForms: string[];
  remindCouriers: string[];
}

// ── 常量 ──────────────────────────────────────────────────

const STORAGE_KEY = '__app_reagent_shipments';
const OPTIONS_KEY = '__app_reagent_custom_options';
const DEFAULT_COURIERS = ['天河宾', '番禺荣'];

const DEFAULT_CUSTOM_OPTIONS: ICustomOptions = {
  procurementMethods: ['天河'],
  orderForms: ['常规', '线下', '后补单'],
  remindCouriers: DEFAULT_COURIERS,
};

const MOCK_SHIPMENTS: IShipment[] = [
  {
    id: 's1',
    screenshots: [],
    attachments: [],
    deliveryAddress: '广州市天河区五山路381号华南理工大学化学楼302室',
    remindCourier: '天河宾',
    trackingNumber: 'SF1234567890',
    logisticsInfo: MOCK_LOGISTICS_MAP['SF1234567890'] ?? [],
    status: '待发货',
    createdAt: '2025-01-15T08:30:00Z',
    updatedAt: '2025-01-15T08:30:00Z',
    source: 'mock',
  },
  {
    id: 's2',
    screenshots: [],
    attachments: [],
    deliveryAddress: '深圳市南山区学苑大道1066号深圳大学实验楼A栋',
    remindCourier: '番禺荣',
    trackingNumber: '',
    logisticsInfo: [],
    status: '待发货',
    createdAt: '2025-01-14T10:00:00Z',
    updatedAt: '2025-01-14T10:00:00Z',
    source: 'mock',
  },
  {
    id: 's3',
    screenshots: [],
    attachments: [],
    deliveryAddress: '广州市番禺区大学城外环西路230号广州大学生化楼',
    remindCourier: '天河宾',
    trackingNumber: 'YT9876543210',
    logisticsInfo: MOCK_LOGISTICS_MAP['YT9876543210'] ?? [],
    status: '已发货',
    createdAt: '2025-01-13T09:00:00Z',
    updatedAt: '2025-01-14T16:00:00Z',
    source: 'mock',
  },
];

// ── 工具函数 ──────────────────────────────────────────────

function generateId(): string {
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadCustomOptions(): ICustomOptions {
  try {
    const raw = scopedStorage.getItem(OPTIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ICustomOptions>;
      return {
        procurementMethods: parsed.procurementMethods ?? DEFAULT_CUSTOM_OPTIONS.procurementMethods,
        orderForms: parsed.orderForms ?? DEFAULT_CUSTOM_OPTIONS.orderForms,
        remindCouriers: parsed.remindCouriers ?? DEFAULT_CUSTOM_OPTIONS.remindCouriers,
      };
    }
  } catch {
    logger.warn('Failed to parse custom options, using defaults');
  }
  return DEFAULT_CUSTOM_OPTIONS;
}

function saveCustomOptions(options: ICustomOptions): void {
  scopedStorage.setItem(OPTIONS_KEY, JSON.stringify(options));
}

function loadShipments(): IShipment[] {
  try {
    const raw = scopedStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as IShipment[];
    }
  } catch {
    logger.warn('Failed to parse shipments, using mock data');
  }
  return MOCK_SHIPMENTS;
}

function saveShipments(shipments: IShipment[]): void {
  scopedStorage.setItem(STORAGE_KEY, JSON.stringify(shipments));
}

function lookupLogistics(trackingNumber: string): ILogisticsNode[] {
  if (!trackingNumber.trim()) return [];
  return MOCK_LOGISTICS_MAP[trackingNumber] ?? [];
}

// ── 组件 ──────────────────────────────────────────────────

export default function ShippingTableSection() {
  const [shipments, setShipments] = useState<IShipment[]>(() => loadShipments());
  const [customCouriers, setCustomCouriers] = useState<string[]>(() => loadCustomOptions().remindCouriers);
  const [uploadTarget, setUploadTarget] = useState<{ id: string; type: 'screenshots' | 'attachments' } | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [shipConfirmId, setShipConfirmId] = useState<string | null>(null);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [newCourierOpen, setNewCourierOpen] = useState(false);
  const [newCourierValue, setNewCourierValue] = useState('');
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  // ─── column memory ────────────────────────────────────────────────
  const { remember, suggest } = useColumnMemory();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestIndex, setSuggestIndex] = useState(-1);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [filterCourier, setFilterCourier] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showFilter, setShowFilter] = useState(false);

  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  // ── 筛选后的数据 ──────────────────────────────────────

  const filteredShipments = useMemo(() => {
    return shipments.filter((s) => {
      if (filterCourier !== 'all' && s.remindCourier !== filterCourier) return false;
      if (filterStatus !== 'all' && s.status !== filterStatus) return false;
      return true;
    });
  }, [shipments, filterCourier, filterStatus]);

  // ── 持久化 ────────────────────────────────────────────

  useEffect(() => {
    saveShipments(shipments);
  }, [shipments]);

  useEffect(() => {
    const options = loadCustomOptions();
    options.remindCouriers = customCouriers;
    saveCustomOptions(options);
  }, [customCouriers]);

  // ── 多标签页同步 ──────────────────────────────────────

  useEffect(() => {
    const handler = () => {
      const stored = loadShipments();
      setShipments(stored);
      const opts = loadCustomOptions();
      setCustomCouriers(opts.remindCouriers);
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // ── 行操作 ────────────────────────────────────────────

  const addRow = useCallback(() => {
    const now = new Date().toISOString();
    const newShipment: IShipment = {
      id: generateId(),
      screenshots: [],
      attachments: [],
      deliveryAddress: '',
      remindCourier: customCouriers[0] ?? '天河宾',
      trackingNumber: '',
      logisticsInfo: [],
      status: '待发货',
      createdAt: now,
      updatedAt: now,
      source: 'user',
    };
    setShipments(prev => [...prev, newShipment]);
    toast.success('已新增发货记录');
  }, [customCouriers]);

  const deleteRow = useCallback((id: string) => {
    setShipments(prev => prev.filter(s => s.id !== id));
    setDeleteTargetId(null);
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    toast.success('已删除发货记录');
  }, []);

  const updateField = useCallback((id: string, field: keyof IShipment, value: unknown) => {
    setShipments(prev =>
      prev.map(s =>
        s.id === id
          ? { ...s, [field]: value, updatedAt: new Date().toISOString() }
          : s,
      ),
    );
  }, []);

  const markShipped = useCallback((id: string) => {
    const now = new Date();
    const shippedTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    setShipments(prev =>
      prev.map(s =>
        s.id === id
          ? { ...s, status: '已发货' as const, shippedTime, updatedAt: new Date().toISOString() }
          : s,
      ),
    );
    toast.success('已标记为已发货', {
      action: {
        label: '撤销',
        onClick: () => {
          setShipments(prev =>
            prev.map(s =>
              s.id === id
                ? { ...s, status: '待发货' as const, shippedTime: '', updatedAt: new Date().toISOString() }
                : s,
            ),
          );
          toast.success('已撤销发货标记');
        },
      },
    });
  }, []);

  // ── 批量操作 ──────────────────────────────────────────

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredShipments.length && filteredShipments.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredShipments.map(s => s.id)));
    }
  }, [selectedIds, filteredShipments]);

  const batchDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    setShipments(prev => prev.filter(s => !selectedIds.has(s.id)));
    toast.success(`已批量删除 ${selectedIds.size} 条记录`);
    setSelectedIds(new Set());
    setBatchDeleteOpen(false);
  }, [selectedIds]);

  const batchMarkShipped = useCallback(() => {
    if (selectedIds.size === 0) return;
    const now = new Date();
    const shippedTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    setShipments(prev =>
      prev.map(s =>
        selectedIds.has(s.id) && s.status === '待发货'
          ? { ...s, status: '已发货' as const, shippedTime, updatedAt: new Date().toISOString() }
          : s,
      ),
    );
    const count = Array.from(selectedIds).filter(id => {
      const s = shipments.find(x => x.id === id);
      return s?.status === '待发货';
    }).length;
    toast.success(`已批量标记 ${count} 条为已发货`);
    setSelectedIds(new Set());
  }, [selectedIds, shipments]);

  const clearFilter = useCallback(() => {
    setFilterCourier('all');
    setFilterStatus('all');
  }, []);

  // ── 双击编辑 ──────────────────────────────────────────

  const startEdit = useCallback((id: string, field: string, currentValue: string) => {
    setEditingCell({ id, field });
    setEditValue(currentValue);
  }, []);

  const commitEdit = useCallback(() => {
    if (!editingCell) return;
    const field = editingCell.field as keyof IShipment;
    updateField(editingCell.id, field, editValue);
    // 记录到同列记忆
    const textFields = ['deliveryAddress', 'trackingNumber', 'remindCourier'];
    if (textFields.includes(field) && editValue.trim()) {
      remember(field, editValue.trim());
    }
    setEditingCell(null);
    setEditValue('');
    setSuggestions([]);
    setSuggestIndex(-1);
  }, [editingCell, editValue, updateField, remember]);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
    setSuggestions([]);
    setSuggestIndex(-1);
  }, []);

  // ─── column memory suggestion handler ───────────────────────────
  const handleEditValueChange = useCallback((value: string, field: string) => {
    setEditValue(value);
    const textFields = ['deliveryAddress', 'trackingNumber', 'remindCourier'];
    if (textFields.includes(field) && value.trim().length >= 1) {
      const matches = suggest(field, value);
      setSuggestions(matches);
      setSuggestIndex(-1);
    } else {
      setSuggestions([]);
      setSuggestIndex(-1);
    }
  }, [suggest]);

  const acceptSuggestion = useCallback((val: string) => {
    setEditValue(val);
    setSuggestions([]);
    setSuggestIndex(-1);
  }, []);

  const highlightMatch = (text: string, query: string) => {
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return <span>{text}</span>;
    return (
      <>
        <span>{text.slice(0, idx)}</span>
        <span className="text-primary font-bold">{text.slice(idx, idx + query.length)}</span>
        <span>{text.slice(idx + query.length)}</span>
      </>
    );
  };

  // ── 快递单号 → 物流查询 ──────────────────────────────

  const handleTrackingChange = useCallback(
    (id: string, value: string) => {
      const logistics = lookupLogistics(value);
      setShipments(prev =>
        prev.map(s =>
          s.id === id
            ? { ...s, trackingNumber: value, logisticsInfo: logistics, updatedAt: new Date().toISOString() }
            : s,
        ),
      );
    },
    [],
  );

  // ── 文件上传 ──────────────────────────────────────────

  const triggerUpload = useCallback((id: string, type: 'screenshots' | 'attachments') => {
    setUploadTarget({ id, type });
    if (type === 'screenshots') {
      screenshotInputRef.current?.click();
    } else {
      attachmentInputRef.current?.click();
    }
  }, []);

  const handleScreenshotChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0 || !uploadTarget) return;

      const readers: Promise<string>[] = [];
      for (let i = 0; i < files.length; i++) {
        readers.push(
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(files[i]);
          }),
        );
      }

      Promise.all(readers).then((dataUrls) => {
        setShipments(prev =>
          prev.map(s =>
            s.id === uploadTarget.id
              ? { ...s, screenshots: [...s.screenshots, ...dataUrls], updatedAt: new Date().toISOString() }
              : s,
          ),
        );
        setUploadTarget(null);
        toast.success(`已上传 ${dataUrls.length} 张图片`);
      }).catch((err) => {
        logger.error('Screenshot upload failed:', String(err));
        toast.error('图片上传失败');
      });

      e.target.value = '';
    },
    [uploadTarget],
  );

  const handleAttachmentChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0 || !uploadTarget) return;

      const readers: Promise<IAttachment>[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        readers.push(
          new Promise<IAttachment>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ name: file.name, data: reader.result as string });
            reader.readAsDataURL(file);
          }),
        );
      }

      Promise.all(readers).then((attachments) => {
        setShipments(prev =>
          prev.map(s =>
            s.id === uploadTarget.id
              ? { ...s, attachments: [...s.attachments, ...attachments], updatedAt: new Date().toISOString() }
              : s,
          ),
        );
        setUploadTarget(null);
        toast.success(`已上传 ${attachments.length} 个文件`);
      }).catch((err) => {
        logger.error('Attachment upload failed:', String(err));
        toast.error('文件上传失败');
      });

      e.target.value = '';
    },
    [uploadTarget],
  );

  const removeScreenshot = useCallback((shipmentId: string, index: number) => {
    setShipments(prev =>
      prev.map(s =>
        s.id === shipmentId
          ? { ...s, screenshots: s.screenshots.filter((_, i) => i !== index), updatedAt: new Date().toISOString() }
          : s,
      ),
    );
  }, []);

  const removeAttachment = useCallback((shipmentId: string, index: number) => {
    setShipments(prev =>
      prev.map(s =>
        s.id === shipmentId
          ? { ...s, attachments: s.attachments.filter((_, i) => i !== index), updatedAt: new Date().toISOString() }
          : s,
      ),
    );
  }, []);

  // ── 自定义发货员 ──────────────────────────────────────

  const addCustomCourier = useCallback(() => {
    const trimmed = newCourierValue.trim();
    if (!trimmed) return;
    if (customCouriers.includes(trimmed)) {
      toast.error('该选项已存在');
      return;
    }
    setCustomCouriers(prev => [...prev, trimmed]);
    setNewCourierValue('');
    setNewCourierOpen(false);
    toast.success(`已添加发货员: ${trimmed}`);
  }, [newCourierValue, customCouriers]);

  // ── 渲染辅助 ──────────────────────────────────────────

  const renderEditableCell = (
    shipment: IShipment,
    field: keyof IShipment,
    displayValue: string,
    placeholder: string,
    className = '',
  ) => {
    const isEditing = editingCell?.id === shipment.id && editingCell?.field === field;
    const isTextField = ['deliveryAddress', 'trackingNumber', 'remindCourier'].includes(field);
    if (isEditing) {
      return (
        <div className="relative">
          <Input
            value={editValue}
            onChange={(e) => isTextField ? handleEditValueChange(e.target.value, field) : setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (suggestions.length > 0) {
                if (e.key === 'ArrowDown') { e.preventDefault(); setSuggestIndex(prev => Math.min(prev + 1, suggestions.length - 1)); return; }
                if (e.key === 'ArrowUp') { e.preventDefault(); setSuggestIndex(prev => Math.max(prev - 1, 0)); return; }
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (suggestIndex >= 0) { acceptSuggestion(suggestions[suggestIndex]); }
                  else { commitEdit(); }
                  return;
                }
                if (e.key === 'Escape') { setSuggestions([]); setSuggestIndex(-1); return; }
              } else {
                if (e.key === 'Enter') { commitEdit(); return; }
                if (e.key === 'Escape') { cancelEdit(); return; }
              }
            }}
            className="h-8 text-center font-bold text-sm"
            autoFocus
          />
          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 z-40 mt-1 w-full min-w-[160px] bg-popover border border-border rounded-md shadow-md max-h-44 overflow-y-auto">
              {suggestions.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-accent ${i === suggestIndex ? 'bg-accent' : ''}`}
                  onMouseDown={e => { e.preventDefault(); acceptSuggestion(s); }}
                  onMouseEnter={() => setSuggestIndex(i)}
                >
                  {highlightMatch(s, editValue)}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }
    return (
      <div
        className={`cursor-pointer min-h-[32px] flex items-center justify-center px-1 text-sm font-bold whitespace-normal break-words ${className}`}
        onDoubleClick={() => startEdit(shipment.id, field, displayValue)}
        title="双击编辑"
      >
        {displayValue || <span className="text-muted-foreground font-normal">{placeholder}</span>}
      </div>
    );
  };

  const statusBadgeVariant = (status: string) => {
    switch (status) {
      case '已发货':
        return 'default' as const;
      case '待发货':
        return 'secondary' as const;
      default:
        return 'outline' as const;
    }
  };

  // ── JSX ────────────────────────────────────────────────

  return (
    <>
      <input
        ref={screenshotInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={handleScreenshotChange}
      />
      <input
        ref={attachmentInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleAttachmentChange}
      />

      <Card className="flex flex-col">
        {/* 顶部工具栏 */}
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 shrink-0">
          <CardTitle className="text-lg font-bold">快递发货需求</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilter(!showFilter)}
              title="筛选"
            >
              <Filter className="size-4" />
              <span className="hidden sm:inline ml-1.5">筛选</span>
            </Button>
            <Button size="sm" onClick={addRow}>
              <Plus className="size-4" />
              <span className="hidden sm:inline ml-1.5">新增发货</span>
            </Button>
          </div>
        </CardHeader>

        {/* 筛选面板 */}
        {showFilter && (
          <div className="px-4 pb-3 flex flex-wrap items-center gap-3 border-b border-border/40 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">发货员</span>
              <Select value={filterCourier} onValueChange={setFilterCourier}>
                <SelectTrigger className="h-8 w-[130px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  {customCouriers.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">状态</span>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-8 w-[120px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="待发货">待发货</SelectItem>
                  <SelectItem value="已发货">已发货</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" size="sm" onClick={clearFilter} className="h-8 text-xs">
              清除筛选
            </Button>
            <span className="text-xs text-muted-foreground ml-auto">
              共 {filteredShipments.length} 条
            </span>
          </div>
        )}

        {/* 批量操作栏 */}
        {selectedIds.size > 0 && (
          <div className="px-4 py-2 flex items-center gap-2 bg-primary/5 border-b border-primary/20 shrink-0">
            <span className="text-sm font-semibold text-primary">
              已选 {selectedIds.size} 项
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={batchMarkShipped}
            >
              <PackageCheck className="size-3.5 mr-1" />
              批量标记已发货
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs text-destructive border-destructive/40 hover:bg-destructive/10"
              onClick={() => setBatchDeleteOpen(true)}
            >
              <Trash2 className="size-3.5 mr-1" />
              批量删除
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs ml-auto"
              onClick={() => setSelectedIds(new Set())}
            >
              取消选择
            </Button>
          </div>
        )}

        {/* 表格区域 — 固定高度容器，独立滚动 */}
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto max-h-[calc(100vh-16rem)] overflow-y-auto">
            <table className="w-full min-w-[1400px] border-collapse">
              <thead className="sticky top-0 z-30">
                <tr className="border-b-2 border-border bg-muted/80 backdrop-blur-sm">
                  <th className="sticky left-0 z-30 text-center font-bold text-sm px-2 py-3 whitespace-nowrap w-[50px] bg-muted/80 backdrop-blur-sm">
                    <Checkbox
                      checked={filteredShipments.length > 0 && selectedIds.size === filteredShipments.length}
                      onCheckedChange={toggleSelectAll}
                      aria-label="全选"
                    />
                  </th>
                  <th className="text-center font-bold text-sm px-3 py-3 whitespace-nowrap w-[140px] bg-muted/80 backdrop-blur-sm">销售单截图</th>
                  <th className="text-center font-bold text-sm px-3 py-3 whitespace-nowrap w-[140px] bg-muted/80 backdrop-blur-sm">随货文件</th>
                  <th className="text-center font-bold text-sm px-3 py-3 whitespace-nowrap min-w-[180px] bg-muted/80 backdrop-blur-sm">收货地址</th>
                  <th className="text-center font-bold text-sm px-3 py-3 whitespace-nowrap w-[130px] bg-muted/80 backdrop-blur-sm">提醒发货员</th>
                  <th className="text-center font-bold text-sm px-3 py-3 whitespace-nowrap w-[140px] bg-muted/80 backdrop-blur-sm">快递单号</th>
                  <th className="text-center font-bold text-sm px-3 py-3 whitespace-nowrap min-w-[200px] bg-muted/80 backdrop-blur-sm">物流信息</th>
                   <th className="text-center font-bold text-sm px-3 py-3 whitespace-nowrap w-[80px] bg-muted/80 backdrop-blur-sm">状态</th>
                   <th className="text-center font-bold text-sm px-3 py-3 whitespace-nowrap w-[110px] bg-muted/80 backdrop-blur-sm">发货时间</th>
                   <th className="text-center font-bold text-sm px-3 py-3 whitespace-nowrap w-[140px] sticky right-0 bg-muted/80 backdrop-blur-sm z-30">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredShipments.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-16 text-muted-foreground">
                      <div className="flex flex-col items-center gap-3">
                        <Truck className="size-10 text-muted-foreground/40" />
                        <p className="text-sm">
                          {shipments.length === 0 ? '暂无发货记录' : '无匹配结果'}
                        </p>
                        {shipments.length === 0 ? (
                          <Button variant="outline" size="sm" onClick={addRow}>
                            <Plus className="size-3.5" />
                            新增发货
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" onClick={clearFilter}>
                            清除筛选
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredShipments.map((s) => (
                    <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="sticky left-0 z-20 bg-card px-2 py-2 text-center align-middle">
                        <Checkbox
                          checked={selectedIds.has(s.id)}
                          onCheckedChange={() => toggleSelect(s.id)}
                          aria-label={`选择 ${s.id}`}
                        />
                      </td>

                      {/* 销售单截图 */}
                      <td className="px-2 py-2 align-top">
                        <div className="flex flex-wrap gap-1.5 justify-center min-h-[48px] items-start pt-1">
                          {s.screenshots.map((url, idx) => (
                            <div key={idx} className="relative group">
                              <Image
                                src={url}
                                alt={`截图 ${idx + 1}`}
                                className="size-10 rounded-md object-cover border border-border"
                              />
                              <Button
                                size="icon"
                                variant="secondary"
                                className="!absolute -right-1.5 -top-1.5 z-20 h-5 w-5 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => removeScreenshot(s.id, idx)}
                                aria-label="删除截图"
                              >
                                <X className="size-3" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-10 w-10 rounded-md border-dashed"
                            onClick={() => triggerUpload(s.id, 'screenshots')}
                            title="上传截图"
                          >
                            <ImageIcon className="size-4" />
                          </Button>
                        </div>
                      </td>

                      {/* 随货文件 */}
                      <td className="px-2 py-2 align-top">
                        <div className="flex flex-col gap-1 items-center min-h-[48px] pt-1">
                          {s.attachments.map((att, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-1 bg-muted/50 rounded px-2 py-0.5 text-xs max-w-[120px] group"
                              title={att.name}
                            >
                              <FileText className="size-3 shrink-0 text-muted-foreground" />
                              <span className="truncate font-bold">{att.name}</span>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-4 w-4 shrink-0 opacity-0 group-hover:opacity-100"
                                onClick={() => removeAttachment(s.id, idx)}
                                aria-label="删除文件"
                              >
                                <X className="size-3" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs border-dashed"
                            onClick={() => triggerUpload(s.id, 'attachments')}
                          >
                            <Upload className="size-3 mr-1" />
                            上传文件
                          </Button>
                        </div>
                      </td>

                      {/* 收货地址 */}
                      <td className="px-2 py-2">
                        {renderEditableCell(s, 'deliveryAddress', s.deliveryAddress, '双击输入收货地址', 'max-w-[200px]')}
                      </td>

                      {/* 提醒发货员 */}
                      <td className="px-2 py-2">
                        <Select
                          value={s.remindCourier}
                          onValueChange={(val) => {
                            if (val === '__add_new__') {
                              setNewCourierOpen(true);
                            } else {
                              updateField(s.id, 'remindCourier', val);
                            }
                          }}
                        >
                          <SelectTrigger className="h-8 text-center font-bold text-sm border-0 bg-transparent hover:bg-muted/50 [&>svg]:hidden px-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {customCouriers.map((c) => (
                              <SelectItem key={c} value={c} className="text-sm font-bold">
                                {c}
                              </SelectItem>
                            ))}
                            <div className="border-t border-border mt-1 pt-1">
                              <SelectItem value="__add_new__" className="text-sm text-primary font-bold">
                                + 新增选项
                              </SelectItem>
                            </div>
                          </SelectContent>
                        </Select>
                      </td>

                      {/* 快递单号 */}
                      <td className="px-2 py-2">
                        {editingCell?.id === s.id && editingCell?.field === 'trackingNumber' ? (
                          <div className="relative flex items-center gap-1">
                            <Input
                              value={editValue}
                              onChange={(e) => handleEditValueChange(e.target.value, 'trackingNumber')}
                              onBlur={() => {
                                handleTrackingChange(s.id, editValue);
                                commitEdit();
                              }}
                              onKeyDown={(e) => {
                                if (suggestions.length > 0) {
                                  if (e.key === 'ArrowDown') { e.preventDefault(); setSuggestIndex(prev => Math.min(prev + 1, suggestions.length - 1)); return; }
                                  if (e.key === 'ArrowUp') { e.preventDefault(); setSuggestIndex(prev => Math.max(prev - 1, 0)); return; }
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (suggestIndex >= 0) { acceptSuggestion(suggestions[suggestIndex]); }
                                    else { handleTrackingChange(s.id, editValue); commitEdit(); }
                                    return;
                                  }
                                  if (e.key === 'Escape') { setSuggestions([]); setSuggestIndex(-1); return; }
                                } else {
                                  if (e.key === 'Enter') {
                                    handleTrackingChange(s.id, editValue);
                                    commitEdit();
                                  }
                                  if (e.key === 'Escape') cancelEdit();
                                }
                              }}
                              className="h-8 text-center font-bold text-sm"
                              autoFocus
                            />
                            {suggestions.length > 0 && (
                              <div className="absolute top-full left-0 z-40 mt-1 w-full min-w-[160px] bg-popover border border-border rounded-md shadow-md max-h-44 overflow-y-auto">
                                {suggestions.map((sg, i) => (
                                  <button
                                    key={sg}
                                    type="button"
                                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-accent ${i === suggestIndex ? 'bg-accent' : ''}`}
                                    onMouseDown={e => { e.preventDefault(); acceptSuggestion(sg); }}
                                    onMouseEnter={() => setSuggestIndex(i)}
                                  >
                                    {highlightMatch(sg, editValue)}
                                  </button>
                                ))}
                              </div>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 shrink-0"
                              onClick={() => handleTrackingChange(s.id, editValue)}
                              title="查询物流"
                            >
                              <Search className="size-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div
                            className="cursor-pointer min-h-[32px] flex items-center justify-center gap-1 px-1 text-sm font-bold font-mono"
                            onDoubleClick={() => startEdit(s.id, 'trackingNumber', s.trackingNumber)}
                            title="双击编辑"
                          >
                            {s.trackingNumber || (
                              <span className="text-muted-foreground font-normal">双击输入单号</span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 物流信息 */}
                      <td className="px-2 py-2">
                        {s.logisticsInfo.length > 0 ? (
                          <div className="flex flex-col gap-1.5 py-1">
                            {s.logisticsInfo.map((node, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-xs">
                                <div className="flex flex-col items-center shrink-0 pt-0.5">
                                  <div className={`size-2 rounded-full border-2 ${idx === 0 ? 'bg-primary border-primary' : 'bg-background border-muted-foreground/40'}`} />
                                  {idx < s.logisticsInfo.length - 1 && (
                                    <div className="w-px h-3 bg-border" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-bold">{node.status}</div>
                                  <div className="text-muted-foreground flex items-center gap-1 flex-wrap">
                                    <Clock className="size-3" />
                                    <span>{node.time}</span>
                                    {node.location && (
                                      <>
                                        <MapPin className="size-3 ml-1" />
                                        <span className="truncate">{node.location}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground text-center py-2">
                            {s.trackingNumber ? '暂无物流信息' : '输入单号后查询'}
                          </div>
                        )}
                      </td>

                      {/* 状态 */}
                      <td className="px-2 py-2 text-center">
                        <Badge variant={statusBadgeVariant(s.status)} className={`text-xs font-bold border ${s.status === '已发货' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300'}`}>
                          {s.status}
                        </Badge>
                      </td>

                      {/* 发货时间 — 仅已发货时显示 */}
                      <td className="px-2 py-2 text-center">
                        <span className="text-sm font-bold text-muted-foreground">
                          {s.status === '已发货' && s.shippedTime ? s.shippedTime : '-'}
                        </span>
                      </td>

                      {/* 操作 */}
                      <td className="px-2 py-2 text-center sticky right-0 bg-background z-20">
                        <div className="flex items-center justify-center gap-1.5">
                          {s.status === '待发货' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs font-bold text-success border-success/40 hover:bg-success/10"
                              onClick={() => setShipConfirmId(s.id)}
                            >
                              <PackageCheck className="size-3.5 mr-1" />
                              已发货
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs font-bold text-amber-600 hover:bg-amber-50"
                              onClick={() => {
                                setShipments(prev =>
                                  prev.map(x =>
                                    x.id === s.id
                                      ? { ...x, status: '待发货' as const, shippedTime: '', updatedAt: new Date().toISOString() }
                                      : x,
                                  ),
                                );
                                toast.success('已撤销发货标记');
                              }}
                            >
                              撤销发货
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTargetId(s.id)}
                            title="删除"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 发货确认弹窗 */}
      <AlertDialog open={!!shipConfirmId} onOpenChange={(open) => !open && setShipConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认发货</AlertDialogTitle>
            <AlertDialogDescription>
              确认将该记录标记为已发货？标记后可在操作列点击「撤销发货」恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (shipConfirmId) {
                  markShipped(shipConfirmId);
                  setShipConfirmId(null);
                }
              }}
            >
              确认发货
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 删除确认弹窗 */}
      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              删除后该发货记录将无法恢复，确定要删除吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTargetId && deleteRow(deleteTargetId)}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 批量删除确认弹窗 */}
      <AlertDialog open={batchDeleteOpen} onOpenChange={setBatchDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>批量删除确认</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除选中的 {selectedIds.size} 条发货记录吗？此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={batchDelete}
            >
              确认删除 {selectedIds.size} 条
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 新增发货员弹窗 */}
      <Dialog open={newCourierOpen} onOpenChange={setNewCourierOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>新增发货员</DialogTitle>
            <DialogDescription>输入新的发货员名称，将保存到选项列表中。</DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <Input
              value={newCourierValue}
              onChange={(e) => setNewCourierValue(e.target.value)}
              placeholder="请输入发货员名称"
              onKeyDown={(e) => {
                if (e.key === 'Enter') addCustomCourier();
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewCourierOpen(false)}>
              取消
            </Button>
            <Button onClick={addCustomCourier} disabled={!newCourierValue.trim()}>
              确认添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
