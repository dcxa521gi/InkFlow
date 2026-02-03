
import React, { useState, useEffect, useRef, useMemo } from 'react';
import ChatArea from './components/ChatArea';
import NovelView from './components/NovelView';
import SettingsModal from './components/SettingsModal';
import LibraryModal from './components/LibraryModal';
import ComparisonModal from './components/ComparisonModal';
import AnchorModal from './components/AnchorModal';
import { generateStreamResponse } from './services/aiService';
import { Message, AppSettings, ViewMode, NovelSession, OptimizationState, AnchorConfig } from './types';
import { DEFAULT_SETTINGS } from './constants';
import { SettingsIcon, BookOpenIcon, MessageSquareIcon, MailIcon, SunIcon, MoonIcon, EyeIcon, XIcon, LibraryIcon, HelpCircleIcon, HistoryIcon, EditIcon, SparklesIcon, SpeakerIcon } from './components/Icons';

// Helper to clean titles
const cleanTitle = (rawTitle: string) => {
    return rawTitle
        .replace(/^[#*\s>]+/, '') 
        .replace(/[#*]+$/, '')     
        .replace(/^\d+\.\s*/, '')  
        .trim();
};

// Helper to remove Options tags from AI response
const cleanAIResponse = (text: string) => {
    return text.replace(/(?:^|\n)\s*(?:\*\*|__)?Options(?:\*\*|__)?[:：][\s\S]*$/i, '').trim();
};

// Helper to create a default novel session
const createDefaultNovel = (): NovelSession => ({
  id: Date.now().toString(),
  title: '未命名小说',
  createdAt: Date.now(),
  lastModified: Date.now(),
  messages: [{
    id: 'init-1',
    role: 'model',
    content: '你好！我是你的 AI 小说创作助手。\n\n我们将分三步完成创作：\n1. **确认基础设定**（书名、题材、故事线）。\n2. **生成数据库**（大纲、角色）。\n3. **生成正文**。\n\n请告诉我你想写什么类型的故事？\n\nOptions: [玄幻修仙] [赛博朋克] [都市异能]',
    timestamp: Date.now()
  }],
  settings: { ...DEFAULT_SETTINGS },
  anchorConfig: { enabled: false, mode: 'chapter', chapterInterval: 20, nextTrigger: 20 }
});

// Toast Component
interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

function App() {
  const [novels, setNovels] = useState<NovelSession[]>(() => {
    try {
        const library = localStorage.getItem('inkflow_library');
        if (library) {
            const parsed = JSON.parse(library);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
        const oldMessages = localStorage.getItem('inkflow_messages');
        const oldSettings = localStorage.getItem('inkflow_settings');
        if (oldMessages) {
            const msgs = JSON.parse(oldMessages);
            let title = '未命名小说';
            const titleMatch = msgs.find((m: Message) => m.role === 'model' && m.content.match(/小说名[:：]\s*《?([^》\n]+)》?/));
            if (titleMatch) {
                const m = titleMatch.content.match(/小说名[:：]\s*《?([^》\n]+)》?/);
                if (m && m[1]) title = cleanTitle(m[1]);
            }
            const initialNovel: NovelSession = {
                id: 'default-' + Date.now(),
                title: title,
                createdAt: Date.now(),
                lastModified: Date.now(),
                messages: msgs,
                settings: oldSettings ? JSON.parse(oldSettings) : DEFAULT_SETTINGS,
                anchorConfig: { enabled: false, mode: 'chapter', chapterInterval: 20, nextTrigger: 20 }
            };
            return [initialNovel];
        }
        return [createDefaultNovel()];
    } catch (e) {
        console.error("Failed to load library", e);
        return [createDefaultNovel()];
    }
  });

  const [currentNovelId, setCurrentNovelId] = useState<string>(() => {
      try {
        const library = localStorage.getItem('inkflow_library');
        if (library) {
            const parsed = JSON.parse(library);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed[0].id;
        }
      } catch {}
      return '';
  });

  useEffect(() => {
      if (novels.length === 0) setNovels([createDefaultNovel()]);
      else if (!currentNovelId && novels.length > 0) setCurrentNovelId(novels[0].id);
  }, [novels, currentNovelId]);

  const activeNovel = useMemo(() => novels.find(n => n.id === currentNovelId) || novels[0], [novels, currentNovelId]);
  const messages = activeNovel?.messages || [];
  const settings = activeNovel?.settings || DEFAULT_SETTINGS;

  // Dynamic Document Title Logic
  const [isStreaming, setIsStreaming] = useState(false);
  
  useEffect(() => {
      const baseTitle = "InkFlow";
      const currentTitle = activeNovel?.title;
      const isDefault = !currentTitle || currentTitle === '未命名小说';
      
      if (isDefault) {
          document.title = isStreaming ? `生成中... - ${baseTitle}` : baseTitle;
      } else {
          const status = isStreaming ? '生成中' : '创作中';
          document.title = `${currentTitle} - ${status} - ${baseTitle}`;
      }
  }, [activeNovel?.title, isStreaming]);

  const [inputValue, setInputValue] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Theme state: 'light' | 'eye-care' | 'dark'
  const [theme, setTheme] = useState<'light' | 'eye-care' | 'dark'>(() => {
    try { 
        return (localStorage.getItem('inkflow_theme') as any) || 'dark'; 
    } catch { return 'dark'; }
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isVersionOpen, setIsVersionOpen] = useState(false);
  const [isAnchorModalOpen, setIsAnchorModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Split);
  const [optState, setOptState] = useState<OptimizationState | null>(null);

  // Toast State
  const [toasts, setToasts] = useState<Toast[]>([]);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
      const id = Date.now();
      setToasts(prev => [...prev, { id, message, type }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  useEffect(() => { if (novels.length > 0) localStorage.setItem('inkflow_library', JSON.stringify(novels)); }, [novels]);
  
  // Apply theme classes
  useEffect(() => { 
      localStorage.setItem('inkflow_theme', theme); 
      const html = document.documentElement;
      html.classList.remove('dark', 'light', 'ec'); 
      
      if (theme === 'dark') {
          html.classList.add('dark');
      } else if (theme === 'eye-care') {
           html.classList.add('ec');
      }
      // 'light' is default (no class)
  }, [theme]);

  if (!activeNovel) return null;

  const toggleTheme = () => {
      if (theme === 'light') setTheme('eye-care');
      else if (theme === 'eye-care') setTheme('dark');
      else setTheme('light');
  };

  const createNewNovel = () => {
      const newNovel = createDefaultNovel();
      newNovel.id = Date.now().toString(); 
      setNovels(prev => [newNovel, ...prev]);
      setCurrentNovelId(newNovel.id);
      setIsLibraryOpen(false);
      return newNovel.id;
  };

  const deleteNovel = (id: string) => {
      const newNovels = novels.filter(n => n.id !== id);
      setNovels(newNovels); 
      if (currentNovelId === id) {
          if (newNovels.length > 0) setCurrentNovelId(newNovels[0].id);
          else { const def = createDefaultNovel(); setNovels([def]); setCurrentNovelId(def.id); }
      }
  };

  const renameNovel = (id: string, newTitle: string) => {
      setNovels(prev => prev.map(n => n.id === id ? { ...n, title: cleanTitle(newTitle), lastModified: Date.now() } : n));
  };

  const updateActiveNovel = (updates: Partial<NovelSession>) => {
      if (!activeNovel) return;
      setNovels(prev => prev.map(n => n.id === activeNovel.id ? { ...n, ...updates, lastModified: Date.now() } : n));
  };

  const updateMessages = (newMessages: Message[]) => {
      updateActiveNovel({ messages: newMessages });
      if (newMessages.length > 0) parseChatForConfig(newMessages[newMessages.length - 1].content);
  };
  
  const updateSettings = (newSettings: AppSettings) => { updateActiveNovel({ settings: newSettings }); };

  // --- Logic for Anchor ---

  // Generalized Anchor execution function
  const executeAnchor = async (currentHistory: Message[] = messages, silent: boolean = false): Promise<Message[]> => {
      if (isStreaming && !silent) {
          showToast("AI 正在生成中，请稍后再试", "error");
          return currentHistory;
      }
      
      if (!silent) showToast("正在启动剧情锚定程序...", "info");

      setIsStreaming(true);
      const prompt = `【系统指令：分段锚定/卷末总结】
请对截止目前的小说内容进行“分段锚定”处理。我们将把长篇小说按“卷”或“单元”进行切割。
请生成一份高浓度的【剧情锚点】，用于作为下一卷的启动上下文。

请严格包含以下模块：
1. **卷末剧情总结**：简要概括当前这一卷/单元的核心剧情发生了什么，结局如何。
2. **核心锚点 (State)**：
   - 主角当前的物理状态（位置、等级、持有物）。
   - 主角当前的人际关系（盟友、敌人、待解决的羁绊）。
3. **关键未解伏笔**：下一卷必须要处理的剧情线索。
4. **衔接段**：一小段用于开启下一卷的“前情提要”，确保语气和文风连贯。

请以 \`## 剧情锚点\` 开头输出。`;

      const anchorMsgId = 'anchor-req-' + Date.now();
      const userMsg: Message = { id: anchorMsgId, role: 'user', content: prompt, timestamp: Date.now() };
      let tempHistory = [...currentHistory, userMsg];
      
      const aiMsgId = 'anchor-res-' + Date.now();
      const placeholder: Message = { id: aiMsgId, role: 'model', content: '', timestamp: Date.now() + 1 };
      
      // Update UI to show anchor process
      updateMessages([...tempHistory, placeholder]);

      try {
          let summary = "";
          await generateStreamResponse(tempHistory, prompt, settings, activeNovel.contextSummary, (chunk) => {
              summary += chunk;
              setNovels(prev => prev.map(n => {
                  if (n.id === activeNovel.id) {
                      const newMsgs = [...n.messages];
                      const idx = newMsgs.findIndex(m => m.id === aiMsgId);
                      if (idx !== -1) newMsgs[idx] = { ...newMsgs[idx], content: summary };
                      return { ...n, messages: newMsgs };
                  }
                  return n;
              }));
          });
          
          const finalSummary = cleanAIResponse(summary);
          
          const systemNotice: Message = {
              id: 'sys-notice-' + Date.now(),
              role: 'model',
              content: `✅ **锚点构建成功 (分段锚定完成)**\n\n历史剧情已归档到 AI 记忆中。历史消息已保留在界面上，但 AI 将仅关注最新的剧情锚点和后续内容，以节省 Token 并保持逻辑连贯。\n\n**当前锚点摘要：**\n${finalSummary.slice(0, 100)}...`,
              timestamp: Date.now()
          };
          
          const finalMessages = [...currentHistory, userMsg, { ...placeholder, content: finalSummary }, systemNotice];
          
          // Update the session state
          setNovels(prev => prev.map(n => n.id === activeNovel.id ? { ...n, messages: finalMessages, contextSummary: finalSummary, lastModified: Date.now() } : n));
          
          if (!silent) showToast("剧情锚点构建成功！历史记录已保留。", "success");
          return finalMessages;

      } catch (e) {
          console.error("Anchoring failed", e);
          if (!silent) showToast("锚点构建失败，请检查网络", "error");
          // Revert visual changes if needed, or just leave error state
          return currentHistory;
      } finally {
          setIsStreaming(false);
      }
  };

  const handleAnchorClick = () => {
      setIsAnchorModalOpen(true);
  };

  const parseChatForConfig = (content: string) => {
      const titleRegex = /(?:书名|小说名)[:：]\s*《?([^》\n]+)》?/;
      const titleMatch = content.match(titleRegex);
      if (titleMatch && titleMatch[1]) {
          const rawTitle = titleMatch[1];
          if (!rawTitle.includes('Options') && rawTitle.length < 30) {
            const clean = cleanTitle(rawTitle);
            if (clean && clean !== activeNovel.title) updateActiveNovel({ title: clean });
          }
      }
      const chapMatch = content.match(/(?:预计|计划|共|Total|写|target|chapters|规划|设定为|包含)\D{0,10}?(\d+)\s*章/i);
      if (chapMatch && chapMatch[1]) {
          const num = parseInt(chapMatch[1]);
          if (num > 0 && num !== settings.targetTotalChapters) updateSettings({ ...settings, targetTotalChapters: num });
      }
      const wordMatch = content.match(/(?:每章|单章|字数|words|设定为|字数目标)\D{0,10}?(\d+)\s*字/i);
      if (wordMatch && wordMatch[1]) {
          const num = parseInt(wordMatch[1]);
           if (num > 0 && num !== settings.targetWordsPerChapter) updateSettings({ ...settings, targetWordsPerChapter: num });
      }
  };

  const novelStats = useMemo(() => {
      let currentChapters = 0;
      let totalWordCount = 0;
      messages.filter(m => m.role === 'model').forEach(m => {
           const matches = m.content.matchAll(/(^|\n)##\s*(第[0-9一二三四五六七八九十]+章\s*[^\n]*)([\s\S]*?)(?=(\n##\s*第|$))/g);
           for (const match of matches) {
               currentChapters++;
               const chapterContent = match[3] || '';
               totalWordCount += chapterContent.replace(/[#*`\s]/g, '').length; 
           }
      });
      return { currentChapters, totalChapters: settings.targetTotalChapters || 20, wordCount: totalWordCount };
  }, [messages, settings.targetTotalChapters]);

  const sendMessage = async (text: string, currentHistory: Message[] = messages) => {
    if (!activeNovel.contextSummary && currentHistory.length > 50) {
        showToast("检测到对话过长，建议点击【剧情锚点】压缩上下文，避免遗忘。", "info");
    }

    setIsStreaming(true);
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now() };
    const updatedHistory = [...currentHistory, userMsg];
    updateMessages(updatedHistory);
    setInputValue(''); 

    const aiMsgId = (Date.now() + 1).toString();
    const aiMsgPlaceholder: Message = { id: aiMsgId, role: 'model', content: '', timestamp: Date.now() + 1 };
    updateMessages([...updatedHistory, aiMsgPlaceholder]);

    try {
      let fullResponseText = '';
      await generateStreamResponse(updatedHistory, userMsg.content, settings, activeNovel.contextSummary, (chunk) => {
          fullResponseText += chunk;
          setNovels(prevNovels => {
              return prevNovels.map(n => {
                  if (n.id === activeNovel.id) {
                      const newMsgs = [...n.messages];
                      const lastMsgIndex = newMsgs.findIndex(m => m.id === aiMsgId);
                      if (lastMsgIndex !== -1) newMsgs[lastMsgIndex] = { ...newMsgs[lastMsgIndex], content: fullResponseText };
                      return { ...n, messages: newMsgs, lastModified: Date.now() };
                  }
                  return n;
              });
          });
        }, signal);
      parseChatForConfig(fullResponseText);
      return fullResponseText;
    } catch (error: any) {
      if (error.name !== 'AbortError') {
          console.error(error);
          setNovels(prev => prev.map(n => {
              if (n.id === activeNovel.id) {
                  return { ...n, messages: [...n.messages, { id: Date.now().toString(), role: 'model', content: `⚠️ Error: ${error?.message || 'Unknown error'}`, timestamp: Date.now() }] };
              }
              return n;
          }));
      }
      throw error;
    } finally {
      if (!abortControllerRef.current?.signal.aborted) setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value);

  const handleUserSend = (text?: string) => {
      if (isStreaming) return;
      const content = text || inputValue;
      if (!content.trim()) return;

      if (content === '继续写下一章') { handleBatchContent(1); return; }
      if (content === '重写本章') {
           const lastModelMsg = messages[messages.length - 1];
           if (lastModelMsg.role === 'model' && lastModelMsg.content.includes('## 第')) {
               const titleMatch = lastModelMsg.content.match(/##\s*(第[^\s]+章\s*[^\n]*)/);
               if (titleMatch) { handleChapterAction('regenerate', titleMatch[1], lastModelMsg.content, lastModelMsg.id); return; }
           }
      }
      sendMessage(content);
  };

  const handleStop = () => { if (abortControllerRef.current) { abortControllerRef.current.abort(); setIsStreaming(false); } };

  const handleMessageEdit = (id: string, newContent: string) => {
      const newMessages = messages.map(m => m.id === id ? { ...m, content: newContent } : m);
      updateMessages(newMessages);
  };

  const handleSummarize = async () => {
      if (isStreaming) return;
      await sendMessage("请简要总结之前的对话内容，包含已确定的核心设定、故事进展以及当前待解决的问题。");
  };
  
  const handleDeconstructNovel = async (input: string) => {
      const newId = createNewNovel();
      const tempTitle = input.startsWith('http') ? '小说拆解分析' : `拆解：${cleanTitle(input)}`;
      renameNovel(newId, tempTitle);
      const analysisPrompt = `我希望你帮我拆解分析这本小说：${input}。\n\n重要提示：\n1. 作为一个 AI 模型，你无法直接访问互联网链接。\n2. 如果用户提供的是链接 (URL)，请尝试根据链接中的关键词（如书名拼音、ID）判断是哪本书。如果你知道这本书（如果是知名小说），请直接基于你的知识库进行分析。\n3. 如果你无法识别该链接或不认识这本书，请直接告诉用户：“我无法访问该链接，也不认识这本书，请您提供该书的简介或开头正文，我将为您分析。” 并停止后续生成。\n\n如果这本是你知道的书，请分析它的：\n1. 题材类型与核心爽点\n2. 主角人设与金手指\n3. 读者画像与文风特点（例如：番茄快节奏、起点慢热逻辑严密等）\n4. 典型的开篇套路\n\n分析完成后，请基于这种风格，为我创建一个新的小说大纲。请先给出分析结果。`;
      const initialMsg: Message = { id: Date.now().toString(), role: 'user', content: analysisPrompt, timestamp: Date.now() };
      setNovels(prev => prev.map(n => n.id === newId ? { ...n, messages: [initialMsg], title: tempTitle } : n));
      setTimeout(() => {
          setCurrentNovelId(newId);
          setIsStreaming(true);
          abortControllerRef.current = new AbortController();
          const aiMsgId = (Date.now() + 1).toString();
          const placeholder: Message = { id: aiMsgId, role: 'model', content: '', timestamp: Date.now() + 1 };
           setNovels(currentNovels => currentNovels.map(n => n.id === newId ? { ...n, messages: [initialMsg, placeholder] } : n));
           generateStreamResponse([initialMsg], initialMsg.content, DEFAULT_SETTINGS, undefined, (chunk) => {
                setNovels(prev => prev.map(n => {
                    if (n.id === newId) {
                        const newMsgs = [...n.messages];
                        newMsgs[newMsgs.length-1].content += chunk;
                        return { ...n, messages: newMsgs };
                    }
                    return n;
                }));
           }, abortControllerRef.current.signal).then(t => setIsStreaming(false));
       }, 100);
  };
  
  const handleDownloadAll = () => { /* ... */ };

  const handleChapterAction = async (action: 'optimize' | 'regenerate' | 'analyze', chapterTitle: string, content: string, messageId: string) => {
      if (isStreaming) return;
      if (action === 'analyze') { await sendMessage(`请分析以下章节：${chapterTitle}...\n${content}`); return; }
      const prompt = action === 'optimize' ? `请优化润色以下章节：${chapterTitle}...\n${content}` : `请完全重写这一章：${chapterTitle}...\n【要求】字数目标：**${settings.targetWordsPerChapter} 字**以上...`;
      await executeOptimization(prompt, content, messageId, 'chapter');
  };

  const handleTextSelectionOptimize = async (text: string, fullContext: string, messageId: string) => {
      if (isStreaming) return;
      const prompt = `请优化润色以下选中的段落...\n${text}\n...`;
      await executeOptimization(prompt, text, messageId, 'selection');
  };

  const executeOptimization = async (prompt: string, originalContent: string, messageId: string, type: 'chapter' | 'selection') => {
      setIsStreaming(true);
      abortControllerRef.current = new AbortController();
      setOptState({ isOpen: true, type, targetMessageId: messageId, originalContent, newContent: '', fullOriginalText: messages.find(m => m.id === messageId)?.content || '' });
      try {
          const tempHistory = [...messages, { id: 'temp', role: 'user' as const, content: prompt, timestamp: Date.now() }];
          let generatedText = '';
          await generateStreamResponse(tempHistory, prompt, settings, activeNovel.contextSummary, (chunk) => {
              generatedText += chunk;
              setOptState(prev => prev ? { ...prev, newContent: generatedText } : null);
          }, abortControllerRef.current.signal);
          const cleanText = cleanAIResponse(generatedText);
          setOptState(prev => prev ? { ...prev, newContent: cleanText } : null);
      } catch (e: any) { /*...*/ } finally { setIsStreaming(false); abortControllerRef.current = null; }
  };

  const handleConfirmOptimization = (finalContent: string) => { 
     if (!optState) return;
     const { targetMessageId, originalContent, type, fullOriginalText } = optState;
     let newFullContent = fullOriginalText;
     if (type === 'chapter') {
         if (fullOriginalText.includes(originalContent)) newFullContent = fullOriginalText.replace(originalContent, finalContent);
         else newFullContent = finalContent;
     } else { newFullContent = fullOriginalText.replace(originalContent, finalContent); }
     updateMessages(messages.map(m => m.id === targetMessageId ? { ...m, content: newFullContent } : m));
     setOptState(null);
  };

  const placeholderText = useMemo(() => {
     if (messages.length <= 1) return "输入你的想法...";
     return "输入你的想法，或选择上方的快捷回复...";
  }, [messages]);

  const handleBatchToC = async (count: number | 'custom') => {
      if (isStreaming) return;
      const num = count === 'custom' ? 0 : count; 
      // Force strict header "## 目录" so the parser finds it, and force list items so they aren't Chapters
      const prompt = `请基于当前故事背景，批量生成接下来的 ${num} 个章节的目录。
      【重要排版要求】
      1. 请务必以 \`## 目录\` 作为开头标题。
      2. 具体的章节列表请使用 Markdown 列表格式 (例如：1. 第X章 标题)。
      3. **严禁**在列表项中使用标题格式 (##)，否则会导致系统识别错误。
      4. 不要使用代码块。`;
      await sendMessage(prompt);
  };

  const handleBatchContent = async (count: number | 'custom') => {
      if (isStreaming) return;
      const num = typeof count === 'number' ? count : 0;
      if (num <= 0) return;

      const startMsg: Message = { id: Date.now().toString(), role: 'user', content: `【系统指令】开始批量生成接下来的 ${num} 个章节正文...`, timestamp: Date.now() };
      let currentHistory = [...messages, startMsg];
      updateMessages(currentHistory); 

      setIsStreaming(true); 
      
      try {
          for (let i = 1; i <= num; i++) {
              if (abortControllerRef.current?.signal.aborted) break;
              
              // --- Check Auto-Anchor Condition ---
              const currentChapters = novelStats.currentChapters; // This is a bit lagged during batch if we don't recalc, but acceptable for next iter.
              // Re-calculate chapters count based on currentHistory to be more precise during batch
              let batchCurrentChapters = 0;
              currentHistory.forEach(m => {
                  if (m.role === 'model') {
                      const matches = m.content.match(/(^|\n)##\s*(第[0-9一二三四五六七八九十]+章\s*[^\n]*)/g);
                      if (matches) batchCurrentChapters += matches.length;
                  }
              });

              if (activeNovel.anchorConfig?.enabled && batchCurrentChapters >= activeNovel.anchorConfig.nextTrigger) {
                  // Execute Anchor
                  showToast(`自动触发剧情锚点 (第 ${batchCurrentChapters} 章)...`, "info");
                  
                  // Run Anchor and get updated history
                  const newHistory = await executeAnchor(currentHistory, true);
                  
                  // Update currentHistory to include anchor messages so next generation uses truncated context
                  currentHistory = newHistory;

                  // Update next trigger
                  const nextTrigger = activeNovel.anchorConfig.nextTrigger + activeNovel.anchorConfig.chapterInterval;
                  updateActiveNovel({ 
                      anchorConfig: { ...activeNovel.anchorConfig, nextTrigger } 
                  });

                  // Brief pause
                  await new Promise(r => setTimeout(r, 1000));
              }
              
              // --- End Auto-Anchor Check ---

              const prompt = `请撰写当前目录中下一个尚未撰写的章节正文。
              【排版要求】
              1. 必须明确标出章节标题，格式为：\`## 第X章 标题\` (请勿包含 (草稿) 或其他备注)。
              2. **严禁**在结尾输出 "Options:" 交互选项。
              3. **严禁**输出任何 "好的"、"这是正文" 等闲聊内容，直接输出小说内容。

              【字数与内容硬性要求】
              1. 字数目标：**${settings.targetWordsPerChapter} 字**（这是一条硬性红线）。
              2. 请通过大量的环境描写、心理活动、对话细节来填充内容。切勿写流水账。
              3. 请将本章内容拆分为至少 3-4 个具体的场景或冲突点，逐一展开描写，不要一笔带过。`;
              
              const userMsg: Message = { id: Date.now().toString(), role: 'user', content: `(自动任务 ${i}/${num}) ${prompt}`, timestamp: Date.now() };
              currentHistory = [...currentHistory, userMsg];
              updateMessages(currentHistory);

              abortControllerRef.current = new AbortController();
              const aiMsgId = (Date.now() + 1).toString();
              const aiMsgPlaceholder: Message = { id: aiMsgId, role: 'model', content: '', timestamp: Date.now() + 1 };
              currentHistory = [...currentHistory, aiMsgPlaceholder];
              updateMessages(currentHistory);
              
              let fullResponse = '';
              await generateStreamResponse(currentHistory.slice(0, -1), prompt, settings, activeNovel.contextSummary, (chunk) => {
                      fullResponse += chunk;
                      setNovels(prev => prev.map(n => {
                          if (n.id === activeNovel.id) {
                              const newMsgs = [...n.messages];
                              const idx = newMsgs.findIndex(m => m.id === aiMsgId);
                              if (idx !== -1) newMsgs[idx] = { ...newMsgs[idx], content: fullResponse };
                              return { ...n, messages: newMsgs, lastModified: Date.now() };
                          }
                          return n;
                      }));
                  }, abortControllerRef.current.signal);
              
              const cleanFullResponse = cleanAIResponse(fullResponse);
              const contentWithOptions = cleanFullResponse + "\n\nOptions: [继续写下一章] [重写本章] [精修本章] [生成本章细纲]";
              currentHistory[currentHistory.length - 1] = { ...aiMsgPlaceholder, content: contentWithOptions };
              updateMessages(currentHistory);
              await new Promise(r => setTimeout(r, 1000));
          }
      } catch (e) { console.error("Batch error", e); } finally { setIsStreaming(false); abortControllerRef.current = null; }
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-black ec:bg-ec-bg text-gray-900 dark:text-gray-100 ec:text-ec-text font-sans transition-colors relative">
      
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
          {toasts.map(toast => (
              <div key={toast.id} className={`toast-enter pointer-events-auto px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2
                  ${toast.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : ''}
                  ${toast.type === 'error' ? 'bg-red-100 text-red-800 border border-red-200' : ''}
                  ${toast.type === 'info' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' : ''}
              `}>
                  {toast.type === 'success' && <span>✅</span>}
                  {toast.type === 'error' && <span>⚠️</span>}
                  {toast.type === 'info' && <span className="animate-spin">⏳</span>}
                  {toast.message}
              </div>
          ))}
      </div>

      <header className="h-16 border-b border-gray-200 dark:border-gray-800 ec:border-ec-border flex items-center justify-between px-4 lg:px-6 bg-white dark:bg-gray-900 ec:bg-ec-surface shrink-0 z-10 transition-colors">
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center font-bold text-white shadow-md">Ink</div>
                <h1 className="font-bold text-lg tracking-tight hidden md:flex items-center gap-1 ec:text-ec-text">
                    InkFlow 
                    <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500 dark:text-gray-400 font-medium">v1.3.0</span>
                </h1>
            </div>
            <div className="hidden lg:flex items-center gap-3 px-4 py-1.5 bg-gray-100 dark:bg-gray-800 ec:bg-ec-bg rounded-full text-xs text-gray-600 dark:text-gray-300 ec:text-ec-text border border-gray-200 dark:border-gray-700 ec:border-ec-border">
                <input type="text" value={activeNovel.title} onChange={(e) => updateActiveNovel({ title: e.target.value })} className="font-bold text-indigo-600 dark:text-indigo-400 ec:text-ec-accent bg-transparent border-none focus:outline-none focus:ring-0 w-[150px] truncate hover:bg-gray-200 dark:hover:bg-gray-700 ec:hover:bg-ec-surface rounded px-1 transition-colors"/>
                <span className="w-px h-3 bg-gray-300 dark:bg-gray-600 ec:bg-ec-border"></span>
                <button onClick={() => setIsSettingsOpen(true)} className="hover:text-indigo-600 dark:hover:text-indigo-400 ec:hover:text-ec-accent">章节: {novelStats.currentChapters}/{novelStats.totalChapters}</button>
                <span className="w-px h-3 bg-gray-300 dark:bg-gray-600 ec:bg-ec-border"></span>
                <span>正文字数: {(novelStats.wordCount / 10000).toFixed(1)}万</span>
            </div>
        </div>
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 ec:bg-ec-bg p-1 rounded-lg">
             <button onClick={() => setViewMode(ViewMode.ChatOnly)} className={`p-2 rounded-md ${viewMode===ViewMode.ChatOnly?'bg-white dark:bg-gray-700 ec:bg-ec-surface shadow-sm':''}`}><MessageSquareIcon /></button>
             <button onClick={() => setViewMode(ViewMode.Split)} className={`p-2 rounded-md ${viewMode===ViewMode.Split?'bg-white dark:bg-gray-700 ec:bg-ec-surface shadow-sm':''}`}><div className="flex gap-0.5"><div className="w-2 h-3 border border-current rounded-[1px]"></div><div className="w-2 h-3 border border-current rounded-[1px] bg-current"></div></div></button>
             <button onClick={() => setViewMode(ViewMode.NovelOnly)} className={`p-2 rounded-md ${viewMode===ViewMode.NovelOnly?'bg-white dark:bg-gray-700 ec:bg-ec-surface shadow-sm':''}`}><BookOpenIcon /></button>
        </div>
        <div className="flex items-center gap-2">
            {messages.length > 5 && (
                 <button onClick={handleAnchorClick} disabled={isStreaming} className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors border ${activeNovel.anchorConfig?.enabled ? 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800' : 'text-indigo-700 dark:text-indigo-300 ec:text-ec-accent bg-indigo-50 dark:bg-indigo-900/30 ec:bg-ec-surface hover:bg-indigo-100 dark:hover:bg-indigo-900/50 ec:hover:bg-ec-border border-indigo-200 dark:border-indigo-800 ec:border-ec-border'}`} title="压缩上下文：将当前剧情总结为锚点，释放Token空间，防止生成中断。">
                    <span>⚓</span> {activeNovel.anchorConfig?.enabled ? `自动锚定 (下一次: ${activeNovel.anchorConfig.nextTrigger}章)` : '剧情锚点'}
                </button>
            )}
            <button onClick={() => setIsLibraryOpen(true)} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 ec:bg-ec-bg rounded-lg ec:text-ec-text"><LibraryIcon /> 图书库</button>
            <button onClick={handleDownloadAll} className="p-2 rounded-lg sm:hidden">⬇️</button>
            
            {/* Theme Toggle */}
            <button onClick={toggleTheme} className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 ec:text-ec-text ec:hover:text-black transition-colors" title="切换主题: 白天/护眼/暗黑">
                {theme === 'light' ? <SunIcon /> : (theme === 'eye-care' ? <EyeIcon /> : <MoonIcon />)}
            </button>
            
            <button onClick={() => setIsContactOpen(true)} className="p-2 text-gray-500 ec:text-ec-text"><MailIcon /></button>
            <button onClick={() => setIsHelpOpen(true)} className="p-2 text-gray-500 ec:text-ec-text"><HelpCircleIcon /></button>
            <button onClick={() => setIsVersionOpen(true)} className="p-2 text-gray-500 ec:text-ec-text"><HistoryIcon /></button>
            <button onClick={() => setIsSettingsOpen(true)} className="p-2 bg-gray-100 dark:bg-gray-800 ec:bg-ec-bg rounded-lg ec:text-ec-text"><SettingsIcon /></button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative flex">
        <div className={`flex-1 h-full transition-all ${viewMode === ViewMode.NovelOnly ? 'hidden' : 'block'} ${viewMode === ViewMode.Split ? 'w-1/2 border-r border-gray-200 dark:border-gray-800 ec:border-ec-border' : 'w-full'}`}>
          <ChatArea messages={messages} input={inputValue} isStreaming={isStreaming && !optState?.isOpen} placeholderText={placeholderText} onInputChange={handleInputChange} onSend={handleUserSend} onStop={handleStop} onMessageEdit={handleMessageEdit} onSummarize={handleSummarize} />
        </div>
        <div className={`h-full transition-all bg-white dark:bg-gray-950 ec:bg-ec-bg ${viewMode === ViewMode.ChatOnly ? 'hidden' : 'block'} ${viewMode === ViewMode.Split ? 'w-1/2' : 'w-full'}`}>
           <NovelView messages={messages} settings={settings} onBatchGenerateToC={handleBatchToC} onBatchGenerateContent={handleBatchContent} onChapterAction={handleChapterAction} onTextSelectionOptimize={handleTextSelectionOptimize} isGenerating={isStreaming} onMessageEdit={handleMessageEdit} />
        </div>
      </main>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onSave={updateSettings} />
      <LibraryModal isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} novels={novels} currentNovelId={currentNovelId} onSelectNovel={(id) => {setCurrentNovelId(id); setIsLibraryOpen(false);}} onCreateNovel={createNewNovel} onDeleteNovel={deleteNovel} onRenameNovel={renameNovel} onDeconstructNovel={handleDeconstructNovel} />
      
      <AnchorModal 
        isOpen={isAnchorModalOpen} 
        onClose={() => setIsAnchorModalOpen(false)} 
        currentConfig={activeNovel.anchorConfig}
        currentChapterCount={novelStats.currentChapters}
        onExecuteNow={() => executeAnchor()}
        onSaveConfig={(config) => updateActiveNovel({ anchorConfig: config })}
      />

      {optState && <ComparisonModal isOpen={optState.isOpen} onClose={() => { if (isStreaming) handleStop(); setOptState(null); }} title={optState.type === 'chapter' ? '章节重写/优化' : '段落润色'} oldContent={optState.originalContent} newContent={optState.newContent} onConfirm={handleConfirmOptimization} isApplying={false} isStreaming={isStreaming} />}
      {isContactOpen && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"><div className="bg-white dark:bg-gray-900 ec:bg-ec-bg border ec:border-ec-border rounded-xl shadow-2xl w-full max-w-sm"><div className="p-4 border-b ec:border-ec-border flex justify-between"><h3 className="ec:text-ec-text">联系开发者</h3><button onClick={() => setIsContactOpen(false)} className="ec:text-ec-text"><XIcon/></button></div><div className="p-8 text-center ec:text-ec-text"><MailIcon/><p>support@inkflow.app</p></div></div></div>}
      
      {/* Help Modal */}
      {isHelpOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white dark:bg-gray-900 ec:bg-ec-bg border ec:border-ec-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
               <div className="p-4 border-b border-gray-200 dark:border-gray-700 ec:border-ec-border flex justify-between">
                   <h3 className="font-bold text-gray-900 dark:text-white ec:text-ec-text text-lg">📚 使用教程 (Guide)</h3>
                   <button onClick={() => setIsHelpOpen(false)} className="ec:text-ec-text"><XIcon/></button>
               </div>
               <div className="p-6 overflow-y-auto space-y-8 text-sm text-gray-600 dark:text-gray-300 ec:text-ec-text">
                  <section>
                    <h4 className="font-bold text-gray-900 dark:text-white ec:text-ec-text mb-3 text-base flex items-center gap-2"><span className="text-xl">🚀</span> 快速开始 (Quick Start)</h4>
                    <ol className="list-decimal list-inside space-y-2 ml-1">
                      <li><strong className="text-gray-800 dark:text-gray-200 ec:text-ec-text">第一步：初始化设定</strong><br/><span className="pl-5 block text-xs opacity-80">在对话框告诉 AI：“我想写一本赛博修仙小说，主角是程序员”。AI 会自动引导你完善世界观。</span></li>
                      <li><strong className="text-gray-800 dark:text-gray-200 ec:text-ec-text">第二步：确认核心参数</strong><br/><span className="pl-5 block text-xs opacity-80">AI 会询问书名、预计字数等。确认后，这些信息会自动填入“基础设定”面板。</span></li>
                      <li><strong className="text-gray-800 dark:text-gray-200 ec:text-ec-text">第三步：生成目录</strong><br/><span className="pl-5 block text-xs opacity-80">设定完成后，点击“批量生成目录”或直接发送“生成前20章目录”。</span></li>
                      <li><strong className="text-gray-800 dark:text-gray-200 ec:text-ec-text">第四步：撰写正文</strong><br/><span className="pl-5 block text-xs opacity-80">目录生成后，使用右下角的“批量撰写”按钮，或直接对 AI 说“写第一章”。</span></li>
                    </ol>
                  </section>

                  <section>
                    <h4 className="font-bold text-gray-900 dark:text-white ec:text-ec-text mb-3 text-base flex items-center gap-2"><span className="text-xl">✨</span> 核心功能详解</h4>
                    <div className="space-y-4">
                        <div>
                            <h5 className="font-bold text-indigo-600 dark:text-indigo-400 ec:text-ec-accent mb-1">📋 基础设定 & 数据库</h5>
                            <p className="text-xs opacity-80 leading-relaxed">系统会自动识别对话中的设定内容（如“## 角色档案”），并将其归档到右侧面板。你可以随时在对话中补充设定，如“增加一个反派角色叫张三”。</p>
                        </div>
                        <div>
                            <h5 className="font-bold text-indigo-600 dark:text-indigo-400 ec:text-ec-accent mb-1">📚 章节正文与编辑</h5>
                            <p className="text-xs opacity-80 leading-relaxed">生成的正文会自动提取到“章节正文”卡片中。你可以：</p>
                            <ul className="list-disc list-inside text-xs opacity-80 pl-2 mt-1 space-y-1">
                                <li>点击 <EditIcon/> 图标直接在弹窗中修改正文内容。</li>
                                <li>点击 <SparklesIcon/> 进行局部润色或全文优化。</li>
                                <li>点击 <SpeakerIcon/> 朗读章节（支持男女声切换和倍速）。</li>
                            </ul>
                        </div>
                    </div>
                  </section>

                  <section>
                    <h4 className="font-bold text-gray-900 dark:text-white ec:text-ec-text mb-3 text-base flex items-center gap-2"><span className="text-xl">🔥</span> 进阶技巧</h4>
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 ec:bg-ec-surface border border-indigo-100 dark:border-indigo-800 ec:border-ec-border rounded-lg p-4 space-y-3">
                        <div>
                            <strong className="block text-indigo-700 dark:text-indigo-300 ec:text-ec-text mb-1">⚓ 剧情锚点 (长文神器)</strong>
                            <p className="text-xs opacity-80">当对话过长（超过50轮）时，AI 可能会遗忘前文。点击顶部的 **“剧情锚点”** 按钮，系统会将当前剧情压缩成一个“存档点”，释放 Token 空间，确保 AI 长期记忆不丢失。</p>
                        </div>
                        <div>
                            <strong className="block text-indigo-700 dark:text-indigo-300 ec:text-ec-text mb-1">🏗️ 小说拆解 / 仿写</strong>
                            <p className="text-xs opacity-80">在“图书库”中，你可以输入一本知名小说的书名或链接。AI 会深度分析其节奏、爽点和文风，并基于此风格为你创建新的大纲。</p>
                        </div>
                    </div>
                  </section>

                  <section>
                     <h4 className="font-bold text-gray-900 dark:text-white ec:text-ec-text mb-2 text-base">❓ 常见问题</h4>
                     <ul className="list-disc list-inside text-xs opacity-80 space-y-1">
                         <li><strong>生成中断怎么办？</strong> 点击输入框旁的红色停止按钮，然后发送“继续”即可。</li>
                         <li><strong>如何配置 API？</strong> 点击右上角设置图标，支持 OpenAI 格式及各类中转接口（DeepSeek, Kimi 等）。</li>
                     </ul>
                  </section>
               </div>
            </div>
          </div>
      )}

      {/* Version History Modal */}
      {isVersionOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white dark:bg-gray-900 ec:bg-ec-bg border ec:border-ec-border rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
               <div className="p-4 border-b border-gray-200 dark:border-gray-700 ec:border-ec-border flex justify-between">
                   <h3 className="font-bold text-gray-900 dark:text-white ec:text-ec-text flex items-center gap-2"><HistoryIcon /> 版本历史 (Changelog)</h3>
                   <button onClick={() => setIsVersionOpen(false)} className="ec:text-ec-text"><XIcon/></button>
               </div>
               <div className="p-6 overflow-y-auto custom-scrollbar">
                   <div className="relative border-l-2 border-gray-200 dark:border-gray-700 ec:border-ec-border ml-3 space-y-8">
                       
                       {/* v1.3.0 */}
                       <div className="relative pl-6">
                           <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-green-500 border-4 border-white dark:border-gray-900 ec:border-ec-bg"></div>
                           <div className="flex flex-col gap-1">
                               <div className="flex items-center gap-2">
                                   <h4 className="font-bold text-gray-900 dark:text-white ec:text-ec-text">v1.3.0 - 体验升级版</h4>
                                   <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] rounded-full font-bold">Latest</span>
                               </div>
                               <span className="text-xs text-gray-400 mb-2">2024-05-22</span>
                               <ul className="text-sm text-gray-600 dark:text-gray-300 ec:text-ec-text space-y-1.5 list-disc list-inside">
                                   <li>✨ <strong>TTS 朗读升级</strong>：新增朗读暂停/继续功能，支持播放前预设语速和音色（男/女声自动识别）。</li>
                                   <li>📝 <strong>正文编辑</strong>：现在可以直接在章节卡片中编辑生成的正文内容，修改后自动同步到底层数据。</li>
                                   <li>👁️ <strong>护眼模式优化</strong>：全面适配“豆沙绿”护眼主题，修复了弹窗和按钮的颜色显示问题。</li>
                               </ul>
                           </div>
                       </div>

                       {/* v1.2.0 */}
                       <div className="relative pl-6">
                           <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-indigo-500 border-4 border-white dark:border-gray-900 ec:border-ec-bg"></div>
                           <div className="flex flex-col gap-1">
                               <h4 className="font-bold text-gray-900 dark:text-white ec:text-ec-text">v1.2.0 - 创作工具箱</h4>
                               <span className="text-xs text-gray-400 mb-2">2024-05-15</span>
                               <ul className="text-sm text-gray-600 dark:text-gray-300 ec:text-ec-text space-y-1.5 list-disc list-inside">
                                   <li>🏗️ <strong>小说拆解/仿写</strong>：输入目标小说链接或书名，AI 自动分析风格并生成新大纲。</li>
                                   <li>⚓ <strong>剧情锚点</strong>：解决长文遗忘问题，手动压缩上下文。</li>
                                   <li>📂 <strong>图书库 (Library)</strong>：支持多本小说管理、删除与重命名。</li>
                               </ul>
                           </div>
                       </div>

                       {/* v1.1.0 */}
                       <div className="relative pl-6">
                           <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-gray-300 dark:bg-gray-600 ec:bg-ec-border border-4 border-white dark:border-gray-900 ec:border-ec-bg"></div>
                           <div className="flex flex-col gap-1">
                               <h4 className="font-bold text-gray-900 dark:text-white ec:text-ec-text">v1.1.0 - 批量生成</h4>
                               <span className="text-xs text-gray-400 mb-2">2024-05-01</span>
                               <ul className="text-sm text-gray-600 dark:text-gray-300 ec:text-ec-text space-y-1.5 list-disc list-inside">
                                   <li>⚡ <strong>批量操作</strong>：支持批量生成目录 (ToC) 和批量撰写正文。</li>
                                   <li>💾 <strong>导出功能</strong>：支持导出为 TXT, Markdown, Word 格式。</li>
                                   <li>🎨 <strong>界面优化</strong>：引入左右分屏、纯对话、纯阅读三种视图模式。</li>
                               </ul>
                           </div>
                       </div>

                       {/* v1.0.0 */}
                       <div className="relative pl-6">
                           <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-gray-300 dark:bg-gray-600 ec:bg-ec-border border-4 border-white dark:border-gray-900 ec:border-ec-bg"></div>
                           <div className="flex flex-col gap-1">
                               <h4 className="font-bold text-gray-900 dark:text-white ec:text-ec-text">v1.0.0 - 初始发布</h4>
                               <span className="text-xs text-gray-400 mb-2">2024-04-10</span>
                               <p className="text-sm text-gray-600 dark:text-gray-300 ec:text-ec-text">
                                   基于 LLM 的交互式小说生成器诞生。支持基础的对话设定、数据库自动提取和正文生成。
                               </p>
                           </div>
                       </div>

                   </div>
               </div>
            </div>
          </div>
      )}
    </div>
  );
}

export default App;
