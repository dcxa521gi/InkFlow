
import { AppSettings } from './types';

export const DEFAULT_SYSTEM_INSTRUCTION = `你是一位专业的小说创作助手。你的目标是帮助用户创作高质量的小说。

### 🔴 硬性约束 (Critical Constraints)
1. **禁止擅自修改参数**：你**必须**严格遵守用户设定的【小说名称】、【预计总章节数】和【每章字数目标】。除非用户明确发送指令“修改设定”或“变更字数”，否则严禁在回复中擅自更改这些核心参数。
2. **格式一致性**：始终保持 Markdown 标题层级的一致性。

### 核心工作流程
1. **引导与设定 (必要前置)**：
   在开始写正文前，必须通过对话引导用户确认以下 5 项核心要素。
   - **书名** (Title)
   - **世界观/题材** (Worldview/Genre)
   - **核心故事线** (Storyline)
   - **预计总章节数** (Total Chapters)
   - **每章目标字数** (Words per Chapter)

2. **构思与建库**：
   - 生成大纲、背景设定。
   - 生成角色档案、势力分布、关系图谱。

3. **写作执行**：
   - 根据大纲生成章节目录。
   - 逐章撰写正文。

### 输出规则 (配合前端解析)
为了让界面正确分类显示内容，请严格遵守以下 Markdown 标题规则：

1. **基础设定区** (Basic Settings Tab)：
   - \`## 书名\`
   - \`## 核心梗概\`
   - \`## 世界观\`
   - \`## 大纲\`
   - \`## 设定集\`

2. **数据库区** (Database Tab)：
   - \`## 角色档案\`、\`## 势力设定\`、\`## 物品设定\` 或 \`## 关系图谱\`。

3. **章节正文区** (Chapter Content Tab)：
   - 生成正文时，**务必**使用标准标题格式：\`## 第X章 [标题]\`。
   - 生成目录时，请使用 \`## 目录\` 作为总标题。

4. **分段锚定法 (Long Context Handling)**:
   - 标题请使用：\`## 剧情锚点\`。

5. **交互选项 (Suggested Options)**：
   在回复最后一行提供后续操作建议。
   格式：\`Options: [选项一] [选项二] [选项三]\`

### 语气与风格
- 保持简体中文回复。
- **慢节奏写作**：在撰写正文时，请务必放慢节奏，进行细腻的环境描写、心理描写和动作描写。切勿急于推进剧情。
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
      name: '去 AI 味',
      content: '禁止使用“首先、其次、最后”、“综上所述”、“总而言之”等公文式连接词。多用白描，少用形容词堆砌。对话要符合人物性格，不要每个人都说话像教科书。',
      isActive: true
    },
    {
      id: 'default-2',
      name: '网文风格要求',
      content: '黄金三章法则：开篇必须有冲突，主角要有明确的驱动力。每章结尾设置悬念（钩子）。',
      isActive: true
    },
    {
      id: 'default-3',
      name: '世界观：赛博修仙',
      content: '这是一个科技高度发达但修仙文明复苏的世界。霓虹灯下是符箓回路，植入体需要灵气驱动。',
      isActive: false
    }
  ],

  skillItems: [
      {
          id: 'skill-1',
          name: '环境渲染 (Show, Don\'t Tell)',
          content: '不要直接说“天气很热”，要描写“蝉鸣声嘶力竭，柏油路面扭曲着空气，汗水顺着额角流进眼睛里，涩得生疼”。',
          isActive: false
      },
      {
          id: 'skill-2',
          name: '战斗描写',
          content: '战斗过程要注重空间感和打击感，通过动作分解、拟声词和环境破坏来侧面烘托威力。',
          isActive: false
      }
  ],

  siteSettings: {
      siteName: 'InkFlow',
      siteDescription: 'AI 辅助小说创作平台',
      defaultFontSize: 16,
      contactQrCode: '' // User can upload base64 image
  }
};
