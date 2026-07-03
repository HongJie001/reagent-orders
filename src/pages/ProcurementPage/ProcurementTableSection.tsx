import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { scopedStorage } from '@lark-apaas/client-toolkit-lite';
import { IOrder, MOCK_ORDERS } from '@/data/crud';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus, Trash2, Check, X,
  Filter, XCircle, ChevronDown, FileText,
} from 'lucide-react';
import OrderPreviewModal from '@/components/OrderPreviewModal';
import { useColumnMemory } from '@/hooks/useColumnMemory';

// ─── scopedStorage helpers ────────────────────────────────────────────
const STORAGE_KEY = '__app_reagent_orders';
const OPTIONS_KEY = '__app_reagent_custom_options';

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

interface ICustomOptions {
  procurementMethods: string[];
  orderForms: string[];
  statuses: string[];
}

const DEFAULT_CUSTOM_OPTIONS: ICustomOptions = {
  procurementMethods: ['天河', '番禺', '调拨天河', '调拨番禺', '直发'],
  orderForms: ['线上', '线下', '后补单'],
  statuses: ['待处理', '已采购', '已调拨', '已到货', '已发货'],
};

function loadCustomOptions(): ICustomOptions {
  try {
    const raw = scopedStorage.getItem(OPTIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ICustomOptions>;
      return {
        procurementMethods: parsed.procurementMethods ?? DEFAULT_CUSTOM_OPTIONS.procurementMethods,
        orderForms: parsed.orderForms ?? DEFAULT_CUSTOM_OPTIONS.orderForms,
        statuses: parsed.statuses ?? DEFAULT_CUSTOM_OPTIONS.statuses,
      };
    }
  } catch { /* ignore */ }
  return DEFAULT_CUSTOM_OPTIONS;
}

function saveCustomOptions(opts: ICustomOptions) {
  scopedStorage.setItem(OPTIONS_KEY, JSON.stringify(opts));
}

// ─── constants ───────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  '待处理': 'bg-amber-100 text-amber-800 border-amber-300',
  '已采购': 'bg-blue-100 text-blue-800 border-blue-300',
  '已调拨': 'bg-purple-100 text-purple-800 border-purple-300',
  '已到货': 'bg-emerald-100 text-emerald-800 border-emerald-300',
  '已发货': 'bg-slate-200 text-slate-700 border-slate-400',
};

const FIELD_ORDER: (keyof IOrder)[] = [
  'procurementDate', 'status', 'arrivalTime', 'procurementMethod', 'orderForm',
  'customer', 'brand', 'catalogNumber', 'productName', 'specification',
  'listPrice', 'unitPrice', 'quantity', 'totalPrice', 'remarks',
];

const FIELD_LABELS: Record<string, string> = {
  procurementDate: '采购日期',
  procurementMethod: '采购方式',
  status: '状态',
  arrivalTime: '已到货时间',
  orderForm: '订单形式',
  customer: '客户',
  brand: '品牌',
  catalogNumber: '货号',
  productName: '产品名称',
  specification: '规格',
  listPrice: '目录价',
  quantity: '数量',
  unitPrice: '单价',
  totalPrice: '总价',
  remarks: '备注',
};

// ─── selection helpers ───────────────────────────────────────────────
interface CellCoord { row: number; col: number; }
interface SelectionRange { start: CellCoord; end: CellCoord; }

function normalizeRange(r: SelectionRange): { minRow: number; maxRow: number; minCol: number; maxCol: number } {
  return {
    minRow: Math.min(r.start.row, r.end.row),
    maxRow: Math.max(r.start.row, r.end.row),
    minCol: Math.min(r.start.col, r.end.col),
    maxCol: Math.max(r.start.col, r.end.col),
  };
}

// ─── component ───────────────────────────────────────────────────────
function ProcurementTableSection() {
  const [orders, setOrders] = useState<IOrder[]>(() => loadOrders());
  const [customOptions, setCustomOptions] = useState<ICustomOptions>(() => loadCustomOptions());

  // tab
  const [activeTab, setActiveTab] = useState('all');

  // editing
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: keyof IOrder } | null>(null);
  const [editValue, setEditValue] = useState('');

  // column widths — responsive defaults, narrower for numeric fields
  const [colWidths, setColWidths] = useState<Record<string, number>>({
    procurementDate: 95, procurementMethod: 80, status: 70, arrivalTime: 115, orderForm: 70,
    customer: 120, brand: 70, catalogNumber: 85, productName: 130,
    specification: 95, listPrice: 65, unitPrice: 65, quantity: 50,
    totalPrice: 75, remarks: 140,
  });

  // resizing
  const resizingRef = useRef<{ field: string; startX: number; startWidth: number } | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // fullscreen — removed

  // batch
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchStatusOpen, setBatchStatusOpen] = useState(false);
  const [batchStatusValue, setBatchStatusValue] = useState('');

  // delete confirm
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // filter
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});

  // option dialog
  const [optionDialog, setOptionDialog] = useState<{ field: 'procurementMethod' | 'orderForm' | 'status'; open: boolean }>({ field: 'procurementMethod', open: false });
  const [newOptionValue, setNewOptionValue] = useState('');

  // dropdown state for procurementMethod / orderForm inline editing
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // ─── column memory ────────────────────────────────────────────────
  const { remember, suggest } = useColumnMemory();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestIndex, setSuggestIndex] = useState(-1);

  // ─── order preview modal ──────────────────────────────────────────
  const [orderPreviewOpen, setOrderPreviewOpen] = useState(false);
  const [previewOrders, setPreviewOrders] = useState<IOrder[]>([]);

  // ─── Excel selection ──────────────────────────────────────────────
  const [selection, setSelection] = useState<SelectionRange | null>(null);
  const [focusedCell, setFocusedCell] = useState<CellCoord | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<CellCoord | null>(null);

  // ─── persist ─────────────────────────────────────────────────────
  const persistOrders = useCallback((next: IOrder[]) => {
    setOrders(next);
    saveOrders(next);
  }, []);

  const persistOptions = useCallback((next: ICustomOptions) => {
    setCustomOptions(next);
    saveCustomOptions(next);
  }, []);

  // ─── storage sync ────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try { setOrders(JSON.parse(e.newValue)); } catch { /* */ }
      }
      if (e.key === OPTIONS_KEY && e.newValue) {
        try { setCustomOptions(JSON.parse(e.newValue)); } catch { /* */ }
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // ─── column resize ───────────────────────────────────────────────
  const onResizeStart = useCallback((field: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = { field, startX: e.clientX, startWidth: colWidths[field] || 120 };
    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = ev.clientX - resizingRef.current.startX;
      const newWidth = Math.max(60, resizingRef.current.startWidth + delta);
      setColWidths(prev => ({ ...prev, [resizingRef.current!.field]: newWidth }));
    };
    const onUp = () => {
      resizingRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [colWidths]);

  // ─── auto-save indicator ────────────────────────────────────────
  const [saveFlash, setSaveFlash] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const prevOrdersLenRef = useRef(orders.length);

  // flash indicator when orders change
  useEffect(() => {
    if (orders.length !== prevOrdersLenRef.current) {
      setSaveFlash(true);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => setSaveFlash(false), 1500);
    }
    prevOrdersLenRef.current = orders.length;
  }, [orders]);
  const filteredOrders = useMemo(() => {
    let result = orders;
    if (activeTab === 'pending') {
      result = result.filter(o => o.status === '待处理');
    } else if (activeTab === 'transfer') {
      result = result.filter(o => o.procurementMethod.includes('调拨'));
    } else if (activeTab === 'direct') {
      result = result.filter(o => o.procurementMethod === '直发');
    } else if (activeTab === 'arrived') {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      result = result.filter(o => {
        if (o.status !== '已到货') return false;
        if (!o.arrivalTime) return false;
        return o.arrivalTime.startsWith(todayStr);
      });
      result = [...result].sort((a, b) => {
        const aTime = a.arrivalTime || '';
        const bTime = b.arrivalTime || '';
        return bTime.localeCompare(aTime);
      });
    }
    // 'all' tab: no status/method filter, show everything
    for (const [field, value] of Object.entries(filters)) {
      if (!value) continue;
      result = result.filter(o => {
        const v = String(o[field as keyof IOrder] ?? '').toLowerCase();
        return v.includes(value.toLowerCase());
      });
    }
    return result;
  }, [orders, activeTab, filters]);

  // ─── cell editing ────────────────────────────────────────────────
  const startEdit = useCallback((rowId: string, field: keyof IOrder, currentValue: string | number) => {
    setEditingCell({ rowId, field });
    setEditValue(String(currentValue ?? ''));
    setSelection(null);
  }, []);

  const commitEdit = useCallback(() => {
    if (!editingCell) return;
    const { rowId, field } = editingCell;
    const next = orders.map(o => {
      if (o.id !== rowId) return o;
      const updated = { ...o, updatedAt: new Date().toISOString() };
      if (field === 'listPrice' || field === 'quantity' || field === 'unitPrice' || field === 'totalPrice') {
        (updated as unknown as Record<string, number>)[field] = parseFloat(editValue) || 0;
        if (field === 'quantity' || field === 'unitPrice' || field === 'listPrice') {
          updated.totalPrice = updated.quantity * updated.unitPrice;
        }
      } else if (field === 'status') {
        updated.status = editValue as IOrder['status'];
        // 状态不是"已到货"时清空已到货时间
        if (editValue !== '已到货') {
          updated.arrivalTime = '';
        }
      } else if (field === 'orderForm') {
        updated.orderForm = editValue as IOrder['orderForm'];
      } else {
        (updated as unknown as Record<string, string>)[field] = editValue;
        // 记录到同列记忆
        if (editValue.trim()) {
          remember(field, editValue.trim());
        }
      }
      return updated;
    });
    persistOrders(next);
    setEditingCell(null);
    setSuggestions([]);
    setSuggestIndex(-1);
  }, [editingCell, editValue, orders, persistOrders, remember]);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    setSuggestions([]);
    setSuggestIndex(-1);
  }, []);

  // ─── column memory suggestion handler ───────────────────────────
  const handleEditValueChange = useCallback((value: string, field: keyof IOrder) => {
    setEditValue(value);
    // 文本字段：输入时弹出同列记忆建议
    const textFields: (keyof IOrder)[] = ['customer', 'brand', 'catalogNumber', 'productName', 'specification', 'remarks'];
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

  // ─── row actions ─────────────────────────────────────────────────
  const changeStatus = useCallback((rowId: string, newStatus: IOrder['status']) => {
    const next = orders.map(o => {
      if (o.id !== rowId) return o;
      const updated = { ...o, status: newStatus, updatedAt: new Date().toISOString() };
      // 状态不是"已到货"时清空已到货时间
      if (newStatus !== '已到货') {
        updated.arrivalTime = '';
      }
      return updated;
    });
    persistOrders(next);
    toast.success(`状态已更新为「${newStatus}」`);
  }, [orders, persistOrders]);

  const deleteRow = useCallback(() => {
    if (!deleteTarget) return;
    persistOrders(orders.filter(o => o.id !== deleteTarget));
    setDeleteTarget(null);
    toast.success('已删除');
  }, [deleteTarget, orders, persistOrders]);

  const addRow = useCallback(() => {
    const id = String(Date.now());
    const newOrder: IOrder = {
      id,
      procurementDate: new Date().toISOString().slice(0, 10),
      procurementMethod: '天河',
      status: '待处理',
      orderForm: '线上',
      arrivalTime: '',
      customer: '',
      brand: '',
      catalogNumber: '',
      productName: '',
      specification: '',
      listPrice: 0,
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
      remarks: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'user',
    };
    persistOrders([...orders, newOrder]);
  }, [orders, persistOrders]);

  // ─── Excel selection handlers ────────────────────────────────────
  const clearSelection = useCallback(() => {
    setSelection(null);
    setFocusedCell(null);
    setIsDragging(false);
    dragRef.current = null;
  }, []);

  const handleCellMouseDown = useCallback((rowIdx: number, colIdx: number, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    tableContainerRef.current?.focus();
    dragRef.current = { row: rowIdx, col: colIdx };
    setFocusedCell({ row: rowIdx, col: colIdx });
    if (e.shiftKey && selection) {
      setSelection(prev => prev ? { start: prev.start, end: { row: rowIdx, col: colIdx } } : { start: { row: rowIdx, col: colIdx }, end: { row: rowIdx, col: colIdx } });
    } else {
      setSelection({ start: { row: rowIdx, col: colIdx }, end: { row: rowIdx, col: colIdx } });
    }
    setIsDragging(true);
  }, [selection]);

  const handleCellMouseEnter = useCallback((rowIdx: number, colIdx: number) => {
    if (!isDragging || !dragRef.current) return;
    setSelection({ start: { row: dragRef.current.row, col: dragRef.current.col }, end: { row: rowIdx, col: colIdx } });
  }, [isDragging]);

  // global mouseup to stop dragging
  useEffect(() => {
    const onUp = () => {
      setIsDragging(false);
      dragRef.current = null;
    };
    document.addEventListener('mouseup', onUp);
    return () => document.removeEventListener('mouseup', onUp);
  }, []);

  // click on table background to clear selection
  const handleTableBgClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      clearSelection();
    }
  }, [clearSelection]);

  // ─── keyboard: Escape ────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearSelection();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [clearSelection]);

  // ─── copy selection (onCopy event on container) ──────────────────
  const onCopy = useCallback((e: React.ClipboardEvent) => {
    if (!selection) return;
    e.preventDefault();
    const { minRow, maxRow, minCol, maxCol } = normalizeRange(selection);
    const lines: string[] = [];
    for (let r = minRow; r <= maxRow; r++) {
      if (r < 0 || r >= filteredOrders.length) continue;
      const cells: string[] = [];
      for (let c = minCol; c <= maxCol; c++) {
        if (c < 0 || c >= FIELD_ORDER.length) continue;
        cells.push(String(filteredOrders[r][FIELD_ORDER[c]] ?? ''));
      }
      lines.push(cells.join('\t'));
    }
    if (lines.length > 0) {
      e.clipboardData.setData('text/plain', lines.join('\n'));
      toast.success(`已复制 ${lines.length} 行 × ${lines[0]?.split('\t').length || 0} 列`);
    }
  }, [selection, filteredOrders]);

  // ─── paste (onPaste event on container) ──────────────────────────
  const onPaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (!text.trim()) return;
    const rows = text.trim().split(/\r?\n/);
    if (rows.length === 0) return;

    if (selection) {
      const { minRow, minCol } = normalizeRange(selection);
      const pasteRows = rows.length;
      const pasteCols = rows[0].split('\t').length;

      let targetOrders = [...orders];
      const extraRowsNeeded = minRow + pasteRows - filteredOrders.length;
      for (let i = 0; i < extraRowsNeeded; i++) {
        const id = String(Date.now() + i + Math.random());
        targetOrders.push({
          id,
          procurementDate: new Date().toISOString().slice(0, 10),
          procurementMethod: '天河',
          status: '待处理',
          orderForm: '线上',
          arrivalTime: '',
          customer: '',
          brand: '',
          catalogNumber: '',
          productName: '',
          specification: '',
          listPrice: 0,
          quantity: 1,
          unitPrice: 0,
          totalPrice: 0,
          remarks: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          source: 'user',
        });
      }

      let updatedFiltered = targetOrders;
      if (activeTab === 'pending') updatedFiltered = updatedFiltered.filter(o => o.status === '待处理');
      else if (activeTab === 'transfer') updatedFiltered = updatedFiltered.filter(o => o.procurementMethod.includes('调拨'));
      else if (activeTab === 'direct') updatedFiltered = updatedFiltered.filter(o => o.procurementMethod === '直发');
      else if (activeTab === 'arrived') updatedFiltered = updatedFiltered.filter(o => o.status === '已到货');
      for (const [field, value] of Object.entries(filters)) {
        if (!value) continue;
        updatedFiltered = updatedFiltered.filter(o => {
          const v = String(o[field as keyof IOrder] ?? '').toLowerCase();
          return v.includes(value.toLowerCase());
        });
      }

      for (let r = 0; r < pasteRows; r++) {
        const targetRowIdx = minRow + r;
        if (targetRowIdx >= updatedFiltered.length) break;
        const targetOrder = updatedFiltered[targetRowIdx];
        const cells = rows[r].split('\t');
        for (let c = 0; c < pasteCols; c++) {
          const targetColIdx = minCol + c;
          if (targetColIdx >= FIELD_ORDER.length) break;
          const field = FIELD_ORDER[targetColIdx];
          const val = cells[c] ?? '';
          if (field === 'listPrice' || field === 'quantity' || field === 'unitPrice' || field === 'totalPrice') {
            (targetOrder as unknown as Record<string, number>)[field] = parseFloat(val) || 0;
          } else {
            (targetOrder as unknown as Record<string, string>)[field] = val;
          }
        }
        if (targetOrder.quantity && targetOrder.unitPrice) {
          targetOrder.totalPrice = targetOrder.quantity * targetOrder.unitPrice;
        }
      }
      persistOrders(targetOrders);
      toast.success(`已粘贴 ${pasteRows} 行 × ${pasteCols} 列`);
    } else {
      const newOrders: IOrder[] = [];
      for (const row of rows) {
        const cells = row.split('\t');
        if (cells.length < 2) continue;
        const id = String(Date.now() + Math.random());
        const order: IOrder = {
          id,
          procurementDate: cells[0] || new Date().toISOString().slice(0, 10),
          status: (cells[1] as IOrder['status']) || '待处理',
          arrivalTime: cells[2] || '',
          procurementMethod: cells[3] || '天河',
          orderForm: (cells[4] as IOrder['orderForm']) || '线上',
          customer: cells[5] || '',
          brand: cells[6] || '',
          catalogNumber: cells[7] || '',
          productName: cells[8] || '',
          specification: cells[9] || '',
          listPrice: parseFloat(cells[10]) || 0,
          unitPrice: parseFloat(cells[11]) || 0,
          quantity: parseInt(cells[12]) || 1,
          totalPrice: parseFloat(cells[13]) || 0,
          remarks: cells[14] || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          source: 'user',
        };
        newOrders.push(order);
      }
      if (newOrders.length > 0) {
        persistOrders([...orders, ...newOrders]);
        toast.success(`已粘贴 ${newOrders.length} 行`);
      }
    }
  }, [selection, filteredOrders, orders, persistOrders, activeTab, filters]);

  // ─── batch ────────────────────────────────────────────────────────
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredOrders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOrders.map(o => o.id)));
    }
  }, [selectedIds, filteredOrders]);

  const batchDelete = useCallback(() => {
    persistOrders(orders.filter(o => !selectedIds.has(o.id)));
    setSelectedIds(new Set());
    setBatchDeleteOpen(false);
    toast.success(`已批量删除 ${selectedIds.size} 条`);
  }, [selectedIds, orders, persistOrders]);

  const batchChangeStatus = useCallback(() => {
    if (!batchStatusValue) return;
    const next = orders.map(o => {
      if (!selectedIds.has(o.id)) return o;
      const updated = { ...o, status: batchStatusValue as IOrder['status'], updatedAt: new Date().toISOString() };
      // 状态不是"已到货"时清空已到货时间
      if (batchStatusValue !== '已到货') {
        updated.arrivalTime = '';
      }
      return updated;
    });
    persistOrders(next);
    setSelectedIds(new Set());
    setBatchStatusOpen(false);
    setBatchStatusValue('');
    toast.success(`已批量更新状态`);
  }, [selectedIds, orders, persistOrders, batchStatusValue]);

  // ─── custom option ────────────────────────────────────────────────
  const addCustomOption = useCallback(() => {
    const v = newOptionValue.trim();
    if (!v) return;
    const next = { ...customOptions };
    if (optionDialog.field === 'procurementMethod') {
      if (!next.procurementMethods.includes(v)) next.procurementMethods = [...next.procurementMethods, v];
    } else if (optionDialog.field === 'orderForm') {
      if (!next.orderForms.includes(v)) next.orderForms = [...next.orderForms, v];
    } else {
      if (!next.statuses.includes(v)) next.statuses = [...next.statuses, v];
    }
    persistOptions(next);
    setNewOptionValue('');
    setOptionDialog(prev => ({ ...prev, open: false }));
    toast.success('已添加选项');
  }, [newOptionValue, optionDialog.field, customOptions, persistOptions]);

  const removeCustomOption = useCallback((val: string) => {
    const next = { ...customOptions };
    if (optionDialog.field === 'procurementMethod') {
      next.procurementMethods = next.procurementMethods.filter(m => m !== val);
    } else if (optionDialog.field === 'orderForm') {
      next.orderForms = next.orderForms.filter(f => f !== val);
    } else {
      next.statuses = next.statuses.filter(s => s !== val);
    }
    persistOptions(next);
    toast.success('已删除选项');
  }, [optionDialog.field, customOptions, persistOptions]);

  const getOptionList = useCallback(() => {
    if (optionDialog.field === 'procurementMethod') return customOptions.procurementMethods;
    if (optionDialog.field === 'orderForm') return customOptions.orderForms;
    return customOptions.statuses;
  }, [optionDialog.field, customOptions]);

  // ─── filter ───────────────────────────────────────────────────────
  const setFilter = useCallback((field: string, value: string) => {
    setFilters(prev => {
      const next = { ...prev };
      if (value) next[field] = value; else delete next[field];
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  // ─── render helpers ───────────────────────────────────────────────
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

  const renderCellValue = (order: IOrder, field: keyof IOrder) => {
    const val = order[field];
    if (field === 'status') {
      return <Badge className={`text-xs font-semibold border ${STATUS_COLORS[order.status] || 'bg-muted text-muted-foreground'}`}>{String(val)}</Badge>;
    }
    if (field === 'listPrice' || field === 'unitPrice' || field === 'totalPrice') {
      return `¥${Number(val).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (field === 'arrivalTime') {
      // 只有状态为"已到货"时才显示已到货时间
      if (order.status !== '已到货') return '-';
      const t = String(val ?? '').trim();
      return t || '-';
    }
    return String(val ?? '');
  };

  const isEditing = (rowId: string, field: keyof IOrder) =>
    editingCell?.rowId === rowId && editingCell?.field === field;

  const renderEditableCell = (order: IOrder, field: keyof IOrder) => {
    if (isEditing(order.id, field)) {
      if (field === 'status') {
        return (
          <Select value={editValue} onValueChange={setEditValue}>
            <SelectTrigger className="h-8 w-full text-xs font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {customOptions.statuses.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }
      if (field === 'orderForm') {
        return (
          <div className="relative flex items-center gap-0.5">
            <Input
              className="h-8 text-xs font-semibold text-center flex-1 min-w-0 rounded-r-none"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') commitEdit();
                if (e.key === 'Escape') cancelEdit();
              }}
              autoFocus
            />
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-7 shrink-0 rounded-l-none border-l-0"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              type="button"
            >
              <ChevronDown className="size-3" />
            </Button>
            {dropdownOpen && (
              <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-popover border border-border rounded-md shadow-md max-h-40 overflow-y-auto">
                {customOptions.orderForms.map(opt => (
                  <button
                    key={opt}
                    type="button"
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent"
                    onClick={() => { setEditValue(opt); setDropdownOpen(false); }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
            <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={commitEdit}><Check className="size-3" /></Button>
            <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={cancelEdit}><X className="size-3" /></Button>
          </div>
        );
      }
      if (field === 'procurementMethod') {
        return (
          <div className="relative flex items-center gap-0.5">
            <Input
              className="h-8 text-xs font-semibold text-center flex-1 min-w-0 rounded-r-none"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') commitEdit();
                if (e.key === 'Escape') cancelEdit();
              }}
              autoFocus
            />
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-7 shrink-0 rounded-l-none border-l-0"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              type="button"
            >
              <ChevronDown className="size-3" />
            </Button>
            {dropdownOpen && (
              <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-popover border border-border rounded-md shadow-md max-h-40 overflow-y-auto">
                {customOptions.procurementMethods.map(opt => (
                  <button
                    key={opt}
                    type="button"
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent"
                    onClick={() => { setEditValue(opt); setDropdownOpen(false); }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
            <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={commitEdit}><Check className="size-3" /></Button>
            <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={cancelEdit}><X className="size-3" /></Button>
          </div>
        );
      }
      // ─── 通用文本字段：带同列记忆建议 ──────────────────────
      const isTextField = ['customer', 'brand', 'catalogNumber', 'productName', 'specification', 'remarks'].includes(field);
      return (
        <div className="relative flex items-center gap-1">
          <Input
            className="h-8 text-xs font-semibold text-center"
            value={editValue}
            onChange={e => isTextField ? handleEditValueChange(e.target.value, field) : setEditValue(e.target.value)}
            onKeyDown={e => {
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
            autoFocus
          />
          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 z-40 mt-1 w-full min-w-[160px] bg-popover border border-border rounded-md shadow-md max-h-44 overflow-y-auto">
              {suggestions.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-accent flex items-center gap-1 ${i === suggestIndex ? 'bg-accent' : ''}`}
                  onMouseDown={e => { e.preventDefault(); acceptSuggestion(s); }}
                  onMouseEnter={() => setSuggestIndex(i)}
                >
                  <span className="truncate">
                    {highlightMatch(s, editValue)}
                  </span>
                </button>
              ))}
            </div>
          )}
          <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={commitEdit}><Check className="size-3" /></Button>
          <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={cancelEdit}><X className="size-3" /></Button>
        </div>
      );
    }
    return (
      <div
        className="cursor-pointer min-h-[32px] flex items-center justify-center font-semibold text-xs px-1"
        onDoubleClick={() => startEdit(order.id, field, order[field])}
      >
        {renderCellValue(order, field)}
      </div>
    );
  };

  // ─── selection cell class ────────────────────────────────────────
  const isCellSelected = (rowIdx: number, colIdx: number) => {
    if (!selection) return false;
    const { minRow, maxRow, minCol, maxCol } = normalizeRange(selection);
    return rowIdx >= minRow && rowIdx <= maxRow && colIdx >= minCol && colIdx <= maxCol;
  };

  const isRowHighlighted = (rowIdx: number) => {
    if (!focusedCell) return false;
    return rowIdx === focusedCell.row;
  };

  const isColHighlighted = (colIdx: number) => {
    if (!focusedCell) return false;
    return colIdx === focusedCell.col;
  };

  const isFocusedCell = (rowIdx: number, colIdx: number) => {
    if (!focusedCell) return false;
    return rowIdx === focusedCell.row && colIdx === focusedCell.col;
  };

  // ─── render ───────────────────────────────────────────────────────
  return (
    <div
      ref={tableContainerRef}
      tabIndex={0}
      className="flex flex-col border border-border rounded-xl bg-card shadow-sm outline-none"
      onCopy={onCopy}
      onPaste={onPaste}
    >
      {/* toolbar */}
      <div className="flex flex-col gap-2 px-4 py-3 border-b border-border shrink-0">
        {/* row 1: actions */}
        <div className="flex items-center flex-wrap gap-2">
          <Button size="sm" onClick={addRow}>
            <Plus className="size-4" /> 新增行
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOptionDialog({ field: 'procurementMethod', open: true })}>
            管理采购方式
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOptionDialog({ field: 'orderForm', open: true })}>
            管理订单形式
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOptionDialog({ field: 'status', open: true })}>
            管理状态
          </Button>
          <Button
            size="sm"
            variant={filterOpen ? 'default' : 'outline'}
            onClick={() => setFilterOpen(!filterOpen)}
          >
            <Filter className="size-3.5" />
            <span className="ml-1">筛选</span>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs px-1 py-0">{activeFilterCount}</Badge>
            )}
          </Button>
          {activeFilterCount > 0 && (
            <Button size="sm" variant="ghost" onClick={clearFilters}>
              <XCircle className="size-3.5" />
              <span className="ml-1">清除筛选</span>
            </Button>
          )}
          <div className="flex-1" />
          {/* auto-save indicator */}
          <span
            className={`text-xs transition-all duration-300 ${
              saveFlash ? 'text-emerald-600 opacity-100' : 'text-muted-foreground opacity-60'
            }`}
          >
            {saveFlash ? '✓ 已自动保存' : '自动保存中'}
          </span>
        </div>

        {/* row 2: tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-8">
            <TabsTrigger value="all" className="text-xs h-7">全部</TabsTrigger>
            <TabsTrigger value="pending" className="text-xs h-7">待处理</TabsTrigger>
            <TabsTrigger value="transfer" className="text-xs h-7">调拨</TabsTrigger>
            <TabsTrigger value="direct" className="text-xs h-7">直发</TabsTrigger>
            <TabsTrigger value="arrived" className="text-xs h-7">今日到货</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* filter panel */}
        {filterOpen && (
          <div className="flex flex-wrap items-center gap-2 p-2 bg-muted/30 rounded-md">
            {FIELD_ORDER.map(field => (
              <div key={field} className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground whitespace-nowrap">{FIELD_LABELS[field]}:</span>
                <Input
                  className="h-7 w-28 text-xs"
                  placeholder="筛选..."
                  value={filters[field] || ''}
                  onChange={e => setFilter(field, e.target.value)}
                />
              </div>
            ))}
          </div>
        )}

        {/* batch bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 px-2 py-1.5 bg-primary/5 rounded-md">
            <span className="text-xs font-semibold text-primary">已选 {selectedIds.size} 项</span>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setBatchStatusOpen(true)}>
              批量改状态
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => {
                const selected = orders.filter(o => selectedIds.has(o.id));
                const customers = [...new Set(selected.map(o => o.customer))];
                if (customers.length > 1) {
                  toast.error('请选择同一客户的订单');
                  return;
                }
                if (selected.length === 0) {
                  toast.error('请先选择订单');
                  return;
                }
                setPreviewOrders(selected);
                setOrderPreviewOpen(true);
              }}
            >
              <FileText className="size-3 mr-1" />
              生成订单
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs text-destructive" onClick={() => setBatchDeleteOpen(true)}>
              <Trash2 className="size-3 mr-1" />批量删除
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>
              取消选择
            </Button>
          </div>
        )}
      </div>

      {/* table — fixed height container, independent scroll */}
      <div
        className="w-full overflow-x-auto max-h-[calc(100vh-13rem)] overflow-y-auto"
        onClick={handleTableBgClick}
      >
        <table className="w-full border-collapse table-fixed min-w-[1400px]">
          <thead className="sticky top-0 z-30">
            <tr>
              {/* checkbox column — sticky left */}
              <th className="sticky left-0 z-30 border-b-2 border-border bg-muted/90 backdrop-blur-sm px-2 py-3 text-center" style={{ width: 40, minWidth: 40 }}>
                <Checkbox
                  checked={filteredOrders.length > 0 && selectedIds.size === filteredOrders.length}
                  onCheckedChange={toggleSelectAll}
                />
              </th>
              {FIELD_ORDER.map(field => (
                <th
                  key={field}
                  className="relative border-b-2 border-border bg-muted/90 backdrop-blur-sm px-2 py-3 text-xs font-bold text-foreground text-center select-none"
                  style={{ width: colWidths[field] || 120, minWidth: 60 }}
                >
                  {FIELD_LABELS[field]}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/30"
                    onMouseDown={e => onResizeStart(field, e)}
                  />
                </th>
              ))}
              <th
                className="sticky right-0 z-30 border-b-2 border-border bg-muted/90 backdrop-blur-sm px-3 py-3 text-xs font-bold text-foreground text-center"
                style={{ width: 180, minWidth: 180 }}
              >
                操作
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredOrders.length === 0 && (
              <tr>
                <td colSpan={FIELD_ORDER.length + 2} className="py-16 text-center text-muted-foreground text-sm">
                  {activeTab === 'arrived' ? '今天暂无到货数据' : '暂无订单数据，点击「新增行」或从 Excel 粘贴数据'}
                </td>
              </tr>
            )}
            {filteredOrders.map((order, rowIdx) => (
              <tr key={order.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="sticky left-0 z-20 bg-card px-2 py-1.5 align-middle text-center" style={{ width: 40 }}>
                  <Checkbox
                    checked={selectedIds.has(order.id)}
                    onCheckedChange={() => toggleSelect(order.id)}
                  />
                </td>
                {FIELD_ORDER.map((field, colIdx) => (
                  <td
                    key={field}
                    className={`px-1 py-1.5 align-middle text-center break-words select-none transition-colors duration-100 ${
                      isCellSelected(rowIdx, colIdx) ? 'bg-primary/15 outline outline-2 outline-primary/40 outline-offset-[-2px]' : ''
                    }${isRowHighlighted(rowIdx) ? ' bg-primary/5' : ''}${isColHighlighted(colIdx) ? ' bg-primary/[0.03]' : ''}${isFocusedCell(rowIdx, colIdx) && !isCellSelected(rowIdx, colIdx) ? ' ring-2 ring-primary/30 ring-inset' : ''}`}
                    style={{ width: colWidths[field] || 120, maxWidth: colWidths[field] || 120 }}
                    onMouseDown={(e) => handleCellMouseDown(rowIdx, colIdx, e)}
                    onMouseEnter={() => handleCellMouseEnter(rowIdx, colIdx)}
                  >
                    {renderEditableCell(order, field)}
                  </td>
                ))}
                <td className="sticky right-0 z-20 bg-card px-2 py-1.5 align-middle" style={{ width: 180, minWidth: 180 }}>
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      size="sm"
                      variant={order.status === '已采购' ? 'default' : 'outline'}
                      className="h-7 text-xs"
                      onClick={() => {
                        if (order.status === '已采购') {
                          changeStatus(order.id, '待处理');
                        } else {
                          changeStatus(order.id, '已采购');
                        }
                      }}
                    >
                      已采购
                    </Button>
                    <Button
                      size="sm"
                      variant={order.status === '已调拨' ? 'default' : 'outline'}
                      className="h-7 text-xs"
                      onClick={() => {
                        if (order.status === '已调拨') {
                          changeStatus(order.id, '待处理');
                        } else {
                          changeStatus(order.id, '已调拨');
                        }
                      }}
                    >
                      已调拨
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(order.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>删除后不可恢复，确定要删除该订单吗？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={deleteRow} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* batch delete confirm */}
      <AlertDialog open={batchDeleteOpen} onOpenChange={setBatchDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>批量删除确认</AlertDialogTitle>
            <AlertDialogDescription>确定要删除选中的 {selectedIds.size} 条订单吗？此操作不可恢复。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={batchDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">删除 {selectedIds.size} 条</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* batch status change */}
      <Dialog open={batchStatusOpen} onOpenChange={setBatchStatusOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>批量修改状态</DialogTitle>
            <DialogDescription>将选中的 {selectedIds.size} 条订单状态统一修改为：</DialogDescription>
          </DialogHeader>
          <Select value={batchStatusValue} onValueChange={setBatchStatusValue}>
            <SelectTrigger>
              <SelectValue placeholder="选择状态" />
            </SelectTrigger>
            <SelectContent>
              {customOptions.statuses.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button onClick={batchChangeStatus} disabled={!batchStatusValue}>确认修改</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* custom option dialog */}
      <Dialog open={optionDialog.open} onOpenChange={(open) => setOptionDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              管理{optionDialog.field === 'procurementMethod' ? '采购方式' : optionDialog.field === 'orderForm' ? '订单形式' : '状态'}选项
            </DialogTitle>
            <DialogDescription>可新增或删除选项，数据自动保存</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {getOptionList().map(val => (
                <Badge key={val} variant="secondary" className="gap-1 pr-1">
                  {val}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-4 w-4 ml-0.5 hover:bg-destructive/20"
                    onClick={() => removeCustomOption(val)}
                  >
                    <X className="size-3" />
                  </Button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="新选项名称"
                value={newOptionValue}
                onChange={e => setNewOptionValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addCustomOption(); }}
                className="h-8 text-sm"
              />
              <Button size="sm" onClick={addCustomOption}>添加</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* order preview modal */}
      <OrderPreviewModal
        orders={previewOrders}
        open={orderPreviewOpen}
        onClose={() => setOrderPreviewOpen(false)}
      />
    </div>
  );
}

export default ProcurementTableSection;
