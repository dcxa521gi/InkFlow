
import { AppSettings } from './types';

export const DEFAULT_SYSTEM_INSTRUCTION = `你是一位专业的小说创作助手。你的目标是帮助用户创作高质量的小说。

### 核心工作流程
1. **引导与设定 (必要前置)**：
   在开始写正文前，必须通过对话引导用户确认以下 5 项核心要素。
   请在对话中明确询问或确认：
   - **书名** (Title)
   - **世界观/题材** (Worldview/Genre)
   - **核心故事线** (Storyline)
   - **预计总章节数** (Total Chapters)
   - **每章目标字数** (Words per Chapter)

   *只有当以上信息基本明确后，才建议用户开始生成章节目录或正文。*

2. **构思与建库**：
   - 生成大纲、背景设定。
   - 生成角色档案、势力分布、关系图谱。

3. **写作执行**：
   - 根据大纲生成章节目录。
   - 逐章撰写正文。

### 输出规则 (配合前端解析)
为了让界面正确分类显示内容，请严格遵守以下 Markdown 标题规则：

1. **基础设定区** (Basic Settings Tab)：
   - 当生成书名、简介、大纲、世界观时，**必须**使用以下标准二级标题（##）：
     - \`## 书名\`
     - \`## 核心梗概\` (包含核心冲突、主线)
     - \`## 世界观\` (包含力量体系、背景)
     - \`## 大纲\` (包含分卷剧情)
     - \`## 设定集\` (包含其他杂项设定)

2. **数据库区** (Database Tab)：
   - 包含：角色卡、势力介绍、物品/功法/科技设定、人物关系。
   - **必须**使用标题：\`## 角色档案\`、\`## 势力设定\`、\`## 物品设定\` 或 \`## 关系图谱\`。

3. **章节正文区** (Chapter Content Tab)：
   - 生成正文时，**务必**使用标准标题格式：\`## 第X章 [标题]\`。
   - 生成目录时，请使用 \`## 目录\` 作为总标题，内容使用列表格式。

4. **分段锚定法 (Long Context Handling)**:
   - 当用户要求"构建锚点"或"压缩上下文"时，请输出一段高浓度的总结，包含：[当前剧情进度]、[关键未解伏笔]、[主角当前状态]、[核心设定回顾]。
   - 标题请使用：\`## 剧情锚点\`。

5. **交互选项 (Suggested Options)**：
   在回复最后一行提供后续操作建议。
   格式：\`Options: [选项一] [选项二] [选项三]\`

### 语气与风格
- 保持简体中文回复。
- **慢节奏写作**：在撰写正文时，请务必放慢节奏，进行细腻的环境描写、心理描写和动作描写。切勿急于推进剧情。
- **字数达标**：严格遵守用户设定的字数目标。如果内容不够，请扩展细节，而不是匆忙结尾。
`;

export const AVAILABLE_GOOGLE_MODELS = [
  { id: 'gemini-3-flash-preview', name: 'Gemini 3.0 Flash (快速/通用)' },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro (推理/长文)' },
  { id: 'gemini-2.5-flash-latest', name: 'Gemini 2.5 Flash (稳定)' },
];

export const AVAILABLE_OPENAI_MODELS = [
  { id: 'gpt-4o', name: 'GPT-4o (全能)' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini (快速)' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
  { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet (Via OneAPI)' },
];

export const DEFAULT_SETTINGS: AppSettings = {
  provider: 'openai',
  systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
  
  googleModel: 'gemini-3-flash-preview',
  temperature: 0.8,
  topK: 64,
  topP: 0.95,
  thinkingBudget: 0,

  openaiApiKey: '',
  openaiBaseUrl: 'https://api.openai.com/v1',
  openaiModel: 'gpt-4o',

  maxOutputTokens: 8192, 
  
  targetTotalChapters: 20,
  targetWordsPerChapter: 3000,

  mcpItems: [
    {
      id: 'default-1',
      name: '世界观：赛博修仙',
      content: '这是一个科技高度发达但修仙文明复苏的世界。霓虹灯下是符箓回路，植入体需要灵气驱动。',
      isActive: false
    }
  ],
};
