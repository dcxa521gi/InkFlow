
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { AppSettings, Message, NovelSession } from "../types";

// --- Helpers ---

// Construct the final system instruction by appending active MCP items and Anchored Context
const buildSystemInstruction = (settings: AppSettings, contextSummary?: string): string => {
  let instruction = settings.systemInstruction;
  
  // Inject Segmented Anchor if exists
  if (contextSummary) {
      instruction += `\n\n=== 剧情锚点 (Archive Context) ===\n这是前文的剧情与设定浓缩总结。请基于此继续创作，无需重复之前的内容。\n${contextSummary}\n=== 锚点结束 ===\n`;
  }

  const activeMCPs = settings.mcpItems.filter(item => item.isActive);
  if (activeMCPs.length > 0) {
    instruction += "\n\n=== MCP 知识库/上下文 (Knowledge Base) ===\n";
    activeMCPs.forEach(item => {
      instruction += `\n[${item.name}]:\n${item.content}\n`;
    });
    instruction += "\n=== 请在创作时参考以上资料 ===\n";
  }
  
  return instruction;
};

// Helper to filter history if anchor exists
const getHistoryForAI = (history: Message[], contextSummary?: string): Message[] => {
    if (!contextSummary) return history;
    
    // If we have an anchor, we assume older history is summarized.
    // We only need the System Instruction (containing summary) + Recent Context.
    // Keep last 6 messages to maintain immediate flow.
    const recentCount = 6;
    if (history.length <= recentCount) return history;
    
    return history.slice(-recentCount);
};


// --- Google Gemini Implementation ---
const createGeminiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const generateGeminiStream = async (
  history: Message[],
  currentMessage: string, 
  settings: AppSettings,
  contextSummary: string | undefined,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<string> => {
  const ai = createGeminiClient();
  
  // Apply Anchor Logic: Truncate history if summary exists
  const effectiveHistory = getHistoryForAI(history, contextSummary);
  
  const pastHistory = effectiveHistory.slice(0, -1);
  const lastMessage = effectiveHistory[effectiveHistory.length - 1];

  const chatHistory = pastHistory.map(msg => ({
    role: msg.role,
    parts: [{ text: msg.content }]
  }));

  const chat = ai.chats.create({
    model: settings.googleModel,
    history: chatHistory,
    config: {
      systemInstruction: buildSystemInstruction(settings, contextSummary),
      temperature: settings.temperature,
      topK: settings.topK,
      topP: settings.topP,
      maxOutputTokens: settings.maxOutputTokens, 
      thinkingConfig: settings.thinkingBudget > 0 ? { thinkingBudget: settings.thinkingBudget } : undefined,
    },
  });

  try {
    const prompt = lastMessage?.content || currentMessage;
    const resultStream = await chat.sendMessageStream({ message: prompt });
    
    let fullText = "";
    for await (const chunk of resultStream) {
      if (signal?.aborted) {
        break;
      }
      const c = chunk as GenerateContentResponse;
      const text = c.text;
      if (text) {
        fullText += text;
        onChunk(text);
      }
    }
    return fullText;
  } catch (error) {
    if (signal?.aborted) return "";
    console.error("Gemini API Error:", error);
    throw error;
  }
};

// --- OpenAI Implementation ---
const generateOpenAIStream = async (
  history: Message[],
  currentMessage: string,
  settings: AppSettings,
  contextSummary: string | undefined,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<string> => {
  if (!settings.openaiApiKey) {
    throw new Error("请在设置中配置 OpenAI API Key");
  }

  // Apply Anchor Logic: Truncate history if summary exists
  const effectiveHistory = getHistoryForAI(history, contextSummary);

  const messages = [
    { role: "system", content: buildSystemInstruction(settings, contextSummary) },
    ...effectiveHistory.map(m => ({ 
      role: m.role === 'model' ? 'assistant' : 'user', 
      content: m.content 
    }))
  ];

  const response = await fetch(`${settings.openaiBaseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${settings.openaiApiKey}`
    },
    body: JSON.stringify({
      model: settings.openaiModel,
      messages: messages,
      temperature: settings.temperature,
      top_p: settings.topP,
      max_tokens: settings.maxOutputTokens,
      stream: true
    }),
    signal: signal
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `OpenAI request failed with status ${response.status}`);
  }

  if (!response.body) throw new Error("No response body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let fullText = "";
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (signal?.aborted) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        
        const dataStr = trimmed.slice(5).trim();
        if (dataStr === "[DONE]") continue;

        try {
          const json = JSON.parse(dataStr);
          const delta = json.choices?.[0]?.delta;
          const content = delta?.content || delta?.reasoning_content || "";
          
          if (content) {
            fullText += content;
            onChunk(content);
          }
        } catch (e) {
        }
      }
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return fullText;
    }
    throw err;
  }

  return fullText;
};

// --- Unified Export ---

export const generateStreamResponse = async (
  history: Message[],
  currentMessage: string,
  settings: AppSettings,
  contextSummary: string | undefined,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<string> => {
  if (settings.provider === 'openai') {
    return generateOpenAIStream(history, currentMessage, settings, contextSummary, onChunk, signal);
  } else {
    return generateGeminiStream(history, currentMessage, settings, contextSummary, onChunk, signal);
  }
};
