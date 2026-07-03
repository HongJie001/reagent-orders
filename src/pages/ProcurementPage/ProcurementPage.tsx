import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table2, FormInput, CheckCircle2 } from 'lucide-react';
import ProcurementTableSection from './ProcurementTableSection';
import ProcurementFormSection from './ProcurementFormSection';
import { useAuth } from '@/hooks/useAuth';

export default function ProcurementPage() {
  const [viewMode, setViewMode] = useState<'table' | 'form'>('table');
  const { canEdit } = useAuth();

  return (
    <div className="h-full flex flex-col p-4 md:p-6 lg:p-8">
      {/* 标题栏 + 视图切换 */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-foreground">采购需求</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {viewMode === 'table' ? '表格编辑模式 · 支持双击编辑、批量粘贴' : '表单录入模式 · 适合手机端填写'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* 自动保存提示 */}
          <Badge variant="secondary" className="gap-1 text-xs h-6">
            <CheckCircle2 className="size-3 text-emerald-500" />
            自动保存
          </Badge>
          {/* 视图切换 */}
          <div className="flex items-center border border-border rounded-md overflow-hidden">
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 rounded-none text-xs gap-1"
              onClick={() => setViewMode('table')}
            >
              <Table2 className="size-3.5" />
              表格
            </Button>
            <Button
              variant={viewMode === 'form' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 rounded-none text-xs gap-1"
              onClick={() => setViewMode('form')}
            >
              <FormInput className="size-3.5" />
              表单
            </Button>
          </div>
        </div>
      </div>

      {/* 内容区 */}
      {viewMode === 'table' ? (
        <ProcurementTableSection />
      ) : (
        <ProcurementFormSection onBack={() => setViewMode('table')} />
      )}
    </div>
  );
}
