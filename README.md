
# InkFlow Novel Generator (AI 小说创作助手)

InkFlow 是一款基于 React 和 AI 大模型（OpenAI/Gemini）的现代化小说辅助创作工具。它采用独特的“对话+正文”分屏设计，结合了雪花写作法、剧情锚点和自动化长文生成技术，旨在帮助作者打破创作瓶颈，高效产出高质量网文。

## 🏠首页样式
<img width="2073" height="1118" alt="image" src="https://github.com/user-attachments/assets/b7ab13bf-082c-402f-b883-c497889adbfd" />
<img width="2074" height="1132" alt="ScreenShot_2026-02-05_120342_142" src="https://github.com/user-attachments/assets/d5c44ba0-d2de-43cf-9046-e3e8af929d4f" />
<img width="2061" height="1123" alt="image" src="https://github.com/user-attachments/assets/400a3006-1647-4210-b628-0ff535c7538c" />


## 🛰开发者微信
<img width="1657" height="857" alt="image" src="https://github.com/user-attachments/assets/d08474c3-4625-4793-ad77-43f1ca950a7f" />

## 🌟 核心特性

*   **分屏创作**：左侧与 AI 对话构思，右侧实时预览大纲、设定集和正文。
*   **组合写作法**：内置“雪花法 + 救猫咪节拍表”双重引擎，从一句话扩充为百万字大纲。
*   **剧情锚点 (Context Anchor)**：独创的分段锚定技术，解决 AI 长文遗忘问题，支持自动压缩上下文。
*   **批量生成**：一键生成完整目录，并支持连续批量撰写正文，严格遵守字数要求。
*   **沉浸式体验**：支持夜间模式，以及 TTS 语音朗读。
*   **知识库注入**：自定义 MCP 世界观和 SKILL 写作技能，确保 AI 风格统一。
*   **社群支持**：内置官方微信群引导，获取最新写作技巧与支持。

---

## 📜 版本历史 (Version History)

### v1.7.1（2026-02-06）- Latest
*   **核心修复与严格模式**：
    *   🐛 **修复编辑功能**：修复章节正文编辑后不保存的问题，优化实时字数统计。
    *   🛑 **严格字数执行**：强制 AI 严格遵守【每章字数】设定，误差控制在 500 字以内。
    *   🛡️ **设定保护**：修复了 AI 自动生成的目录章节数覆盖全局设置的问题。
    *   🧠 **知识库增强**：生成正文时，强制注入并遵守 MCP 知识库和 SKILL 技能要求。

### v1.7.0 (2026-02-05) - Latest
*   **社群与体验升级**：
    *   👥 **官方社群**：新增微信交流群入口，方便用户反馈。
    *   🎈 **新手引导**：新增首次使用全功能引导，帮助新用户快速上手。
    *   🎨 **界面精简**：移除冗余的显示设置，优化主题切换（仅保留明/暗）。
    *   💡 **灵感推荐**：对话框新增随机题材推荐组合，激发创作灵感。
    *   🖱️ **便捷操作**：右下角新增悬浮按钮，一键联系开发者。

### v1.6.0 (2026-02-04)
*   **交互优化**：
    *   右上角新增“雪花法”独立开关，一键切换高级引导模式。
    *   聊天气泡新增复制成功反馈。
    *   界面净化，移除聊天流中冗余的“注入上下文”提示。
*   **功能增强**：
    *   优化扩写指令，强制 AI 遵守“每章字数”限制。
    *   “剧情锚点”按钮增加状态显色，自动锚定触发时有更清晰的提示。
    *   **修复部署白屏问题**：修复了因读取旧版 LocalStorage 数据结构不兼容导致的运行时错误。

### v1.5.0 (2026-02-03)
*   **方法论升级**：引入“雪花写作法 + 救猫咪节拍表”组合逻辑。
*   **视觉升级**：全站字号升级（最小 16px）。

### v1.4.0 (2026-02-01)
*   **性能优化**：引入生成节流机制，降低内存占用。
*   **新功能**：SKILL 技能系统上线，支持自定义文风要求。

### v1.3.0 (2026-02-01)
*   **体验升级**：新增 TTS 语音朗读功能，支持语速调节。
*   **编辑功能**：支持对 AI 生成的章节正文进行直接编辑与保存。

### v1.2.0 (2026-01-30)
*   **书库管理**：新增多本书籍切换与管理，支持 LocalStorage 自动存档。

### v1.0.0 (2026-01-29)
*   基础发布，支持 OpenAI 接口与分屏视图。

---

## 📖 使用全教程 (User Guide)

### 1. 初始化与配置
*   打开网站，点击右上角的设置图标 <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>。
*   填写 **OpenAI API Key** 和 **Base URL** (支持 DeepSeek, Kimi, GPT-4 等)。
*   设定**预计总章节数**和**每章字数目标**（建议 2000-3000 字）。

### 2. 构思与大纲
*   **自由模式**：直接与 AI 对话，“我想写一个赛博修仙的故事”。
*   **雪花法模式**：点击顶部“❄️ 雪花法”按钮，AI 会引导你从一句话扩充到完整细纲。
*   AI 生成的内容会自动分类显示在右侧的“基础设定”和“数据库”标签页中。

### 3. 生成正文
*   切换到右侧“章节正文”标签页。
*   点击底部的 **“+X章 目录”**，让 AI 生成章节列表。
*   有了目录后，点击 **“写X章”**，AI 将开始自动批量撰写正文。
*   *提示：撰写过程中请勿关闭页面。*

### 4. 优化与修缮
*   **局部润色**：在正文中选中一段文字，点击悬浮的“✨ 润色”按钮。
*   **全章重写**：点击章节标题栏的“🔄 重写”或“✨ 优化”按钮。
*   **手动编辑**：点击编辑图标进入沉浸式编辑模式，修改后保存。

### 5. 剧情锚点（解决遗忘）
*   当对话过长（超过 50 条）时，建议点击顶部的“⚓ 剧情锚点”。
*   系统会将前文剧情总结为一个高浓度的“记忆包”，释放上下文空间，确保 AI 不会写崩。
*   可在弹窗中开启“自动锚定”，设置每写 20 章自动执行一次。

---

## 🚀 宝塔面板部署详细操作 (Deployment Guide)

**注意：** 本项目是一个 **React 前端项目**，**不能**直接上传源码运行。必须在本地或服务器上通过 Node.js 进行编译（Build），生成静态文件后才能部署。

### 准备工作
1.  确保本地已安装 **Node.js** (推荐 v18+)。
2.  准备好本项目的源码文件。

### 第一步：确认构建配置
本项目已包含构建所需的配置文件（`package.json`, `vite.config.ts`, `tsconfig.json`）。请确保根目录下存在这些文件。

**关键配置说明 (Reference)**：
若您需要手动修改，请重点关注 `vite.config.ts` 中的 `base` 配置，这决定了静态资源能否在宝塔子目录下正常加载。

**1. `package.json`**
```json
{
  "name": "inkflow-novel-gen",
  "version": "1.7.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@google/genai": "^0.1.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-markdown": "^9.0.1",
    "remark-breaks": "^4.0.0",
    "remark-gfm": "^4.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.3",
    "vite": "^5.4.1"
  }
}
```

**2. `vite.config.ts`**
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // 关键配置：确保资源使用相对路径，适配宝塔/静态托管
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
});
```

**3. `tsconfig.json`**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

### 第二步：安装依赖并编译
在项目根目录打开终端（Terminal），执行：

```bash
# 1. 安装依赖
npm install

# 2. 执行编译
npm run build
```

执行完成后，目录下会生成一个 **`dist`** 文件夹。这个文件夹里的内容就是我们要部署的最终文件。

### 第三步：宝塔面板部署
1.  **登录宝塔面板** -> 点击左侧 **“网站”** -> **“添加站点”**。
2.  填写域名（或 IP），提交。
3.  点击根目录进入文件管理。
4.  **上传文件**：将本地 **`dist`** 文件夹内的**所有文件**（包含 index.html, assets 文件夹等）上传到服务器的网站根目录。
    *   *注意：是上传 dist 里面的内容，不是上传 dist 文件夹本身。*
5.  **访问网站**：在浏览器输入域名即可访问。

### 常见问题排查 (Troubleshooting)
*   **网页白屏/打不开**：
    *   **检查1（数据兼容性）**：按 F12 打开控制台 (Console)，如果看到 `Cannot read properties of undefined`，说明旧版本数据导致崩溃。
        *   **解决方法**：在控制台输入 `localStorage.clear()` 并回车，然后刷新页面即可修复。（v1.6.0+ 已修复此问题）。
    *   **检查2（Nginx配置）**：如果刷新页面出现 404，通常是因为 React 单页应用需要伪静态支持。请在 Nginx 配置文件中添加：
    ```nginx
    location / {
      try_files $uri $uri/ /index.html;
    }
    ```
*   **二维码不显示**：
    *   请确保将您的二维码图片命名为 `weixin.jpg` 并放置在构建后的 `images/` 目录下（如果使用 Vite 默认配置，请放在源码的 `public/images/` 中）。

---

**InkFlow Team**
Contact: lyjhxf@126.com
