import { useState } from 'react';
import { useAuth, ROLE_LABELS, type UserRole } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, LogOut, Users, Shield, Plus, Trash2, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function UserBar() {
  const {
    currentUser, users, collaborators, isLoggedIn,
    logout, switchUser, canManageUsers,
    addUser, deleteUser, updateUserRole,
  } = useAuth();

  const [manageOpen, setManageOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('editor');

  const activeCollaborators = collaborators.filter(
    c => c.userId !== currentUser?.id
  );

  const handleAddUser = () => {
    if (!newUsername.trim() || !newPassword.trim() || !newDisplayName.trim()) {
      toast.error('请填写所有字段');
      return;
    }
    addUser({
      username: newUsername.trim(),
      password: newPassword,
      displayName: newDisplayName.trim(),
      role: newRole,
    });
    toast.success(`已添加用户：${newDisplayName.trim()}`);
    setNewUsername('');
    setNewPassword('');
    setNewDisplayName('');
    setNewRole('editor');
    setAddOpen(false);
  };

  if (!isLoggedIn || !currentUser) return null;

  return (
    <>
      {/* 用户信息区 */}
      <div className="flex items-center gap-2">
        {/* 在线协作者 */}
        {activeCollaborators.length > 0 && (
          <div className="flex items-center gap-1 mr-2">
            {activeCollaborators.slice(0, 3).map(c => (
              <div
                key={c.userId}
                className="size-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white relative group"
                style={{ backgroundColor: c.color }}
                title={`${c.displayName} 在线`}
              >
                {c.displayName.charAt(0)}
                <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 border-2 border-background" />
              </div>
            ))}
            {activeCollaborators.length > 3 && (
              <span className="text-xs text-muted-foreground ml-1">
                +{activeCollaborators.length - 3}
              </span>
            )}
          </div>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 h-8">
              <div
                className="size-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                style={{ backgroundColor: currentUser.color }}
              >
                {currentUser.displayName.charAt(0)}
              </div>
              <span className="text-xs font-medium max-w-[80px] truncate">
                {currentUser.displayName}
              </span>
              <Badge variant="secondary" className="text-[10px] h-4 px-1">
                {ROLE_LABELS[currentUser.role]}
              </Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col gap-0.5">
                <span>{currentUser.displayName}</span>
                <span className="text-xs text-muted-foreground font-normal">
                  @{currentUser.username} · {ROLE_LABELS[currentUser.role]}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {/* 切换用户 */}
            {users.length > 1 && (
              <>
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                  切换用户
                </DropdownMenuLabel>
                {users.filter(u => u.id !== currentUser.id).map(u => (
                  <DropdownMenuItem
                    key={u.id}
                    onClick={() => switchUser(u.id)}
                    className="gap-2"
                  >
                    <div
                      className="size-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ backgroundColor: u.color }}
                    >
                      {u.displayName.charAt(0)}
                    </div>
                    <span className="flex-1">{u.displayName}</span>
                    <Badge variant="outline" className="text-[10px] h-4">
                      {ROLE_LABELS[u.role]}
                    </Badge>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}

            {/* 在线协作者 */}
            {activeCollaborators.length > 0 && (
              <>
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                  在线协作者 ({activeCollaborators.length})
                </DropdownMenuLabel>
                {activeCollaborators.map(c => (
                  <div key={c.userId} className="flex items-center gap-2 px-2 py-1">
                    <div
                      className="size-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ backgroundColor: c.color }}
                    >
                      {c.displayName.charAt(0)}
                    </div>
                    <span className="text-sm flex-1">{c.displayName}</span>
                    <span className="size-2 rounded-full bg-emerald-500" />
                  </div>
                ))}
                <DropdownMenuSeparator />
              </>
            )}

            {/* 用户管理（仅管理员） */}
            {canManageUsers && (
              <DropdownMenuItem onClick={() => setManageOpen(true)} className="gap-2">
                <Shield className="size-4" />
                用户管理
              </DropdownMenuItem>
            )}

            <DropdownMenuItem onClick={logout} className="gap-2 text-destructive">
              <LogOut className="size-4" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 用户管理弹窗 */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="size-5" />
              用户管理
            </DialogTitle>
            <DialogDescription>
              管理系统用户及其角色权限
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {users.map(u => (
              <div
                key={u.id}
                className="flex items-center gap-2 p-2 rounded-lg border border-border/40"
              >
                <div
                  className="size-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: u.color }}
                >
                  {u.displayName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{u.displayName}</div>
                  <div className="text-xs text-muted-foreground">@{u.username}</div>
                </div>
                <Select
                  value={u.role}
                  onValueChange={(v) => updateUserRole(u.id, v as UserRole)}
                >
                  <SelectTrigger className="h-7 w-[90px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">管理员</SelectItem>
                    <SelectItem value="editor">编辑者</SelectItem>
                    <SelectItem value="viewer">查看者</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:text-destructive"
                  onClick={() => {
                    deleteUser(u.id);
                    toast.success(`已删除用户：${u.displayName}`);
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-2"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="size-4 mr-1.5" />
            添加用户
          </Button>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 添加用户弹窗 */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>添加用户</DialogTitle>
            <DialogDescription>创建新的系统用户账号</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-name">显示名称</Label>
              <Input
                id="new-name"
                value={newDisplayName}
                onChange={e => setNewDisplayName(e.target.value)}
                placeholder="输入姓名"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-username">用户名</Label>
              <Input
                id="new-username"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                placeholder="登录用户名"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-pwd">密码</Label>
              <Input
                id="new-pwd"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="设置密码"
              />
            </div>
            <div className="space-y-1.5">
              <Label>角色</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as UserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">管理员</SelectItem>
                  <SelectItem value="editor">编辑者</SelectItem>
                  <SelectItem value="viewer">查看者</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>取消</Button>
            <Button onClick={handleAddUser}>
              <Check className="size-4 mr-1.5" />
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
