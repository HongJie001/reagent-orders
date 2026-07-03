import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { scopedStorage, logger } from '@lark-apaas/client-toolkit-lite';
import { supabase, isSupabaseAvailable } from '@/lib/supabase';

// ─── types ───────────────────────────────────────────────────────────
export type UserRole = 'admin' | 'editor' | 'viewer';

export interface IUser {
  id: string;
  username: string;
  password: string;
  displayName: string;
  role: UserRole;
  color: string;
  createdAt: string;
}

export interface ICollaborator {
  userId: string;
  username: string;
  displayName: string;
  color: string;
  selectedCell: { row: number; col: number } | null;
  lastActiveAt: string;
}

// ─── storage keys ────────────────────────────────────────────────────
const USERS_KEY = '__app_reagent_users';
const CURRENT_USER_KEY = '__app_reagent_current_user';
const COLLABORATORS_KEY = '__app_reagent_collaborators';

// ─── default admin user ──────────────────────────────────────────────
const DEFAULT_USERS: IUser[] = [
  { id: 'admin-001', username: 'admin', password: 'admin123', displayName: '管理员', role: 'admin', color: '#3b82f6', createdAt: '2025-01-01T00:00:00Z' },
  { id: 'editor-001', username: 'editor', password: 'editor123', displayName: '编辑员', role: 'editor', color: '#10b981', createdAt: '2025-01-01T00:00:00Z' },
  { id: 'viewer-001', username: 'viewer', password: 'viewer123', displayName: '查看员', role: 'viewer', color: '#f59e0b', createdAt: '2025-01-01T00:00:00Z' },
];

const ROLE_LABELS: Record<UserRole, string> = {
  admin: '管理员',
  editor: '编辑者',
  viewer: '查看者',
};

const ROLE_PERMISSIONS: Record<UserRole, { canEdit: boolean; canDelete: boolean; canAdd: boolean; canManageUsers: boolean }> = {
  admin: { canEdit: true, canDelete: true, canAdd: true, canManageUsers: true },
  editor: { canEdit: true, canDelete: false, canAdd: true, canManageUsers: false },
  viewer: { canEdit: false, canDelete: false, canAdd: false, canManageUsers: false },
};

// ─── local auth helpers ──────────────────────────────────────────────
function loadUsers(): IUser[] {
  try {
    const raw = scopedStorage.getItem(USERS_KEY);
    if (raw) return JSON.parse(raw) as IUser[];
  } catch { /* ignore */ }
  return DEFAULT_USERS;
}

function saveUsers(users: IUser[]) {
  scopedStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function loadCurrentUser(): IUser | null {
  try {
    const raw = scopedStorage.getItem(CURRENT_USER_KEY);
    if (raw) return JSON.parse(raw) as IUser;
  } catch { /* ignore */ }
  return null;
}

function saveCurrentUser(user: IUser | null) {
  if (user) {
    scopedStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } else {
    scopedStorage.removeItem(CURRENT_USER_KEY);
  }
}

function loadCollaborators(): ICollaborator[] {
  try {
    const raw = scopedStorage.getItem(COLLABORATORS_KEY);
    if (raw) return JSON.parse(raw) as ICollaborator[];
  } catch { /* ignore */ }
  return [];
}

function saveCollaborators(collaborators: ICollaborator[]) {
  scopedStorage.setItem(COLLABORATORS_KEY, JSON.stringify(collaborators));
}

// ─── context ─────────────────────────────────────────────────────────
interface AuthContextValue {
  currentUser: IUser | null;
  users: IUser[];
  collaborators: ICollaborator[];
  isLoggedIn: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, password: string, displayName: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  switchUser: (userId: string) => void;
  updateCollaboratorCell: (cell: { row: number; col: number } | null) => void;
  canEdit: boolean;
  canDelete: boolean;
  canAdd: boolean;
  canManageUsers: boolean;
  roleLabel: string;
  addUser: (user: Omit<IUser, 'id' | 'createdAt' | 'color'> & { color?: string }) => void;
  deleteUser: (userId: string) => void;
  updateUserRole: (userId: string, role: UserRole) => void;
  /** 是否使用云端认证 */
  isCloudAuth: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<IUser | null>(() => loadCurrentUser());
  const [users, setUsers] = useState<IUser[]>(() => loadUsers());
  const [collaborators, setCollaborators] = useState<ICollaborator[]>(() => loadCollaborators());
  const [isCloudAuth] = useState(() => isSupabaseAvailable());

  // ── Supabase Auth: 恢复 session ──
  useEffect(() => {
    if (!isSupabaseAvailable() || !supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const su = session.user;
        supabase!.from('user_profiles')
          .select('*')
          .eq('id', su.id)
          .single()
          .then(({ data: profile }) => {
            if (profile) {
              const user: IUser = {
                id: su.id,
                username: su.email ?? '',
                password: '',
                displayName: (profile as Record<string, string>).display_name || su.email?.split('@')[0] || '用户',
                role: ((profile as Record<string, string>).role as UserRole) || 'editor',
                color: '#3b82f6',
                createdAt: su.created_at,
              };
              setCurrentUser(user);
              saveCurrentUser(user);
            }
          });
      }
    });

    // 监听 auth 状态变更
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const su = session.user;
        supabase!.from('user_profiles')
          .select('*')
          .eq('id', su.id)
          .single()
          .then(({ data: profile }) => {
            if (profile) {
              const user: IUser = {
                id: su.id,
                username: su.email ?? '',
                password: '',
                displayName: (profile as Record<string, string>).display_name || su.email?.split('@')[0] || '用户',
                role: ((profile as Record<string, string>).role as UserRole) || 'editor',
                color: '#3b82f6',
                createdAt: su.created_at,
              };
              setCurrentUser(user);
              saveCurrentUser(user);
            }
          });
      } else {
        setCurrentUser(null);
        saveCurrentUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // sync collaborators across tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === null || e.key === COLLABORATORS_KEY) {
        setCollaborators(loadCollaborators());
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // register current user as collaborator
  useEffect(() => {
    if (!currentUser) return;
    const now = new Date().toISOString();
    setCollaborators(prev => {
      const existing = prev.find(c => c.userId === currentUser.id);
      if (existing) {
        const updated = prev.map(c =>
          c.userId === currentUser.id ? { ...c, lastActiveAt: now } : c
        );
        saveCollaborators(updated);
        return updated;
      }
      const updated = [...prev, {
        userId: currentUser.id,
        username: currentUser.username,
        displayName: currentUser.displayName,
        color: currentUser.color,
        selectedCell: null,
        lastActiveAt: now,
      }];
      saveCollaborators(updated);
      return updated;
    });

    const interval = setInterval(() => {
      const t = new Date().toISOString();
      setCollaborators(prev => {
        const updated = prev.map(c =>
          c.userId === currentUser.id ? { ...c, lastActiveAt: t } : c
        );
        saveCollaborators(updated);
        return updated;
      });
    }, 30000);

    return () => clearInterval(interval);
  }, [currentUser?.id]);

  // cleanup stale collaborators (> 5 min inactive)
  useEffect(() => {
    const interval = setInterval(() => {
      const cutoff = Date.now() - 5 * 60 * 1000;
      setCollaborators(prev => {
        const updated = prev.filter(c => new Date(c.lastActiveAt).getTime() > cutoff);
        if (updated.length !== prev.length) saveCollaborators(updated);
        return updated;
      });
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // ── login ──
  const login = useCallback(async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    // Supabase Auth 模式
    if (isSupabaseAvailable() && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: username.includes('@') ? username : `${username}@reagent.local`,
        password,
      });

      if (error) {
        return { success: false, error: error.message === 'Invalid login credentials' ? '用户名或密码错误' : error.message };
      }

      if (data.user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        const user: IUser = {
          id: data.user.id,
          username: data.user.email ?? username,
          password: '',
          displayName: (profile as Record<string, string> | null)?.display_name || data.user.email?.split('@')[0] || username,
          role: ((profile as Record<string, string> | null)?.role as UserRole) || 'editor',
          color: '#3b82f6',
          createdAt: data.user.created_at,
        };
        setCurrentUser(user);
        saveCurrentUser(user);
        logger.info(`[Cloud Auth] 用户登录: ${user.displayName}`);
        return { success: true };
      }
      return { success: false, error: '登录失败，请重试' };
    }

    // 本地模式
    const allUsers = loadUsers();
    const user = allUsers.find(u => u.username === username && u.password === password);
    if (!user) {
      return { success: false, error: '用户名或密码错误' };
    }
    setCurrentUser(user);
    saveCurrentUser(user);
    setUsers(allUsers);
    logger.info(`用户登录: ${user.displayName}`);
    return { success: true };
  }, []);

  // ── register ──
  const register = useCallback(async (username: string, password: string, displayName: string): Promise<{ success: boolean; error?: string }> => {
    // Supabase Auth 模式
    if (isSupabaseAvailable() && supabase) {
      const email = username.includes('@') ? username : `${username}@reagent.local`;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      });

      if (error) {
        if (error.message.includes('already registered')) {
          return { success: false, error: '该邮箱已被注册' };
        }
        return { success: false, error: error.message };
      }

      if (data.user) {
        // 更新 profile 中的 display_name
        await supabase.from('user_profiles').update({ display_name: displayName }).eq('id', data.user.id);

        const user: IUser = {
          id: data.user.id,
          username: email,
          password: '',
          displayName,
          role: 'editor',
          color: '#10b981',
          createdAt: data.user.created_at,
        };
        setCurrentUser(user);
        saveCurrentUser(user);
        logger.info(`[Cloud Auth] 用户注册: ${displayName}`);
        return { success: true };
      }
      return { success: false, error: '注册失败，请重试' };
    }

    // 本地模式
    const allUsers = loadUsers();
    if (allUsers.find(u => u.username === username)) {
      return { success: false, error: '用户名已存在' };
    }
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
    const newUser: IUser = {
      id: `user-${Date.now()}`,
      username, password, displayName,
      role: 'editor',
      color: colors[allUsers.length % colors.length],
      createdAt: new Date().toISOString(),
    };
    const updated = [...allUsers, newUser];
    saveUsers(updated);
    setUsers(updated);
    setCurrentUser(newUser);
    saveCurrentUser(newUser);
    logger.info(`用户注册: ${displayName}`);
    return { success: true };
  }, []);

  // ── logout ──
  const logout = useCallback(async () => {
    if (currentUser) {
      setCollaborators(prev => {
        const updated = prev.filter(c => c.userId !== currentUser.id);
        saveCollaborators(updated);
        return updated;
      });
    }

    if (isSupabaseAvailable() && supabase) {
      await supabase.auth.signOut();
    }

    setCurrentUser(null);
    saveCurrentUser(null);
  }, [currentUser]);

  const switchUser = useCallback((userId: string) => {
    const allUsers = loadUsers();
    const user = allUsers.find(u => u.id === userId);
    if (user) {
      if (currentUser) {
        setCollaborators(prev => {
          const updated = prev.filter(c => c.userId !== currentUser.id);
          saveCollaborators(updated);
          return updated;
        });
      }
      setCurrentUser(user);
      saveCurrentUser(user);
    }
  }, [currentUser]);

  const updateCollaboratorCell = useCallback((cell: { row: number; col: number } | null) => {
    if (!currentUser) return;
    setCollaborators(prev => {
      const updated = prev.map(c =>
        c.userId === currentUser.id ? { ...c, selectedCell: cell, lastActiveAt: new Date().toISOString() } : c
      );
      saveCollaborators(updated);
      return updated;
    });
  }, [currentUser]);

  const permissions = currentUser ? ROLE_PERMISSIONS[currentUser.role] : ROLE_PERMISSIONS.viewer;
  const roleLabel = currentUser ? ROLE_LABELS[currentUser.role] : '未登录';

  const addUser = useCallback((userData: Omit<IUser, 'id' | 'createdAt' | 'color'> & { color?: string }) => {
    const allUsers = loadUsers();
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
    const newUser: IUser = {
      ...userData,
      id: `user-${Date.now()}`,
      color: userData.color || colors[allUsers.length % colors.length],
      createdAt: new Date().toISOString(),
    };
    const updated = [...allUsers, newUser];
    saveUsers(updated);
    setUsers(updated);
  }, []);

  const deleteUser = useCallback((userId: string) => {
    const updated = loadUsers().filter(u => u.id !== userId);
    saveUsers(updated);
    setUsers(updated);
  }, []);

  const updateUserRole = useCallback((userId: string, role: UserRole) => {
    const allUsers = loadUsers();
    const updated = allUsers.map(u => u.id === userId ? { ...u, role } : u);
    saveUsers(updated);
    setUsers(updated);
    if (currentUser?.id === userId) {
      const updatedCurrent = { ...currentUser, role };
      setCurrentUser(updatedCurrent);
      saveCurrentUser(updatedCurrent);
    }
  }, [currentUser]);

  return (
    <AuthContext.Provider value={{
      currentUser, users, collaborators,
      isLoggedIn: !!currentUser,
      login, register, logout, switchUser,
      updateCollaboratorCell,
      canEdit: permissions.canEdit, canDelete: permissions.canDelete,
      canAdd: permissions.canAdd, canManageUsers: permissions.canManageUsers,
      roleLabel,
      addUser, deleteUser, updateUserRole,
      isCloudAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { ROLE_LABELS, ROLE_PERMISSIONS };
