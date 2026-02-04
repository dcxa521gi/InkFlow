
export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  options?: string[]; // Parsed suggested responses
  isSystemNotice?: boolean; // New: For displaying invoked MCP/Skills
}

export type AIProvider = 'google' | 'openai';

export interface MCPItem {
  id: string;
  name: string;
  content: string;
  isActive: boolean;
}

export interface SkillItem {
  id: string;
  name: string;
  content: string;
  isActive: boolean;
}

export interface AnchorConfig {
  enabled: boolean;
  mode: 'volume' | 'chapter';
  chapterInterval: 20 | 50; // Every 20 or 50 chapters
  nextTrigger: number; // The chapter number that triggers the next anchor
}

export interface SiteSettings {
  siteName: string;
  siteDescription: string;
  defaultFontSize: number; // 14 - 28
  contactQrCode?: string; // Base64 string for QR Code
}

export interface AppSettings {
  // Common
  provider: AIProvider;
  systemInstruction: string;
  
  // Google Gemini
  googleModel: string;
  temperature: number;
  topK: number;
  topP: number;
  thinkingBudget: number;

  // OpenAI
  openaiApiKey: string;
  openaiBaseUrl: string;
  openaiModel: string;
  
  // Generation Config
  maxOutputTokens: number;
  
  // Novel Constraints
  targetTotalChapters: number;
  targetWordsPerChapter: number;

  // Knowledge & Skills
  mcpItems: MCPItem[];
  skillItems: SkillItem[];

  // Site Configuration
  siteSettings: SiteSettings;
}

export enum ViewMode {
  Split = 'split',
  ChatOnly = 'chat',
  NovelOnly = 'novel'
}

export type NovelTab = 'dialogue' | 'settings' | 'database' | 'chapters';

export interface Chapter {
  id: string; // Unique ID for React keys
  messageId: string; // The ID of the message containing this chapter
  title: string;
  content: string; // The actual story text
  startIndex: number; // Start index in the message content
  endIndex: number; // End index in the message content
  wordCount: number;
}

export interface NovelState {
  title: string;
  outline: string;
  characters: string;
  chapters: Chapter[];
}

// New Interface for Library
export interface NovelSession {
  id: string;
  title: string; // Auto-synced title
  createdAt: number;
  lastModified: number;
  messages: Message[];
  settings: AppSettings;
  contextSummary?: string; // For "Segmented Anchoring" (分段锚定法) - stores the summary of previous volumes/chapters
  anchorConfig?: AnchorConfig; // Auto-anchor settings
  snowflakeMode?: boolean; // New: Snowflake method active state
}

export interface OptimizationState {
  isOpen: boolean;
  type: 'chapter' | 'selection';
  targetMessageId: string;
  originalContent: string; // The specific text being replaced
  newContent: string; // The AI generated text
  fullOriginalText: string; // The full text of the message (context)
  replaceRange?: { start: number, end: number }; // For selection replacement
}
