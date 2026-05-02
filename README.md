# Readest Web

<div align="center">
  <img src="./apps/readest-app/public/icon.png" alt="Readest Logo" width="120" />
  <p>一个面向 Web/PWA 的电子书阅读器。</p>
  <p>
    <a href="https://read.yoshinagakoi.eu.org/">在线访问</a>
    ·
    <a href="#本地开发">本地开发</a>
    ·
    <a href="#部署">部署</a>
    ·
    <a href="#账号准备">账号准备</a>
  </p>
</div>

## 概览

这是基于开源项目 [Readest](https://github.com/readest/readest) 改出来的 Web/PWA 版本，当前维护重点是个人或私有部署，不适合作为开放注册的公共服务。

当前线上地址：

https://read.yoshinagakoi.eu.org/

这个版本已经和上游的多端发行思路分开了，README 只保留当前 Web 版真正相关的内容。

## 项目定位

- 只保留 Web/PWA 方向，核心应用位于 `apps/readest-app`。
- 运行在 Next.js 16 + OpenNext for Cloudflare 上，推荐部署为 Cloudflare Worker。
- 使用 Next.js App Router API routes 承担同源 API、文件存储、同步接口、KOReader Sync 代理和 OPDS 代理。
- 仍保留 `functions/` 目录，方便需要静态导出 + Cloudflare Pages Functions 的部署方式。
- 站内导航支持无刷新切换，页面切换有加载条。
- 已移除前端公开注册入口，账号必须先在 Supabase 中创建。
- 中文环境不再自动导入默认示例书，首次进入书库时保持空书库。

## 功能

当前版本保留的核心能力：

- 支持 EPUB、MOBI、KF8/AZW3、FB2、CBZ、TXT、PDF 等格式。
- 支持滚动阅读和分页阅读。
- 支持书库管理、导入、阅读进度、书签、划线和笔记。
- 支持全文搜索、目录跳转、字体、主题、排版和阅读背景设置。
- 支持字典、维基百科查询和翻译功能。
- 支持文本朗读 TTS。
- 支持 OPDS/Calibre 目录浏览和下载。
- 支持 KOReader Sync 进度同步，公网 KOReader Sync 服务通过同源代理访问。
- 支持 Readwise 高亮同步和 Hardcover 阅读进度/笔记同步，需在应用内配置对应 token。
- 支持注释/划线深链接落地页，可从分享链接跳转到 Web 阅读器或 Readest App。
- 支持 PWA 安装、离线缓存和移动端浏览器使用。
- 支持账号登录、云端存储和同步，具体取决于 Supabase、R2 和 Cloudflare 配置。

## 技术栈

- Next.js 16
- React 19
- TypeScript
- pnpm workspace
- Tailwind CSS / daisyUI
- foliate-js
- Supabase
- Cloudflare Workers / Pages / R2 / KV
- Serwist PWA

## 目录结构

```text
.
├─ apps/readest-app/          # Web 应用主体
│  ├─ src/app/                # Next.js App Router 页面
│  ├─ src/components/         # 通用组件和阅读器 UI
│  ├─ src/services/           # OPDS、同步、TTS、翻译、AI 等业务逻辑
│  ├─ src/store/              # Zustand 状态
│  ├─ src/hooks/              # React Hooks
│  ├─ src/utils/              # 工具函数
│  ├─ functions/              # Cloudflare Pages Functions 兼容入口
│  ├─ public/                 # 静态资源、PWA、重定向配置
│  ├─ next.config.mjs         # Next.js / OpenNext / 静态导出配置
│  └─ wrangler.toml           # OpenNext Cloudflare Worker 配置
├─ packages/foliate-js/       # 阅读和文档解析核心
├─ package.json
└─ pnpm-workspace.yaml
```

## 账号准备

这个项目当前不开放注册。要自己使用，先在 Supabase 里创建一个可登录账号，再用这个账号登录 Readest。

### 方法一: 在 Supabase Dashboard 手动创建

1. 打开 Supabase 项目后台。
2. 进入 `Authentication` -> `Users`。
3. 选择 `Add user` 或 `Invite user`。
4. 填入邮箱和密码，按需要决定是否自动确认邮箱。
5. 创建完成后，用这个邮箱对应的账号登录 Readest。

参考文档：

- https://supabase.com/docs/guides/auth/users
- https://supabase.com/docs/reference/javascript/auth-admin-createuser

### 方法二: 用服务端 Admin API 创建

如果你更习惯脚本化管理，可以在服务端调用 Supabase Admin API 创建用户。不要把 `service_role` key 暴露到浏览器。

```ts
await supabase.auth.admin.createUser({
  email: 'you@example.com',
  password: 'your-password',
  email_confirm: true,
});
```

如果你保留当前登录页的用户名输入方式，还要在
`apps/readest-app/src/app/auth/page.tsx`
里把用户名映射到对应邮箱。

## 环境要求

建议使用较新的 Node.js 和 pnpm。

```bash
node --version
pnpm --version
```

当前仓库使用：

- pnpm 10.x
- Node.js 建议 22 或更高版本

## 本地开发

以下命令默认在仓库根目录执行。

1. 初始化子模块

```bash
git submodule update --init --recursive
```

当前仍保留 `packages/simplecc-wasm` 作为子模块，用于准备简繁转换相关的 Web 资源。

2. 安装依赖

```bash
pnpm install
```

3. 准备阅读器依赖资源

```bash
pnpm --filter @readest/readest-app setup-vendors
```

4. 启动 Web 开发服务

```bash
pnpm dev-web
```

默认会启动 Next.js 开发服务器，实际端口以终端输出为准。

## 构建与部署

### 推荐: OpenNext for Cloudflare

当前仓库的默认 Cloudflare 部署配置在：

```text
apps/readest-app/wrangler.toml
```

该配置使用 `@opennextjs/cloudflare`，构建后会生成 `.open-next/worker.js` 和 `.open-next/assets`，由 Cloudflare Worker 统一处理页面、API routes 和静态资源。

本地预览：

```bash
pnpm --filter @readest/readest-app preview
```

部署：

```bash
pnpm --filter @readest/readest-app deploy
```

如果只想上传但不立即切流量：

```bash
pnpm --filter @readest/readest-app upload
```

当前 Worker 名称：

```text
readest-web
```

生产域名：

```text
https://read.yoshinagakoi.eu.org/
```

### 备用: 静态导出到 Cloudflare Pages

如果你更想使用传统 Cloudflare Pages 静态站点，也可以继续走静态导出。构建前需要指定 Web 平台和 `NEXT_OUTPUT=export`。

PowerShell：

```powershell
$env:NEXT_PUBLIC_APP_PLATFORM = "web"
$env:NEXT_OUTPUT = "export"
pnpm --filter @readest/readest-app build-web
```

Bash：

```bash
NEXT_PUBLIC_APP_PLATFORM=web NEXT_OUTPUT=export pnpm --filter @readest/readest-app build-web
```

构建产物位于：

```text
apps/readest-app/out
```

部署到 Pages：

```bash
pnpm --filter @readest/readest-app exec wrangler pages deploy out --project-name=readest-web --branch=main --commit-dirty=true
```

静态导出模式下，Pages Functions 位于：

```text
apps/readest-app/functions
```

其中 `api/opds/proxy.js`、`api/kosync.js`、`api/storage/*` 和 `api/sync.js` 分别处理 OPDS 代理、KOReader Sync 代理、文件存储和书库同步。

## 常用命令

```bash
# 类型检查和代码检查
pnpm lint

# 单元测试
pnpm test

# Web 构建
pnpm --filter @readest/readest-app build-web

# 格式化
pnpm format
```

## 环境变量

自部署时需要根据自己的 Supabase 和 Cloudflare 资源调整环境变量。常见配置如下：

| 变量                                   | 说明                                                |
| -------------------------------------- | --------------------------------------------------- |
| `NEXT_PUBLIC_APP_PLATFORM`             | Web 构建时设为 `web`                                |
| `NEXT_OUTPUT`                          | 静态导出时设为 `export`                             |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase 项目地址                                   |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase 公开 key                                   |
| `NEXT_PUBLIC_API_BASE_URL`             | API 基础地址；为空时使用同源 `/api`                 |
| `NEXT_PUBLIC_NODE_BASE_URL`            | Node/Worker API 基础地址；为空时回落到 API 基础地址 |
| `STORAGE_FIXED_QUOTA`                  | 默认存储配额                                        |
| `TRANSLATIONS_KV`                      | Cloudflare KV 绑定                                  |
| `READEST_FILES_R2_BUCKET`              | Cloudflare R2 文件存储 bucket 绑定                  |
| `NEXT_INC_CACHE_R2_BUCKET`             | OpenNext 增量缓存 R2 bucket 绑定                    |
| `WORKER_SELF_REFERENCE`                | OpenNext Worker 自引用 service 绑定                 |

当前 Web 部署推荐让前端请求同源 `/api`，这样 Cloudflare Worker 或 Pages Functions 都可以直接处理 API 请求。

## OPDS 说明

浏览器会受 CORS 限制，很多 OPDS/Calibre 服务不能直接从前端请求，因此当前版本通过同源代理访问：

```text
/api/opds/proxy?url=...
```

如果 OPDS 不能使用，优先检查：

- Cloudflare Worker 或 Pages Functions 是否已经随部署生效。
- `/api/opds/proxy`、`/api/kosync` 是否返回正常状态码。
- 目标 OPDS 地址是否可公网访问。
- 需要认证的 OPDS 是否正确传入认证信息或自定义 headers。

## 静态导出注意事项

Next.js 在 `output: export` 下会提示 rewrites 和 headers 不会自动生效。当前项目用 `public/_redirects` 补充 Pages 需要的重写规则，例如：

```text
/reader/:ids /reader?ids=:ids 200
```

如果新增需要服务端能力的路由，应优先放到 `src/app/api` 或 Cloudflare Pages Functions，或者确认静态导出不会破坏该路由。

## 与上游 Readest 的关系

本项目仍然基于 Readest 和 foliate-js，许可证继承上游的 AGPL-3.0-or-later。当前仓库是面向个人 Web 部署的修改版本，不等同于上游官方完整多平台发行版。

上游项目：

https://github.com/readest/readest

## 许可证

本项目遵循 GNU Affero General Public License v3.0 或更高版本。详情见 [LICENSE](LICENSE)。
