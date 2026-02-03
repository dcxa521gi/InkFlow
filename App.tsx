
import React, { useState, useEffect, useRef, useMemo } from 'react';
import ChatArea from './components/ChatArea';
import NovelView from './components/NovelView';
import SettingsModal from './components/SettingsModal';
import LibraryModal from './components/LibraryModal';
import ComparisonModal from './components/ComparisonModal';
import { generateStreamResponse } from './services/aiService';
import { Message, AppSettings, ViewMode, NovelSession, OptimizationState } from './types';
import { DEFAULT_SETTINGS } from './constants';
import { SettingsIcon, BookOpenIcon, MessageSquareIcon, MailIcon, SunIcon, MoonIcon, XIcon, LibraryIcon, HelpCircleIcon, HistoryIcon } from './components/Icons';

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
  settings: { ...DEFAULT_SETTINGS }
});

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
                settings: oldSettings ? JSON.parse(oldSettings) : DEFAULT_SETTINGS
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

  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try { return (localStorage.getItem('inkflow_theme') === 'light') ? 'light' : 'dark'; } catch { return 'dark'; }
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isVersionOpen, setIsVersionOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Split);
  const [optState, setOptState] = useState<OptimizationState | null>(null);

  useEffect(() => { if (novels.length > 0) localStorage.setItem('inkflow_library', JSON.stringify(novels)); }, [novels]);
  useEffect(() => { localStorage.setItem('inkflow_theme', theme); const html = document.documentElement; if (theme === 'dark') html.classList.add('dark'); else html.classList.remove('dark'); }, [theme]);

  if (!activeNovel) return null;

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

  const handleAnchorContext = async () => {
      if (isStreaming || messages.length < 5) return;
      
      const confirmMsg = "确定要构建剧情锚点吗？\n\nAI 将总结当前卷/单元的剧情和设定，并压缩历史消息。这能有效释放上下文空间，同时保证后续剧情连贯。\n\n建议在每一卷结束或由于字数过多导致 AI 遗忘设定时使用。";
      if (!window.confirm(confirmMsg)) return;

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
      let currentHistory = [...messages, userMsg];
      const aiMsgId = 'anchor-res-' + Date.now();
      const placeholder: Message = { id: aiMsgId, role: 'model', content: '', timestamp: Date.now() + 1 };
      updateMessages([...currentHistory, placeholder]);

      try {
          let summary = "";
          await generateStreamResponse(currentHistory, prompt, settings, activeNovel.contextSummary, (chunk) => {
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
          const firstMsg = messages[0]; 
          
          const systemNotice: Message = {
              id: 'sys-notice-' + Date.now(),
              role: 'model',
              content: `✅ **锚点构建成功 (分段锚定完成)**\n\n已为您压缩历史上下文。AI 已记住了上一卷的核心剧情与伏笔。\n\n**当前锚点摘要：**\n${finalSummary.slice(0, 150)}...\n\n您可以直接继续创作下一卷/下一章了。`,
              timestamp: Date.now()
          };
          
          const newMessages = [firstMsg, systemNotice];
          setNovels(prev => prev.map(n => n.id === activeNovel.id ? { ...n, messages: newMessages, contextSummary: finalSummary, lastModified: Date.now() } : n));

      } catch (e) {
          console.error("Anchoring failed", e);
          alert("锚点构建失败，请重试。");
      } finally {
          setIsStreaming(false);
      }
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
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-black text-gray-900 dark:text-gray-100 font-sans transition-colors">
      <header className="h-16 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 lg:px-6 bg-white dark:bg-gray-900 shrink-0 z-10 transition-colors">
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center font-bold text-white shadow-md">Ink</div>
                <h1 className="font-bold text-lg tracking-tight hidden md:block">InkFlow</h1>
            </div>
            <div className="hidden lg:flex items-center gap-3 px-4 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-full text-xs text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                <input type="text" value={activeNovel.title} onChange={(e) => updateActiveNovel({ title: e.target.value })} className="font-bold text-indigo-600 dark:text-indigo-400 bg-transparent border-none focus:outline-none focus:ring-0 w-[150px] truncate hover:bg-gray-200 dark:hover:bg-gray-700 rounded px-1 transition-colors"/>
                <span className="w-px h-3 bg-gray-300 dark:bg-gray-600"></span>
                <button onClick={() => setIsSettingsOpen(true)} className="hover:text-indigo-600 dark:hover:text-indigo-400">章节: {novelStats.currentChapters}/{novelStats.totalChapters}</button>
                <span className="w-px h-3 bg-gray-300 dark:bg-gray-600"></span>
                <span>正文字数: {(novelStats.wordCount / 10000).toFixed(1)}万</span>
            </div>
        </div>
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
             <button onClick={() => setViewMode(ViewMode.ChatOnly)} className={`p-2 rounded-md ${viewMode===ViewMode.ChatOnly?'bg-white dark:bg-gray-700 shadow-sm':''}`}><MessageSquareIcon /></button>
             <button onClick={() => setViewMode(ViewMode.Split)} className={`p-2 rounded-md ${viewMode===ViewMode.Split?'bg-white dark:bg-gray-700 shadow-sm':''}`}><div className="flex gap-0.5"><div className="w-2 h-3 border border-current rounded-[1px]"></div><div className="w-2 h-3 border border-current rounded-[1px] bg-current"></div></div></button>
             <button onClick={() => setViewMode(ViewMode.NovelOnly)} className={`p-2 rounded-md ${viewMode===ViewMode.NovelOnly?'bg-white dark:bg-gray-700 shadow-sm':''}`}><BookOpenIcon /></button>
        </div>
        <div className="flex items-center gap-2">
            {messages.length > 5 && (
                 <button onClick={handleAnchorContext} disabled={isStreaming} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition-colors border border-indigo-200 dark:border-indigo-800" title="压缩上下文：将当前剧情总结为锚点，释放Token空间，防止生成中断。">
                    <span>⚓</span> 剧情锚点
                </button>
            )}
            <button onClick={() => setIsLibraryOpen(true)} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 rounded-lg"><LibraryIcon /> 图书库</button>
            <button onClick={handleDownloadAll} className="p-2 rounded-lg sm:hidden">⬇️</button>
            <button onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')} className="p-2 rounded-lg text-gray-500">{theme === 'dark' ? <SunIcon /> : <MoonIcon />}</button>
            <button onClick={() => setIsContactOpen(true)} className="p-2 text-gray-500"><MailIcon /></button>
            <button onClick={() => setIsHelpOpen(true)} className="p-2 text-gray-500"><HelpCircleIcon /></button>
            <button onClick={() => setIsVersionOpen(true)} className="p-2 text-gray-500"><HistoryIcon /></button>
            <button onClick={() => setIsSettingsOpen(true)} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg"><SettingsIcon /></button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative flex">
        <div className={`flex-1 h-full transition-all ${viewMode === ViewMode.NovelOnly ? 'hidden' : 'block'} ${viewMode === ViewMode.Split ? 'w-1/2 border-r border-gray-200 dark:border-gray-800' : 'w-full'}`}>
          <ChatArea messages={messages} input={inputValue} isStreaming={isStreaming && !optState?.isOpen} placeholderText={placeholderText} onInputChange={handleInputChange} onSend={handleUserSend} onStop={handleStop} onMessageEdit={handleMessageEdit} onSummarize={handleSummarize} />
        </div>
        <div className={`h-full transition-all bg-white dark:bg-gray-950 ${viewMode === ViewMode.ChatOnly ? 'hidden' : 'block'} ${viewMode === ViewMode.Split ? 'w-1/2' : 'w-full'}`}>
           <NovelView messages={messages} settings={settings} onBatchGenerateToC={handleBatchToC} onBatchGenerateContent={handleBatchContent} onChapterAction={handleChapterAction} onTextSelectionOptimize={handleTextSelectionOptimize} isGenerating={isStreaming} />
        </div>
      </main>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onSave={updateSettings} />
      <LibraryModal isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} novels={novels} currentNovelId={currentNovelId} onSelectNovel={(id) => {setCurrentNovelId(id); setIsLibraryOpen(false);}} onCreateNovel={createNewNovel} onDeleteNovel={deleteNovel} onRenameNovel={renameNovel} onDeconstructNovel={handleDeconstructNovel} />
      {optState && <ComparisonModal isOpen={optState.isOpen} onClose={() => { if (isStreaming) handleStop(); setOptState(null); }} title={optState.type === 'chapter' ? '章节重写/优化' : '段落润色'} oldContent={optState.originalContent} newContent={optState.newContent} onConfirm={handleConfirmOptimization} isApplying={false} isStreaming={isStreaming} />}
      {isContactOpen && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"><div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-sm"><div className="p-4 border-b flex justify-between"><h3>联系开发者</h3><button onClick={() => setIsContactOpen(false)}><XIcon/></button></div><div className="p-8 text-center"><MailIcon/><p>support@inkflow.app</p></div></div></div>}
      {isHelpOpen && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"><div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col"><div className="p-4 border-b flex justify-between"><h3>使用教程</h3><button onClick={() => setIsHelpOpen(false)}><XIcon/></button></div><div className="p-6 overflow-y-auto"><p>使用分段锚定法解决长文上下文问题。</p></div></div></div>}
      {isVersionOpen && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"><div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col"><div className="p-4 border-b flex justify-between"><h3>版本介绍</h3><button onClick={() => setIsVersionOpen(false)}><XIcon/></button></div><div className="p-6 overflow-y-auto"><p>v1.3: 新增剧情锚点功能，支持长篇小说创作；优化基础设定提取；新增章节批量操作建议。</p></div></div></div>}
    </div>
  );
}

export default App;
