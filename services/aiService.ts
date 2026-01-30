import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { AppSettings, Message } from "../types";

// --- Helpers ---

// Construct the final system instruction by appending active MCP items
const buildSystemInstruction = (settings: AppSettings): string => {
  let instruction = settings.systemInstruction;
  
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

// --- Google Gemini Implementation ---
const createGeminiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const generateGeminiStream = async (
  history: Message[],
  currentMessage: string, // Redundant if history contains it, but kept for signature compatibility
  settings: AppSettings,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<string> => {
  const ai = createGeminiClient();
  
  // Gemini expects history to be the CONTEXT (past messages).
  // The trigger message is sent via sendMessageStream.
  // Since 'history' passed here includes the latest user message, we separate them.
  const pastHistory = history.slice(0, -1);
  const lastMessage = history[history.length - 1];

  const chatHistory = pastHistory.map(msg => ({
    role: msg.role,
    parts: [{ text: msg.content }]
  }));

  const chat = ai.chats.create({
    model: settings.googleModel,
    history: chatHistory,
    config: {
      systemInstruction: buildSystemInstruction(settings),
      temperature: settings.temperature,
      topK: settings.topK,
      topP: settings.topP,
      maxOutputTokens: settings.maxOutputTokens, 
      thinkingConfig: settings.thinkingBudget > 0 ? { thinkingBudget: settings.thinkingBudget } : undefined,
    },
  });

  try {
    // Use the content from the last message in the history array as the prompt
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
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<string> => {
  if (!settings.openaiApiKey) {
    throw new Error("请在设置中配置 OpenAI API Key");
  }

  // OpenAI expects the full conversation including the latest message.
  // CRITICAL FIX: Map 'model' role to 'assistant' for OpenAI compatibility
  const messages = [
    { role: "system", content: buildSystemInstruction(settings) },
    ...history.map(m => ({ 
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
        // More robust check for "data:" prefix (handles potential missing space)
        if (!trimmed.startsWith("data:")) continue;
        
        const dataStr = trimmed.slice(5).trim();
        if (dataStr === "[DONE]") continue;

        try {
          const json = JSON.parse(dataStr);
          const delta = json.choices?.[0]?.delta;
          // Check for content or reasoning_content (for DeepSeek R1 etc compatibility)
          const content = delta?.content || delta?.reasoning_content || "";
          
          if (content) {
            fullText += content;
            onChunk(content);
          }
        } catch (e) {
          // Ignore parse errors for incomplete chunks
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
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<string> => {
  if (settings.provider === 'openai') {
    return generateOpenAIStream(history, currentMessage, settings, onChunk, signal);
  } else {
    return generateGeminiStream(history, currentMessage, settings, onChunk, signal);
  }
};