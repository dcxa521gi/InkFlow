
import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { CopyIcon, ChevronDownIcon, ChevronUpIcon } from './Icons';
import { Message, NovelTab } from '../types';

interface NovelViewProps {
  messages: Message[];
  onBatchGenerateToC: (count: number | 'custom') => void;
  onBatchGenerateContent: (count: number | 'custom') => void;
  onChapterAction: (action: 'optimize' | 'regenerate' | 'analyze', chapterTitle: string, content: string) => void;
  isGenerating: boolean;
}

const NovelView: React.FC<NovelViewProps> = ({ 
    messages, 
    onBatchGenerateToC,
    onBatchGenerateContent,
    onChapterAction,
    isGenerating 
}) => {
  const [activeTab, setActiveTab] = useState<NovelTab>('settings');
  const [copyStatus, setCopyStatus] = useState('复制');
  const [customToCCount, setCustomToCCount] = useState<string>('');
  const [customContentCount, setCustomContentCount] = useState<string>('');
  const [batchError, setBatchError] = useState<string | null>(null);
  
  // State for collapsed chapters
  const [collapsedChapters, setCollapsedChapters] = useState<Set<string>>(new Set());

  // --- Content Parsers ---

  const dialogueContent = useMemo(() => {
    return messages.map(m => `**${m.role === 'user' ? '你' : 'AI'}**: ${m.content.replace(/Options:.*$/, '')}`).join('\n\n---\n\n');
  }, [messages]);

  // Strict Separation for Basic Settings
  const settingsContent = useMemo(() => {
    const validMessages = messages.filter(m => m.role === 'model');
    // Regex looking for headers specific to Basic Settings
    const headerRegex = /^(#{1,3})\s*(基础设定|大纲|世界观|概要|背景|梗概|简介|故事线|核心梗|分卷|Outline|Summary|Setting|Background|Synopsis|Storyline)/mi;

    const parts = validMessages.filter(m => {
         return headerRegex.test(m.content) && !m.content.includes('## 角色') && !m.content.includes('## 势力');
    });
    
    if (parts.length === 0) return "## 暂无基础设定\n\n请在对话中让 AI 生成大纲、世界观或故事简介。";
    return parts.map(m => m.content.replace(/Options:.*$/, '')).join('\n\n---\n\n');
  }, [messages]);

  // Strict Separation for Database
  const databaseContent = useMemo(() => {
    const validMessages = messages.filter(m => m.role === 'model');
    // Regex looking for headers specific to Database
    const headerRegex = /^(#{1,3})\s*(数据库|角色|势力|关系|物品|功法|科技|档案|Database|Character|Faction|Item)/mi;
    
    const parts = validMessages.filter(m => headerRegex.test(m.content));
    
    if (parts.length === 0) return "## 暂无数据库内容\n\n请在对话中让 AI 生成角色档案、势力分布或物品设定。";
    return parts.map(m => m.content.replace(/Options:.*$/, '')).join('\n\n---\n\n');
  }, [messages]);

  // --- Enhanced Chapter Parsing ---
  const chapters = useMemo(() => {
      const results: { title: string, content: string, id: string, wordCount: number }[] = [];
      const validMessages = messages.filter(m => m.role === 'model');
      
      validMessages.forEach(msg => {
          const content = msg.content.replace(/Options:.*$/, '');
          const matches = content.matchAll(/(^|\n)##\s*(第[0-9一二三四五六七八九十]+章\s*[^\n]*)/g);
          
          let startPos = 0;
          let currentTitle = '';
          
          for (const match of matches) {
             if (currentTitle) {
                 const chapterText = content.substring(startPos, match.index).trim();
                 if (chapterText) {
                     results.push({
                         id: `${msg.id}-${results.length}`,
                         title: currentTitle,
                         content: chapterText,
                         wordCount: chapterText.length
                     });
                 }
             }
             currentTitle = match[2]; 
             startPos = (match.index || 0) + match[0].length;
          }
          
          if (currentTitle) {
              const chapterText = content.substring(startPos).trim();
              results.push({
                  id: `${msg.id}-${results.length}`,
                  title: currentTitle,
                  content: chapterText,
                  wordCount: chapterText.length
              });
          }
      });
      return results;
  }, [messages]);
  
  const hasChapterToC = useMemo(() => {
    return messages.some(m => m.role === 'model' && (m.content.includes('## 目录') || /^\d+\.\s+第[0-9一二三四五六七八九十]+章/m.test(m.content)));
  }, [messages]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopyStatus('OK!');
    setTimeout(() => setCopyStatus('复制'), 2000);
  };
  
  const handleDownloadChapter = (title: string, content: string) => {
      const blob = new Blob([`${title}\n\n${content}`], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const toggleCollapse = (chapterId: string) => {
      setCollapsedChapters(prev => {
          const next = new Set(prev);
          if (next.has(chapterId)) {
              next.delete(chapterId);
          } else {
              next.add(chapterId);
          }
          return next;
      });
  };

  const triggerBatchToC = (val: number | 'custom') => {
      setBatchError(null);
      if (val === 'custom') {
          const num = parseInt(customToCCount);
          if (num > 0) onBatchGenerateToC(num);
      } else {
          onBatchGenerateToC(val);
      }
  };

  const triggerBatchContent = (val: number | 'custom') => {
    setBatchError(null);
    if (!hasChapterToC) {
        setBatchError('检测不到章节目录，请先生成目录 (ToC) 再批量撰写正文。');
        return;
    }
    if (val === 'custom') {
        const num = parseInt(customContentCount);
        if (num > 0) onBatchGenerateContent(num);
    } else {
        onBatchGenerateContent(val);
    }
  };


  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-950 border-l border-gray-200 dark:border-gray-800 transition-colors">
      {/* Tabs Header */}
      <div className="flex items-center justify-between px-2 pt-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {[
                { id: 'settings', icon: '📋', label: '基础设定' },
                { id: 'database', icon: '👥', label: '数据库' },
                { id: 'chapters', icon: '📚', label: '章节正文' },
                { id: 'dialogue', icon: '💬', label: '对话记录' },
            ].map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as NovelTab)}
                    className={`
                        px-4 py-2 text-xs font-medium rounded-t-lg transition-colors flex items-center gap-2 whitespace-nowrap
                        ${activeTab === tab.id 
                            ? 'bg-white dark:bg-gray-950 text-indigo-600 dark:text-indigo-400 border-x border-t border-gray-200 dark:border-gray-800 relative top-[1px]' 
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'}
                    `}
                >
                    <span>{tab.icon}</span> {tab.label}
                </button>
            ))}
        </div>
        
        <button 
            onClick={() => {
                if(activeTab === 'chapters') {
                     handleCopy(chapters.map(c => `${c.title}\n\n${c.content}`).join('\n\n'));
                } else {
                    handleCopy(activeTab === 'dialogue' ? dialogueContent : (activeTab === 'settings' ? settingsContent : databaseContent));
                }
            }}
            className="mb-1 mr-2 text-xs flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-700 shadow-sm"
        >
            <CopyIcon /> {copyStatus}
        </button>
      </div>
      
      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-[#0f1115]">
          {activeTab === 'chapters' ? (
              <div className="p-4 space-y-4">
                 {chapters.length === 0 && (
                     <div className="text-center py-20 text-gray-500 dark:text-gray-500">
                         <div className="text-4xl mb-2">📚</div>
                         <p>暂无正文章节</p>
                         <p className="text-xs mt-2">请使用下方工具生成目录和正文。</p>
                     </div>
                 )}
                 {chapters.map((chapter) => {
                     const isCollapsed = collapsedChapters.has(chapter.id);
                     return (
                     <div key={chapter.id} className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                         {/* Chapter Header / Toolbar */}
                         <div 
                            className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 cursor-pointer select-none"
                            onClick={() => toggleCollapse(chapter.id)}
                         >
                             <div className="flex items-center gap-2">
                                <button className="text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400">
                                    {isCollapsed ? <ChevronDownIcon /> : <ChevronUpIcon />}
                                </button>
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm md:text-base">{chapter.title}</h3>
                                    <p className="text-[10px] text-gray-400 mt-0.5">
                                        字数: {chapter.wordCount}
                                    </p>
                                </div>
                             </div>
                             <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                 <button onClick={() => onChapterAction('optimize', chapter.title, chapter.content)} className="p-1.5 text-xs text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30 rounded" title="优化润色">✨ 优化</button>
                                 <button onClick={() => onChapterAction('regenerate', chapter.title, chapter.content)} className="p-1.5 text-xs text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-900/30 rounded" title="重新生成">🔄 重写</button>
                                 <button onClick={() => onChapterAction('analyze', chapter.title, chapter.content)} className="p-1.5 text-xs text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded" title="章节分析">📊 分析</button>
                                 <button onClick={() => handleDownloadChapter(chapter.title, chapter.content)} className="p-1.5 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 rounded" title="下载本章">⬇️</button>
                             </div>
                         </div>
                         {/* Content */}
                         {!isCollapsed && (
                             <div className="p-5 prose dark:prose-invert prose-indigo max-w-none text-sm leading-7 md:text-base md:leading-8 dark:prose-headings:text-gray-100 dark:prose-p:text-gray-300 dark:prose-strong:text-white dark:prose-blockquote:text-gray-400 dark:prose-code:text-pink-300 animate-fadeIn">
                                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                                    {chapter.content}
                                </ReactMarkdown>
                             </div>
                         )}
                     </div>
                 )})}
              </div>
          ) : (
            <div className="p-8 prose dark:prose-invert prose-indigo max-w-none dark:prose-headings:text-gray-100 dark:prose-p:text-gray-300 dark:prose-strong:text-white dark:prose-blockquote:text-gray-400 dark:prose-code:text-pink-300">
                <ReactMarkdown 
                remarkPlugins={[remarkGfm, remarkBreaks]}
                components={{
                    code({node, className, children, ...props}) {
                        const match = /language-(\w+)/.exec(className || '')
                        return match ? (
                        <div className="mockup-code bg-gray-100 dark:bg-gray-800 rounded-lg p-4 my-4 overflow-x-auto text-sm font-mono border border-gray-200 dark:border-gray-700">
                            {String(children).replace(/\n$/, '')}
                        </div>
                        ) : (
                        <code className="bg-gray-100 dark:bg-gray-800 rounded px-1 py-0.5 text-sm font-mono text-pink-500 dark:text-pink-300" {...props}>
                            {children}
                        </code>
                        )
                    }
                }}
                >
                {activeTab === 'dialogue' ? dialogueContent : (activeTab === 'settings' ? settingsContent : databaseContent)}
                </ReactMarkdown>
            </div>
          )}
      </div>

      {/* Footer Controls (Only for Chapters Tab) */}
      {activeTab === 'chapters' && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80 backdrop-blur-sm space-y-4">
            {/* Error Display */}
            {batchError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-3 py-2 rounded text-xs">
                    ⚠️ {batchError}
                </div>
            )}

            {/* Batch ToC */}
            <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">批量生成目录 (ToC)</label>
                <div className="flex flex-wrap gap-2">
                    {[5, 10, 20].map(num => (
                        <button 
                            key={num}
                            onClick={() => triggerBatchToC(num)}
                            disabled={isGenerating}
                            className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs font-medium hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-50"
                        >
                            +{num}章
                        </button>
                    ))}
                    <div className="flex items-center gap-1">
                        <input 
                            type="number" 
                            placeholder="自定义" 
                            value={customToCCount}
                            onChange={(e) => setCustomToCCount(e.target.value)}
                            className="w-16 px-2 py-1.5 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <button 
                            onClick={() => triggerBatchToC('custom')}
                            disabled={isGenerating || !customToCCount}
                            className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-500 disabled:opacity-50"
                        >
                            生成
                        </button>
                    </div>
                </div>
            </div>

            <hr className="border-gray-200 dark:border-gray-700" />

            {/* Batch Content */}
            <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">批量撰写正文 (需先有目录)</label>
                <div className="flex flex-wrap gap-2">
                    {[1, 5, 10].map(num => (
                        <button 
                            key={num}
                            onClick={() => triggerBatchContent(num)}
                            disabled={isGenerating}
                            className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs font-medium hover:bg-green-50 dark:hover:bg-green-900/20 disabled:opacity-50 text-green-700 dark:text-green-400"
                        >
                            写{num}章
                        </button>
                    ))}
                    <div className="flex items-center gap-1">
                        <input 
                            type="number" 
                            placeholder="自定义" 
                            value={customContentCount}
                            onChange={(e) => setCustomContentCount(e.target.value)}
                            className="w-16 px-2 py-1.5 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <button 
                            onClick={() => triggerBatchContent('custom')}
                            disabled={isGenerating || !customContentCount}
                            className="px-3 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-500 disabled:opacity-50"
                        >
                            撰写
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default NovelView;
