# 项目上下文

## 技术栈

- **核心**: Vite 7, TypeScript (仅配置文件), Vanilla JS (应用代码)
- **UI**: 原生 HTML + CSS (Tailwind CSS 未使用, 纯手写样式)
- **音频**: 58 个 TTS MP3 文件 (male/female 两种发音) + 2 个 SFX 音效 (correct/wrong)
- **Service Worker**: 离线缓存支持

## 目录结构

```
├── scripts/            # 构建与工具脚本
│   ├── build.sh        # 构建脚本 (Vite build)
│   ├── dev.sh          # 开发环境启动脚本 (Vite dev server)
│   ├── prepare.sh      # 预处理脚本 (pnpm install)
│   ├── start.sh        # 生产环境启动脚本 (serve dist)
│   ├── validate.sh     # 验证脚本
│   ├── generate_audio.py  # 音频生成脚本 (Python)
│   └── verify-audio.mjs   # 音频验证脚本 (Node.js)
├── public/             # 静态资源
│   ├── audio/          # TTS 音频文件
│   │   ├── male/       # 男声 MP3 (29 个)
│   │   └── female/     # 女声 MP3 (29 个)
│   ├── sfx/            # 音效文件
│   │   ├── correct.mp3 # 正确选择音效
│   │   └── wrong.mp3   # 错误选择音效
│   └── sw.js           # Service Worker
├── tests/              # 测试文件
│   └── pilot.test.mjs  # 数据完整性测试 (7 个用例)
├── index.html          # 入口 HTML
├── styles.css          # 全局样式
├── app.js              # 主应用逻辑
├── data.js             # 课程数据 (30 个 drills, 每题含 distractor2)
├── package.json        # 项目依赖管理
└── vite.config.ts      # Vite 配置
```

## 包管理规范

**仅允许使用 pnpm** 作为包管理器, **严禁使用 npm 或 yarn**。
**常用命令**:
- 安装依赖: `pnpm install`
- 开发: `pnpm dev`
- 构建: `pnpm build`
- 测试: `pnpm test`
- 音频验证: `pnpm run verify:audio`

## 开发规范

- 使用原生 HTML + CSS, 不依赖 UI 框架
- 音频文件路径: `/audio/male/xxx.mp3` 和 `/audio/female/xxx.mp3`
- 音效文件路径: `/sfx/correct.mp3` 和 `/sfx/wrong.mp3`
- Service Worker 缓存策略: 网络优先, 缓存兜底
- 数据驱动: 所有练习内容在 `data.js` 中定义
- 每道题 3 个选项: 1 个正确答案 + 2 个干扰项 (distractor, distractor2)
- 2×2 网格布局, 题目卡片在左上角

### 编码规范

- 使用 ES Modules (`import`/`export`)
- 函数参数应有明确类型(通过 JSDoc 或 TypeScript)
- 避免全局变量, 使用模块作用域
- 音频路径通过 `data.js` 中的 `audioPath()` 函数生成
