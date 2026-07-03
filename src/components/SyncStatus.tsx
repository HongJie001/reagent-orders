import { useEffect, useState } from 'react';
import { Cloud, CloudOff, Loader2, Wifi, WifiOff } from 'lucide-react';
import { isSupabaseAvailable, supabase } from '@/lib/supabase';

type ConnectionStatus = 'online' | 'offline' | 'syncing' | 'local';

export default function SyncStatus() {
  const [status, setStatus] = useState<ConnectionStatus>(() => {
    if (!isSupabaseAvailable()) return 'local';
    return navigator.onLine ? 'syncing' : 'offline';
  });

  useEffect(() => {
    if (!isSupabaseAvailable()) {
      setStatus('local');
      return;
    }

    // 检测网络状态
    const handleOnline = () => setStatus('syncing');
    const handleOffline = () => setStatus('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 检测 Supabase 连接
    let cancelled = false;
    async function checkConnection() {
      if (!supabase) return;
      try {
        const { error } = await supabase.from('options').select('count', { count: 'exact', head: true });
        if (!cancelled) setStatus(error ? 'offline' : 'online');
      } catch {
        if (!cancelled) setStatus('offline');
      }
    }

    checkConnection();
    const interval = setInterval(checkConnection, 30000);

    return () => {
      cancelled = true;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const config = {
    online: { icon: Cloud, label: '云端在线', className: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    offline: { icon: CloudOff, label: '云端离线', className: 'text-amber-600 bg-amber-50 border-amber-200' },
    syncing: { icon: Loader2, label: '同步中', className: 'text-blue-600 bg-blue-50 border-blue-200' },
    local: { icon: Wifi, label: '本地模式', className: 'text-gray-500 bg-gray-100 border-gray-200' },
  };

  const { icon: Icon, label, className } = config[status];

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border ${className}`}>
      <Icon className={`size-3 ${status === 'syncing' ? 'animate-spin' : ''}`} />
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}
