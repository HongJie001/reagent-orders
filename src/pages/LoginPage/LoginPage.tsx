import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { isSupabaseAvailable } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogIn, UserPlus, FlaskConical, Cloud, Wifi, Loader2, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function LoginPage() {
  const { login, register, isCloudAuth } = useAuth();
  const cloudAvailable = isSupabaseAvailable();

  // login form
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // register form
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regError, setRegError] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setLoginError('请填写用户名和密码');
      return;
    }
    setLoginLoading(true);
    try {
      const result = await login(loginUsername.trim(), loginPassword);
      if (!result.success) {
        setLoginError(result.error || '登录失败');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setRegError('');
    if (!regUsername.trim() || !regPassword.trim() || !regDisplayName.trim()) {
      setRegError('请填写所有字段');
      return;
    }
    if (regPassword.length < 6) {
      setRegError('密码至少6位');
      return;
    }
    setRegLoading(true);
    try {
      const result = await register(regUsername.trim(), regPassword, regDisplayName.trim());
      if (!result.success) {
        setRegError(result.error || '注册失败');
      }
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md"
      >
        {/* logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-primary text-primary-foreground mb-4">
            <FlaskConical className="size-8" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">试剂订单管理系统</h1>
          <p className="text-sm text-muted-foreground mt-1">科研试剂经销商协作平台</p>

          {/* 认证模式指示器 */}
          <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border bg-muted/50">
            {cloudAvailable ? (
              <>
                <Cloud className="size-3 text-emerald-600" />
                <span className="text-emerald-700">云端认证模式</span>
              </>
            ) : (
              <>
                <Wifi className="size-3 text-muted-foreground" />
                <span className="text-muted-foreground">本地认证模式</span>
              </>
            )}
          </div>
        </div>

        <Card className="border-border/40 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">欢迎使用</CardTitle>
            <CardDescription>
              {cloudAvailable
                ? '使用邮箱和密码登录云端账号'
                : '登录或注册本地账号开始协作'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="w-full mb-4">
                <TabsTrigger value="login" className="flex-1">
                  <LogIn className="size-4 mr-1.5" />
                  登录
                </TabsTrigger>
                <TabsTrigger value="register" className="flex-1">
                  <UserPlus className="size-4 mr-1.5" />
                  注册
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4" noValidate>
                  <div className="space-y-2">
                    <Label htmlFor="login-username">
                      {cloudAvailable ? '邮箱' : '用户名'}
                    </Label>
                    <Input
                      id="login-username"
                      type={cloudAvailable ? 'email' : 'text'}
                      value={loginUsername}
                      onChange={e => setLoginUsername(e.target.value)}
                      placeholder={cloudAvailable ? '输入邮箱地址' : '输入用户名'}
                      autoComplete="username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">密码</Label>
                    <Input
                      id="login-password"
                      type="password"
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      placeholder="输入密码"
                      autoComplete="current-password"
                    />
                  </div>
                  {loginError && (
                    <p className="text-sm text-destructive">{loginError}</p>
                  )}
                  <Button type="submit" className="w-full" disabled={loginLoading}>
                    {loginLoading ? (
                      <Loader2 className="size-4 mr-1.5 animate-spin" />
                    ) : (
                      <LogIn className="size-4 mr-1.5" />
                    )}
                    登录
                  </Button>
                  {!cloudAvailable && (
                    <p className="text-xs text-muted-foreground text-center">
                      演示账号：admin / admin123（管理员）
                    </p>
                  )}
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4" noValidate>
                  <div className="space-y-2">
                    <Label htmlFor="reg-displayname">显示名称</Label>
                    <Input
                      id="reg-displayname"
                      value={regDisplayName}
                      onChange={e => setRegDisplayName(e.target.value)}
                      placeholder="输入你的姓名"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-username">
                      {cloudAvailable ? '邮箱' : '用户名'}
                    </Label>
                    <Input
                      id="reg-username"
                      type={cloudAvailable ? 'email' : 'text'}
                      value={regUsername}
                      onChange={e => setRegUsername(e.target.value)}
                      placeholder={cloudAvailable ? '输入邮箱地址' : '设置登录用户名'}
                      autoComplete="username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-password">密码</Label>
                    <Input
                      id="reg-password"
                      type="password"
                      value={regPassword}
                      onChange={e => setRegPassword(e.target.value)}
                      placeholder="设置密码（至少6位）"
                      autoComplete="new-password"
                    />
                  </div>
                  {regError && (
                    <p className="text-sm text-destructive">{regError}</p>
                  )}
                  <Button type="submit" className="w-full" disabled={regLoading}>
                    {regLoading ? (
                      <Loader2 className="size-4 mr-1.5 animate-spin" />
                    ) : (
                      <UserPlus className="size-4 mr-1.5" />
                    )}
                    注册并登录
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* 部署指南入口 */}
        <div className="mt-4 text-center">
          <Link
            to="/deploy-guide"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <BookOpen className="size-3" />
            查看部署指南（Vercel + Supabase）
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
