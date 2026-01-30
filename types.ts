
export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  options?: string[]; // Parsed suggested responses
}

export type AIProvider = 'google' | 'openai';

export interface MCPItem {
  id: string;
  name: string;
  content: string;
  isActive: boolean;
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

  // MCP / Knowledge Base
  mcpItems: MCPItem[];
}

export enum ViewMode {
  Split = 'split',
  ChatOnly = 'chat',
  NovelOnly = 'novel'
}

export type NovelTab = 'dialogue' | 'settings' | 'database' | 'chapters';

export interface Chapter {
  id: string;
  title: string;
  content: string; // The actual story text
  outline?: string; // Brief summary
  status: 'draft' | 'generated' | 'empty';
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
}
