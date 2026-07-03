# 🚀 科研试剂订单管理系统 — 部署指南（手把手教学）

> 即使你完全不懂编程，跟着这份指南一步步操作，**20 分钟**就能把系统部署上线！

---

## 📋 整体流程

```
① 注册 Supabase → ② 创建数据库 → ③ 执行建表 SQL → ④ 获取密钥
→ ⑤ 注册 Vercel → ⑥ 导入代码 → ⑦ 配置密钥 → ⑧ 部署完成！
```

---

## 第一部分：设置 Supabase（在线数据库）⏱ 约 10 分钟

### 什么是 Supabase？
Supabase 是一个**免费的在线数据库**，可以理解成"网上的 Excel"——所有订单数据都存在这里，团队成员打开网页看到的是同一份数据。它还自带用户注册登录和实时同步功能。

### 1.1 注册账号
1. 打开 [supabase.com](https://supabase.com)
2. 点击右上角绿色的 **「Sign Up」**
3. 选择 **「Continue with GitHub」**（推荐，最方便）
4. 没有 GitHub 账号？点「Sign up with email」用邮箱注册

### 1.2 创建新项目
1. 登录后进入 Dashboard，点击右上角黄色的 **「New project」**
2. 填写信息：
   - **Name**: `reagent-orders`（或你喜欢的名字）
   - **Database Password**: 设置一个密码，**请务必记下来！**（如 `Reagent2025!`）
   - **Region**: 选 **Southeast Asia (Singapore)**，离国内最近
3. 点击 **「Create project」**，等待 1-2 分钟

### 1.3 执行建表 SQL
1. 左侧菜单点击 **「SQL Editor」**（⚡图标）
2. 点击 **「New query」**
3. 将项目根目录 `supabase-schema.sql` 的内容**完整粘贴**进去
4. 点击右下角绿色 **「Run」** 按钮
5. 看到 "Success. No rows returned" 说明成功！

### 1.4 获取 API 密钥（🔴 关键步骤）
1. 左侧菜单点击 **「Settings」**（⚙️齿轮图标）→ **「API」**
2. 复制 **Project URL**（格式：`https://xxxxx.supabase.co`）→ 存到记事本
3. 复制 **anon public key**（很长一串字母）→ 存到记事本
4. ⚠️ 这两个值后面部署 Vercel 时要用，**请务必保存好**

### 1.5 开启 Realtime（实时同步）
1. 左侧菜单点击 **「Database」** → **「Replication」**
2. 找到 `supabase_realtime`，确保以下 4 张表开关打开：`orders`、`shipments`、`product_memory`、`options`

### 1.6 关闭邮箱验证（可选，推荐）
1. 左侧菜单点击 **「Authentication」** → **「Settings」**
2. 关掉 **「Confirm email」** 开关 → 点击 **「Save」**
3. 这样用户注册后直接登录，不用验证邮箱

---

## 第二部分：获取源代码 ⏱ 约 3 分钟

### 2.1 上传到 GitHub（推荐）
1. 注册 [GitHub](https://github.com) 账号（免费）
2. 点击右上角 **「+」** → **「New repository」**
3. Repository name 填 `reagent-orders`，选 **Public**，点击创建
4. 将项目代码上传到该仓库

### 2.2 通过妙搭平台导出
1. 在妙搭平台点击「导出」或「下载」按钮
2. 下载 ZIP 压缩包，解压
3. 将整个文件夹拖到 GitHub 仓库页面上传

---

## 第三部分：部署到 Vercel（网页托管）⏱ 约 5 分钟

### 什么是 Vercel？
Vercel 是一个**免费的前端托管平台**，可以理解成"网上的文件柜"——把你的网页文件放上去，全世界就能通过网址访问了。

### 3.1 注册 Vercel
1. 打开 [vercel.com](https://vercel.com)
2. 点击 **「Sign Up」** → 选择 **「Continue with GitHub」**
3. 授权 Vercel 访问你的 GitHub 账号

### 3.2 导入项目
1. 点击 **「Add New...」** → **「Project」**
2. 在列表中找到 `reagent-orders`，点击 **「Import」**

### 3.3 配置环境变量（🔴 关键步骤）
在 **「Environment Variables」** 区域添加两个变量：

| 变量名 | 变量值 |
|--------|--------|
| `VITE_SUPABASE_URL` | 粘贴第 1.4 步的 Project URL（`https://xxxxx.supabase.co`） |
| `VITE_SUPABASE_ANON_KEY` | 粘贴第 1.4 步的 anon key（长字符串） |

⚠️ 变量名一字不差，变量值完整粘贴，两个缺一不可！

### 3.4 部署
1. 点击 **「Deploy」** 按钮
2. 等待 1-2 分钟，看到🎉烟花动画 = 部署成功！
3. 你会得到一个网址，格式：`https://reagent-orders-xxxxx.vercel.app`
4. 📌 **这就是你的系统网址！** 复制发到团队群里即可

### 3.5 绑定自定义域名（可选）
1. Vercel 项目 → Settings → Domains
2. 输入你的域名，按提示添加 DNS 记录
3. 等待 DNS 生效（5-30 分钟）

---

## 第四部分：团队使用

### 分享链接
把 Vercel 给你的网址发到微信群/钉钉群，同事用浏览器打开即可。

### 注册账号
打开网址 → 点击「注册」→ 填写显示名称、邮箱、密码 → 注册并登录。

### 设置管理员
1. 进入 Supabase Dashboard → Table Editor → 选择 `user_profiles` 表
2. 找到对应用户，把 `role` 改为 `admin`

### 三种权限
| 角色 | 权限 |
|------|------|
| 🔑 管理员 | 全部权限：增删改查 + 管理用户 |
| ✏️ 编辑者 | 可新增和编辑，不可删除 |
| 👀 查看者 | 只读，不可修改任何数据 |

---

## 常见问题 FAQ

### Q: 部署失败了怎么办？
1. 检查环境变量是否配置正确（两个变量名一字不差）
2. 检查 GitHub 仓库代码是否完整
3. 在 Vercel 点「Redeploy」重试
4. 查看 Build Logs 了解具体报错

### Q: 部署成功但打开是空白页？
环境变量没配好。去 Vercel → Settings → Environment Variables 确认两个变量都在，然后点「Redeploy」。

### Q: 注册后无法登录？
1. 检查是否关闭了邮箱验证（第 1.6 步）
2. 确认密码至少 6 位
3. 在 Supabase → Authentication → Users 查看用户是否存在

### Q: 多人操作数据不同步？
检查 Realtime 是否开启（第 1.5 步），确认 4 张表开关都是绿色。

### Q: 免费额度够用吗？
完全够！Supabase 免费版 500MB 数据库 + 5 万月活用户，Vercel 免费版 100GB 带宽/月。小团队用几年都不会超。

### Q: 怎么换成自己的域名？
Vercel → Settings → Domains → 输入域名 → 按提示添加 DNS 记录。

### Q: 代码更新了怎么同步？
把新代码推送到 GitHub，Vercel 会自动检测并重新部署，你什么都不用做。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 19 + TypeScript |
| 构建工具 | Vite 8 |
| UI 框架 | Tailwind CSS 4 + shadcn/ui |
| 后端数据库 | Supabase (PostgreSQL) |
| 实时同步 | Supabase Realtime |
| 用户认证 | Supabase Auth |
| 部署平台 | Vercel |
