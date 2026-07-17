# projects

这是一个基于 Express + Vite + TypeScript + Tailwind CSS 的全栈 Web 应用项目，由扣子编程 CLI 创建。

**核心特性：**
- 🚀 前端：Vite + TypeScript + Tailwind CSS
- 🔧 后端：Express + TypeScript，提供 RESTful API
- 🔥 开发模式：Vite HMR + Express API，单进程启动
- 📦 生产模式：Express 静态服务 + API，高性能部署

## 快速开始

### 启动开发服务器

```bash
coze dev
```

启动后，在浏览器中打开 [http://localhost:5000](http://localhost:5000) 查看应用。

开发服务器支持热更新（HMR），修改代码后页面会自动刷新。

### 构建生产版本

```bash
coze build
```

构建产物位于 `dist/` 目录，可直接部署到静态托管服务。

### 预览生产版本

```bash
coze start
```

在本地启动一个静态服务器，预览生产构建的效果。

## 项目结构

```
├── server/                # 后端服务器目录
│   ├── index.ts          # express 服务器入口
│   ├── routes/           # API 路由目录
│   │   └── index.ts      # 路由定义
│   └── vite.ts           # Vite 集成逻辑
├── src/                   # 前端源码目录
│   ├── index.ts          # 前端应用入口（初始化）
│   ├── main.ts           # 前端主逻辑文件
│   └── index.css         # 全局样式（包含 Tailwind 指令）
├── index.html            # HTML 入口文件
├── vite.config.ts        # Vite 配置
├── tailwind.config.ts    # Tailwind CSS 配置
└── tsconfig.json         # TypeScript 配置
```

**目录说明：**

- **`server/`** - 后端服务器代码
  - `server.ts` - 服务器主入口，负责创建和启动 Express 应用
  - `routes/` - API 路由模块，支持按功能拆分路由
  - `vite.ts` - Vite 开发服务器和静态文件服务集成

- **`src/`** - 前端应用代码
  - 所有前端相关代码都在这里

**工作原理：**

- **开发模式** (`coze dev`)：
  - 运行 `server/server.ts` 启动 Express 服务器
  - Vite 以 middleware 模式集成到 Express
  - 前端支持 HMR（热模块替换）
  - 后端 API 和前端在同一进程，端口 5000

- **生产模式** (`coze start`)：
  - `coze build` 构建前端 → `dist/` 目录
  - `coze build` 构建后端 → `dist-server/index.js` (CommonJS 格式)
  - 运行 `dist-server/index.js` 启动生产服务器
  - Express 服务静态文件 + API 路由
  - 单一 Node.js 进程，轻量高效

## 核心开发规范

### 1. 后端 API 开发

**添加新的 API 路由**

在 `server/routes/index.ts` 中添加路由：

```typescript
// GET 请求示例
router.get('/api/users', (req, res) => {
  res.json({
    users: [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ],
  });
});

// POST 请求示例
router.post('/api/users', (req, res) => {
  const userData = req.body;
  // 处理业务逻辑
  res.json({
    success: true,
    user: userData,
  });
});

// 动态路由参数
router.get('/api/users/:id', (req, res) => {
  const userId = req.params.id;
  res.json({
    id: userId,
    name: 'User ' + userId,
  });
});
```

**拆分路由模块**（推荐）

当路由变多时，可以按功能拆分：

```typescript
// server/routes/users.ts
import { Router } from 'express';

const router = Router();

router.get('/api/users', (req, res) => {
  // 用户列表逻辑
  res.json({ users: [] });
});

router.post('/api/users', (req, res) => {
  // 创建用户逻辑
  res.json({ success: true });
});

export default router;
```

然后在 `server/server.ts` 中注册：

```typescript
import usersRouter from './routes/users';

// 注册路由
app.use(usersRouter);
```

**前端调用 API**

```typescript
// GET 请求
async function getUsers() {
  const response = await fetch('/api/users');
  const data = await response.json();
  console.log(data);
}

// POST 请求
async function createUser(name: string) {
  const response = await fetch('/api/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });
  const data = await response.json();
  console.log(data);
}
```

**API 最佳实践**

- ✅ 所有 API 路由以 `/api` 开头，避免与前端路由冲突
- ✅ 使用 RESTful 设计：GET 查询、POST 创建、PUT 更新、DELETE 删除
- ✅ 返回统一的响应格式：`{ success: boolean, data?: any, error?: string }`
- ✅ 添加错误处理和参数验证

### 2. 样式开发

**使用 Tailwind CSS**

本项目使用 Tailwind CSS 进行样式开发，支持亮色/暗色模式自动切换。

```typescript
// 使用 Tailwind 工具类
app.innerHTML = `
  <div class="flex items-center justify-center min-h-screen bg-white dark:bg-black">
    <h1 class="text-4xl font-bold text-black dark:text-white">
      Hello World
    </h1>
  </div>
`;
```

**主题变量**

主题变量定义在 `src/index.css` 中，支持自动适配系统主题：

```css
:root {
  --background: #ffffff;
  --foreground: #171717;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
  }
}
```

**常用 Tailwind 类名**

- 布局：`flex`, `grid`, `container`, `mx-auto`
- 间距：`p-4`, `m-4`, `gap-4`, `space-x-4`
- 颜色：`bg-white`, `text-black`, `dark:bg-black`, `dark:text-white`
- 排版：`text-lg`, `font-bold`, `leading-8`, `tracking-tight`
- 响应式：`sm:`, `md:`, `lg:`, `xl:`

### 2. 依赖管理

**必须使用 pnpm 管理依赖**

```bash
# ✅ 安装依赖
pnpm install

# ✅ 添加新依赖
pnpm add package-name

# ✅ 添加开发依赖
pnpm add -D package-name

# ❌ 禁止使用 npm 或 yarn
# npm install  # 错误！
# yarn add     # 错误！
```

项目已配置 `preinstall` 脚本，使用其他包管理器会报错。

### 3. TypeScript 开发

**类型安全**

充分利用 TypeScript 的类型系统，确保代码质量：

```typescript
// 定义接口
interface User {
  id: number;
  name: string;
  email: string;
}

// 使用类型
function createUser(data: User): void {
  console.log(`Creating user: ${data.name}`);
}

// DOM 操作类型推断
const button = document.querySelector<HTMLButtonElement>('#my-button');
if (button) {
  button.addEventListener('click', () => {
    console.log('Button clicked');
  });
}
```

**避免 any 类型**

尽量避免使用 `any`，使用 `unknown` 或具体类型：

```typescript
// ❌ 不推荐
function process(data: any) { }

// ✅ 推荐
function process(data: unknown) {
  if (typeof data === 'string') {
    console.log(data.toUpperCase());
  }
}
```

## 常见开发场景

### 添加新页面

本项目是单页应用（SPA），如需多页面：

1. 在 `src/` 下创建新的 `.ts` 文件
2. 在 `vite.config.ts` 中配置多入口
3. 创建对应的 `.html` 文件

### DOM 操作

```typescript
// 获取元素
const app = document.getElementById('app');
const button = document.querySelector<HTMLButtonElement>('.my-button');

// 动态创建元素
const div = document.createElement('div');
div.className = 'flex items-center gap-4';
div.textContent = 'Hello World';
app?.appendChild(div);

// 事件监听
button?.addEventListener('click', (e) => {
  console.log('Clicked', e);
});
```

### 数据获取

```typescript
// Fetch API
async function fetchData() {
  try {
    const response = await fetch('https://api.example.com/data');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch data:', error);
  }
}

// 使用数据
fetchData().then(data => {
  console.log(data);
});
```

### 环境变量

在 `.env` 文件中定义环境变量（需以 `VITE_` 开头）：

```bash
VITE_API_URL=https://api.example.com
```

在代码中使用：

```typescript
const apiUrl = import.meta.env.VITE_API_URL;
console.log(apiUrl); // https://api.example.com
```

## 技术栈

**前端：**
- **构建工具**: Vite 7.x
- **语言**: TypeScript 5.x
- **样式**: Tailwind CSS 3.x

**后端：**
- **框架**: Express 4.x
- **内置中间件**: express.json(), express.urlencoded(), express.static()

**工具：**
- **包管理器**: pnpm 9+
- **运行时**: Node.js 18+
- **开发工具**: tsx (TypeScript 执行器)

## 参考文档

**前端：**
- [Vite 官方文档](https://cn.vitejs.dev/)
- [TypeScript 官方文档](https://www.typescriptlang.org/zh/docs/)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)

**后端：**
- [Express 官方文档](https://expressjs.com/)
- [Express 中文文档](https://expressjs.com/zh-cn/)

## 重要提示

1. **必须使用 pnpm** 作为包管理器
2. **使用 TypeScript** 进行类型安全开发，避免使用 `any`
3. **使用 Tailwind CSS** 进行样式开发，支持响应式和暗色模式
4. **环境变量必须以 `VITE_` 开头** 才能在客户端代码中访问
5. **开发时使用 `coze dev`**，支持热更新和快速刷新
6. **API 路由以 `/api` 开头**，避免与前端路由冲突
7. **单进程架构**：开发和生产环境都是前后端在同一进程中运行

## 常见问题

**Q: 如何分离前后端端口？**

如果需要前后端分离部署，可以：
- 前端：使用 `npx vite` 单独启动（默认端口 5173）
- 后端：修改 `server.ts`，移除 Vite middleware，单独启动

**Q: 如何添加数据库？**

```bash
# 安装数据库客户端（以 PostgreSQL 为例）
pnpm add pg
pnpm add -D @types/pg

# 在 server.ts 中使用
import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
```

**Q: 如何部署？**

1. 运行 `coze build` 构建前后端
2. 将整个项目上传到服务器
3. 运行 `pnpm install --prod`
4. 运行 `coze start` 启动服务
