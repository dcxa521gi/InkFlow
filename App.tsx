
import React, { useState, useEffect, useRef, useMemo } from 'react';
import ChatArea from './components/ChatArea';
import NovelView from './components/NovelView';
import SettingsModal from './components/SettingsModal';
import LibraryModal from './components/LibraryModal';
import { generateStreamResponse } from './services/aiService';
import { Message, AppSettings, ViewMode, NovelSession } from './types';
import { DEFAULT_SETTINGS } from './constants';
import { SettingsIcon, BookOpenIcon, MessageSquareIcon, MailIcon, SunIcon, MoonIcon, XIcon, LibraryIcon } from './components/Icons';

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
  // --- Library & State Management ---
  const [novels, setNovels] = useState<NovelSession[]>(() => {
    try {
        const library = localStorage.getItem('inkflow_library');
        if (library) {
            const parsed = JSON.parse(library);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
        
        // Migration from old single-save format
        const oldMessages = localStorage.getItem('inkflow_messages');
        const oldSettings = localStorage.getItem('inkflow_settings');
        if (oldMessages) {
            const msgs = JSON.parse(oldMessages);
            // Try to extract title from old messages
            let title = '未命名小说';
            const titleMatch = msgs.find((m: Message) => m.role === 'model' && m.content.match(/小说名[:：]\s*《?([^》\n]+)》?/));
            if (titleMatch) {
                const m = titleMatch.content.match(/小说名[:：]\s*《?([^》\n]+)》?/);
                if (m && m[1]) title = m[1].replace(/[*`]/g, '');
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
        
        // Return default if nothing exists
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
      // If initialized via migration or default in the novels state, 
      // we'll rely on the useEffect or the fallback in useMemo to handle the specific ID.
      // Returning empty string triggers the useMemo fallback to novels[0].
      return '';
  });

  // Ensure activeNovel is set if currentNovelId is empty
  useEffect(() => {
      if (novels.length === 0) {
          // Should normally not happen with the new init logic, but for safety:
          setNovels([createDefaultNovel()]);
      } else if (!currentNovelId) {
          setCurrentNovelId(novels[0].id);
      }
  }, [novels, currentNovelId]);

  // Derived active state
  // Fallback to novels[0] ensures we always have a value if novels is not empty
  const activeNovel = useMemo(() => novels.find(n => n.id === currentNovelId) || novels[0], [novels, currentNovelId]);
  
  // State Aliases (Mapped to activeNovel)
  // These rely on activeNovel being defined
  const messages = activeNovel?.messages || [];
  const settings = activeNovel?.settings || DEFAULT_SETTINGS;

  // --- UI State ---
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try { return (localStorage.getItem('inkflow_theme') === 'light') ? 'light' : 'dark'; } catch { return 'dark'; }
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Split);
  const [pendingReplacement, setPendingReplacement] = useState<{title: string} | null>(null);

  // --- Persistence ---
  useEffect(() => {
      if (novels.length > 0) {
          localStorage.setItem('inkflow_library', JSON.stringify(novels));
      }
  }, [novels]);

  useEffect(() => {
    localStorage.setItem('inkflow_theme', theme);
    const html = document.documentElement;
    if (theme === 'dark') html.classList.add('dark');
    else html.classList.remove('dark');
  }, [theme]);

  // Safety check to prevent render crashes if activeNovel is somehow undefined
  if (!activeNovel) {
      return (
          <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-black text-gray-500">
              <div className="animate-pulse">Loading InkFlow...</div>
          </div>
      );
  }

  // --- Library Actions ---
  const createNewNovel = () => {
      const newNovel = createDefaultNovel();
      // Ensure unique ID just in case
      newNovel.id = Date.now().toString(); 
      setNovels(prev => [newNovel, ...prev]);
      setCurrentNovelId(newNovel.id);
      setIsLibraryOpen(false);
  };

  const deleteNovel = (id: string) => {
      const newNovels = novels.filter(n => n.id !== id);
      setNovels(newNovels); // If this becomes empty, the useEffect will recreate a default one
      if (currentNovelId === id) {
          if (newNovels.length > 0) setCurrentNovelId(newNovels[0].id);
          else {
              // Create new immediately to avoid empty state
              const def = createDefaultNovel();
              setNovels([def]);
              setCurrentNovelId(def.id);
          }
      }
  };

  const updateActiveNovel = (updates: Partial<NovelSession>) => {
      if (!activeNovel) return; // Use resolved activeNovel
      const targetId = activeNovel.id;
      
      setNovels(prev => prev.map(n => 
          n.id === targetId 
          ? { ...n, ...updates, lastModified: Date.now() } 
          : n
      ));
  };

  const updateMessages = (newMessages: Message[]) => {
      updateActiveNovel({ messages: newMessages });
      
      // Auto-detect settings from chat context in the latest message
      if (newMessages.length > 0) {
          const lastMsg = newMessages[newMessages.length - 1];
          if (lastMsg.role === 'model') {
             parseChatForConfig(lastMsg.content);
          }
      }
  };
  
  const updateSettings = (newSettings: AppSettings) => {
      updateActiveNovel({ settings: newSettings });
  };

  // --- Logic to parse config from chat ---
  const parseChatForConfig = (content: string) => {
      // 1. Auto-Title Sync
      const titleMatch = content.match(/小说名[:：]\s*《?([^》\n]+)》?/);
      if (titleMatch && titleMatch[1]) {
          const newTitle = titleMatch[1].replace(/[*`]/g, '').trim();
          if (newTitle && newTitle !== activeNovel.title) {
              updateActiveNovel({ title: newTitle });
          }
      } else {
          // Fallback: Check for "书名："
          const altTitle = content.match(/书名[:：]\s*《?([^》\n]+)》?/);
          if (altTitle && altTitle[1]) {
             const newTitle = altTitle[1].replace(/[*`]/g, '').trim();
             if (newTitle && newTitle !== activeNovel.title) {
                updateActiveNovel({ title: newTitle });
            }
          }
      }

      // 2. Parse Total Chapters
      // E.g., "预计写50章" or "Total Chapters: 50"
      const chapMatch = content.match(/(预计|计划|Total Chapters).*?(\d+)\s*章/i);
      if (chapMatch && chapMatch[2]) {
          const num = parseInt(chapMatch[2]);
          if (num > 0) {
              updateSettings({ ...settings, targetTotalChapters: num });
          }
      }

      // 3. Parse Word Count
      // E.g., "每章3000字"
      const wordMatch = content.match(/每章.*?(\d+)\s*字/);
      if (wordMatch && wordMatch[1]) {
          const num = parseInt(wordMatch[1]);
           if (num > 0) {
              updateSettings({ ...settings, targetWordsPerChapter: num });
          }
      }
  };

  // --- Stats Calculation ---
  const novelStats = useMemo(() => {
      let currentChapters = 0;
      let totalWordCount = 0;

      // Count chapters and words
      messages.filter(m => m.role === 'model').forEach(m => {
           const matches = m.content.matchAll(/(^|\n)##\s*(第[0-9一二三四五六七八九十]+章\s*[^\n]*)/g);
           for (const match of matches) {
               currentChapters++;
           }
           totalWordCount += m.content.length; 
      });

      return {
          currentChapters,
          totalChapters: settings.targetTotalChapters || 20,
          unfinishedChapters: Math.max(0, (settings.targetTotalChapters || 20) - currentChapters),
          wordCount: totalWordCount // Simplified total char count
      };
  }, [messages, settings.targetTotalChapters]);

  // --- Core AI Handler ---
  
  const sendMessage = async (text: string, currentHistory: Message[] = messages) => {
    setIsStreaming(true);
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const userMsg: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: text,
        timestamp: Date.now(),
    };
    
    // Update local variable for API call
    const updatedHistory = [...currentHistory, userMsg];
    // Update State
    updateMessages(updatedHistory);
    setInputValue(''); 

    const aiMsgId = (Date.now() + 1).toString();
    const aiMsgPlaceholder: Message = {
      id: aiMsgId,
      role: 'model',
      content: '', 
      timestamp: Date.now() + 1
    };
    // Update State
    updateMessages([...updatedHistory, aiMsgPlaceholder]);

    try {
      let fullResponseText = '';
      
      await generateStreamResponse(
        updatedHistory, 
        userMsg.content, 
        settings, 
        (chunk) => {
          fullResponseText += chunk;
          
          // Use functional update on novels state to ensure we capture the latest
          setNovels(prevNovels => {
              return prevNovels.map(n => {
                  if (n.id === activeNovel.id) { // Use resolved ID
                      const newMsgs = [...n.messages];
                      const lastMsgIndex = newMsgs.findIndex(m => m.id === aiMsgId);
                      if (lastMsgIndex !== -1) {
                          newMsgs[lastMsgIndex] = {
                              ...newMsgs[lastMsgIndex],
                              content: fullResponseText
                          };
                      }
                      return { ...n, messages: newMsgs, lastModified: Date.now() };
                  }
                  return n;
              });
          });
          
          // We also want to parse config on the fly for better UX, but might be expensive to run every chunk.
          // Let's run it only at the end.
        },
        signal
      );
      
      // Parse config at the end of generation
      parseChatForConfig(fullResponseText);

      return fullResponseText;

    } catch (error: any) {
      if (error.name !== 'AbortError') {
          console.error(error);
          setNovels(prev => prev.map(n => {
              if (n.id === activeNovel.id) {
                  return {
                      ...n,
                      messages: [...n.messages, { 
                          id: Date.now().toString(), 
                          role: 'model', 
                          content: `⚠️ Error: ${error?.message || 'Unknown error'}`, 
                          timestamp: Date.now() 
                        }]
                  };
              }
              return n;
          }));
      }
      throw error;
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
          setIsStreaming(false);
      }
      abortControllerRef.current = null;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleUserSend = (text?: string) => {
      if (isStreaming) return;
      const content = text || inputValue;
      if (!content.trim()) return;
      sendMessage(content);
  };

  const handleStop = () => {
      if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          setIsStreaming(false);
      }
  };

  const handleMessageEdit = (id: string, newContent: string) => {
      const newMessages = messages.map(m => m.id === id ? { ...m, content: newContent } : m);
      updateMessages(newMessages);
  };

  const handleSummarize = async () => {
      if (isStreaming) return;
      const prompt = "请简要总结之前的对话内容，包含已确定的核心设定、故事进展以及当前待解决的问题。";
      await sendMessage(prompt);
  };

  const handleDownloadAll = () => {
      let text = `书名：${activeNovel.title}\n`;
      text += `总字数：${novelStats.wordCount}\n\n`;
      
      const chapters: string[] = [];
      messages.filter(m => m.role === 'model').forEach(m => {
          const matches = m.content.matchAll(/(^|\n)##\s*(第[0-9一二三四五六七八九十]+章\s*[^\n]*)([\s\S]*?)(?=(\n##\s*第|$))/g);
          for (const match of matches) {
              const title = match[2];
              const content = match[3];
              chapters.push(`${title}\n${content.trim()}\n`);
          }
      });
      
      if (chapters.length === 0) {
          text += "（暂无识别到的正文章节）\n\n";
          text += "--- 对话记录 ---\n\n";
          text += messages.map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n\n');
      } else {
          text += chapters.join('\n-------------------\n\n');
      }

      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeNovel.title || 'novel'}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const handleChapterAction = async (action: 'optimize' | 'regenerate' | 'analyze', chapterTitle: string, content: string) => {
      if (isStreaming) return;

      let prompt = '';
      if (action === 'optimize') {
          prompt = `请优化润色以下章节：${chapterTitle}。\n要求：保持原意，提升文笔，增加细节描写，修复逻辑漏洞。\n\n原文：\n${content}`;
          setPendingReplacement({ title: chapterTitle });
      } else if (action === 'regenerate') {
          prompt = `请完全重写这一章：${chapterTitle}。\n参考之前的设定和大纲，重新构思本章的剧情发展。\n请务必以“${chapterTitle}”作为标题开头。`;
          setPendingReplacement({ title: chapterTitle });
      } else if (action === 'analyze') {
          prompt = `请分析以下章节：${chapterTitle}。\n请从剧情节奏、人物塑造、伏笔埋设等方面进行点评，并给出后续写作建议。\n\n原文：\n${content}`;
      }

      await sendMessage(prompt);
  };

  const placeholderText = useMemo(() => {
      if (messages.length <= 1) return "输入你的想法，如：我想写一个关于...的故事";
      
      const lastMsg = messages[messages.length - 1];
      const allContent = messages.map(m => m.content).join('\n');
      
      if (allContent.includes('## 目录') || /第[0-9一二三]+章/.test(allContent)) {
          return "可以尝试批量生成正文，或者讨论具体章节细节...";
      }
      return "输入你的想法，或选择上方的快捷回复...";
  }, [messages]);

  const handleBatchToC = async (count: number | 'custom') => {
      if (isStreaming) return;
      const num = count === 'custom' ? 0 : count; 
      const prompt = `请基于当前故事背景，批量生成接下来的 ${num} 个章节的目录。格式要求：\n1. 第X章：标题\n2. 第Y章：标题\n...`;
      await sendMessage(prompt);
  };

  const handleBatchContent = async (count: number | 'custom') => {
      if (isStreaming) return;
      const num = typeof count === 'number' ? count : 0;
      if (num <= 0) return;

      const startMsg: Message = {
          id: Date.now().toString(),
          role: 'user',
          content: `【系统指令】开始批量生成接下来的 ${num} 个章节正文...`,
          timestamp: Date.now()
      };
      
      let currentHistory = [...messages, startMsg];
      updateMessages(currentHistory); // Save instruction to history

      setIsStreaming(true); 
      
      try {
          for (let i = 1; i <= num; i++) {
              if (abortControllerRef.current?.signal.aborted) break;

              const prompt = `请撰写当前目录中下一个尚未撰写的章节正文。请明确标出章节标题 (例如：## 第X章 标题)。字数目标：${settings.targetWordsPerChapter}字左右。`;
              
              const userMsg: Message = {
                id: Date.now().toString(),
                role: 'user',
                content: `(自动任务 ${i}/${num}) ${prompt}`,
                timestamp: Date.now()
              };
              
              // Optimistically update
              currentHistory = [...currentHistory, userMsg];
              updateMessages(currentHistory);

              abortControllerRef.current = new AbortController();
              
              const aiMsgId = (Date.now() + 1).toString();
              const aiMsgPlaceholder: Message = {
                id: aiMsgId,
                role: 'model',
                content: '',
                timestamp: Date.now() + 1
              };
              
              currentHistory = [...currentHistory, aiMsgPlaceholder];
              updateMessages(currentHistory);
              
              let fullResponse = '';
              await generateStreamResponse(
                  currentHistory.slice(0, -1), // Exclude the empty placeholder for API request history
                  prompt,
                  settings,
                  (chunk) => {
                      fullResponse += chunk;
                      setNovels(prev => prev.map(n => {
                          if (n.id === activeNovel.id) { // Use resolved ID
                              const newMsgs = [...n.messages];
                              const idx = newMsgs.findIndex(m => m.id === aiMsgId);
                              if (idx !== -1) newMsgs[idx] = { ...newMsgs[idx], content: fullResponse };
                              return { ...n, messages: newMsgs, lastModified: Date.now() };
                          }
                          return n;
                      }));
                  },
                  abortControllerRef.current.signal
              );
              
              // Finalize history for next loop
              currentHistory[currentHistory.length - 1] = { ...aiMsgPlaceholder, content: fullResponse };
              updateMessages(currentHistory);
              
              await new Promise(r => setTimeout(r, 1000));
          }
      } catch (e) {
          console.error("Batch error", e);
      } finally {
          setIsStreaming(false);
          abortControllerRef.current = null;
      }
  };


  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-black text-gray-900 dark:text-gray-100 font-sans transition-colors">
      
      {/* Header */}
      <header className="h-16 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 lg:px-6 bg-white dark:bg-gray-900 shrink-0 z-10 transition-colors">
        
        {/* Left: Brand & Stats */}
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center font-bold text-white shadow-md">
                    Ink
                </div>
                <h1 className="font-bold text-lg tracking-tight hidden md:block">InkFlow</h1>
            </div>

            {/* Novel Stats Bar */}
            <div className="hidden lg:flex items-center gap-3 px-4 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-full text-xs text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                <span className="font-bold text-indigo-600 dark:text-indigo-400 max-w-[150px] truncate" title={activeNovel.title}>{activeNovel.title}</span>
                <span className="w-px h-3 bg-gray-300 dark:bg-gray-600"></span>
                <span title="已完成章节 / 总目标章节">章节: {novelStats.currentChapters}/{novelStats.totalChapters}</span>
                <span className="w-px h-3 bg-gray-300 dark:bg-gray-600"></span>
                <span>字数: {(novelStats.wordCount / 10000).toFixed(1)}万</span>
            </div>
        </div>

        {/* Center: View Mode */}
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
            <button 
                onClick={() => setViewMode(ViewMode.ChatOnly)}
                className={`p-2 rounded-md transition-all ${viewMode === ViewMode.ChatOnly ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                title="Chat Only"
            >
                <MessageSquareIcon />
            </button>
            <button 
                onClick={() => setViewMode(ViewMode.Split)}
                className={`hidden md:block p-2 rounded-md transition-all ${viewMode === ViewMode.Split ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                title="Split View"
            >
                <div className="flex gap-0.5"><div className="w-2 h-3 border border-current rounded-[1px]"></div><div className="w-2 h-3 border border-current rounded-[1px] bg-current"></div></div>
            </button>
             <button 
                onClick={() => setViewMode(ViewMode.NovelOnly)}
                className={`p-2 rounded-md transition-all ${viewMode === ViewMode.NovelOnly ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                title="Reader View"
            >
                <BookOpenIcon />
            </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
            <button
                onClick={() => setIsLibraryOpen(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors border border-gray-200 dark:border-gray-700"
                title="切换/管理小说"
            >
                <LibraryIcon />
                <span>图书库</span>
            </button>
            
            <button
                onClick={handleDownloadAll}
                className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors sm:hidden"
                title="下载"
            >
               ⬇️
            </button>

            <button
                onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title={theme === 'dark' ? "切换到护眼模式" : "切换到深色模式"}
            >
                {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
            <button 
                onClick={() => setIsContactOpen(true)}
                className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-lg transition-colors"
            >
                <MailIcon />
            </button>
            <button 
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 px-3 py-2 rounded-lg transition-colors border border-gray-200 dark:border-gray-700"
            >
                <SettingsIcon />
            </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative flex">
        
        {/* Left: Chat Area */}
        <div className={`
            flex-1 h-full transition-all duration-300 ease-in-out
            ${viewMode === ViewMode.NovelOnly ? 'hidden' : 'block'}
            ${viewMode === ViewMode.Split ? 'w-1/2 border-r border-gray-200 dark:border-gray-800' : 'w-full'}
        `}>
          <ChatArea 
            messages={messages} 
            input={inputValue}
            isStreaming={isStreaming}
            placeholderText={placeholderText}
            onInputChange={handleInputChange}
            onSend={handleUserSend}
            onStop={handleStop}
            onMessageEdit={handleMessageEdit}
            onSummarize={handleSummarize}
          />
        </div>

        {/* Right: Novel Preview Area */}
        <div className={`
            h-full transition-all duration-300 ease-in-out bg-white dark:bg-gray-950
            ${viewMode === ViewMode.ChatOnly ? 'hidden' : 'block'}
            ${viewMode === ViewMode.Split ? 'w-1/2' : 'w-full'}
        `}>
           <NovelView 
                messages={messages} 
                onBatchGenerateToC={handleBatchToC}
                onBatchGenerateContent={handleBatchContent}
                onChapterAction={handleChapterAction}
                isGenerating={isStreaming}
           />
        </div>

      </main>

      {/* Modals */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        settings={settings}
        onSave={updateSettings}
      />

      <LibraryModal 
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        novels={novels}
        currentNovelId={currentNovelId}
        onSelectNovel={(id) => {
            setCurrentNovelId(id);
            setIsLibraryOpen(false);
        }}
        onCreateNovel={createNewNovel}
        onDeleteNovel={deleteNovel}
      />

      {/* Contact Developer Modal */}
      {isContactOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
             <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">联系开发者</h3>
                    <button onClick={() => setIsContactOpen(false)} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                        <XIcon />
                    </button>
                </div>
                <div className="p-8 text-center space-y-4">
                    <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-2">
                        <MailIcon />
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        有任何建议或发现了 Bug？<br/>欢迎通过邮件联系我们。
                    </p>
                    <a href="mailto:support@inkflow.app" className="block w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-indigo-500/20">
                        support@inkflow.app
                    </a>
                </div>
             </div>
        </div>
      )}

    </div>
  );
}

export default App;
